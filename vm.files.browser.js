"use strict";
/*
 * Copyright (c) 2013-2020 Vanessa Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

Object.extend(Squeak,
"files", {
    fsck: function(whenDone, dir, files, stats) {
        dir = dir || "";
        stats = stats || {dirs: 0, files: 0, bytes: 0, deleted: 0};
        if (!files) {
            // find existing files
            files = {};
            // ... in localStorage
            Object.keys(Squeak.Settings).forEach(function(key) {
                var match = key.match(/squeak-file(\.lz)?:(.*)$/);
                if (match) {files[match[2]] = true};
            });
            // ... or in memory
            if (window.SqueakDBFake) Object.keys(SqueakDBFake.bigFiles).forEach(function(path) {
                files[path] = true;
            });
            // ... or in IndexedDB (the normal case)
            if (typeof indexedDB !== "undefined") {
                return this.dbTransaction("readonly", "fsck cursor", function(fileStore) {
                    var cursorReq = fileStore.openCursor();
                    cursorReq.onsuccess = function(e) {
                        var cursor = e.target.result;
                        if (cursor) {
                            files[cursor.key] = true;
                            cursor.continue();
                        } else { // done
                            Squeak.fsck(whenDone, dir, files, stats);
                        }
                    }
                    cursorReq.onerror = function(e) {
                        console.error("fsck failed");
                    }
                });
            }
        }
        // check directories
        var entries = Squeak.dirList(dir);
        for (var name in entries) {
            var path = dir + "/" + name,
                isDir = entries[name][3];
            if (isDir) {
                var exists = "squeak:" + path in Squeak.Settings;
                if (exists) {
                    Squeak.fsck(null, path, files, stats);
                    stats.dirs++;
                } else {
                    console.log("Deleting stale directory " + path);
                    Squeak.dirDelete(path);
                    stats.deleted++;
                }
            } else {
                if (!files[path]) {
                    console.log("Deleting stale file entry " + path);
                    Squeak.fileDelete(path, true);
                    stats.deleted++;
                } else {
                    files[path] = false; // mark as visited
                    stats.files++;
                    stats.bytes += entries[name][4];
                }
            }
        }
        // check orphaned files
        if (dir === "") {
            console.log("squeak fsck: " + stats.dirs + " directories, " + stats.files + " files, " + (stats.bytes/1000000).toFixed(1) + " MBytes");
            var orphaned = [],
                total = 0;
            for (var path in files) {
                total++;
                if (files[path]) orphaned.push(path); // not marked visited
            }
            if (orphaned.length > 0) {
                for (var i = 0; i < orphaned.length; i++) {
                    console.log("Deleting orphaned file " + orphaned[i]);
                    delete Squeak.Settings["squeak-file:" + orphaned[i]];
                    delete Squeak.Settings["squeak-file.lz:" + orphaned[i]];
                    stats.deleted++;
                }
                if (typeof indexedDB !== "undefined") {
                    this.dbTransaction("readwrite", "fsck delete", function(fileStore) {
                        for (var i = 0; i < orphaned.length; i++) {
                            fileStore.delete(orphaned[i]);
                        };
                    });
                }
            }
            if (whenDone) whenDone(stats);
        }
    },
    dbTransaction: function(mode, description, transactionFunc, completionFunc) {
        // File contents is stored in the IndexedDB named "squeak" in object store "files"
        // and directory entries in localStorage with prefix "squeak:"
        function fakeTransaction() {
            transactionFunc(Squeak.dbFake());
            if (completionFunc) completionFunc();
        }

        if (typeof indexedDB == "undefined") {
            return fakeTransaction();
        }

        function startTransaction() {
            var trans = SqueakDB.transaction("files", mode),
                fileStore = trans.objectStore("files");
            trans.oncomplete = function(e) { if (completionFunc) completionFunc(); }
            trans.onerror = function(e) { console.error(e.target.error.name + ": " + description) }
            trans.onabort = function(e) {
                console.error(e.target.error.name + ": aborting " + description);
                // fall back to local/memory storage
                transactionFunc(Squeak.dbFake());
                if (completionFunc) completionFunc();
            }
            transactionFunc(fileStore);
        };

        // if database connection already opened, just do transaction
        if (window.SqueakDB) return startTransaction();

        // otherwise, open SqueakDB first
        var openReq;
        try {
            // fails in restricted iframe
            openReq = indexedDB.open("squeak");
        } catch (err) {}

        // UIWebView implements the interface but only returns null
        // https://stackoverflow.com/questions/27415998/indexeddb-open-returns-null-on-safari-ios-8-1-1-and-halts-execution-on-cordova
        if (!openReq) {
            return fakeTransaction();
        }

        openReq.onsuccess = function(e) {
            console.log("Opened files database.");
            window.SqueakDB = this.result;
            SqueakDB.onversionchange = function(e) {
                delete window.SqueakDB;
                this.close();
            };
            SqueakDB.onerror = function(e) {
                console.error("Error accessing database: " + e.target.error.name);
            };
            startTransaction();
        };
        openReq.onupgradeneeded = function (e) {
            // run only first time, or when version changed
            console.log("Creating files database");
            var db = e.target.result;
            db.createObjectStore("files");
        };
        openReq.onerror = function(e) {
            console.error(e.target.error.name + ": cannot open files database");
            console.warn("Falling back to local storage");
            fakeTransaction();
        };
        openReq.onblocked = function(e) {
            // If some other tab is loaded with the database, then it needs to be closed
            // before we can proceed upgrading the database.
            console.log("Database upgrade needed, but was blocked.");
            console.warn("Falling back to local storage");
            fakeTransaction();
        };
    },
    dbFake: function() {
        // indexedDB is not supported by this browser, fake it using localStorage
        // since localStorage space is severly limited, use LZString if loaded
        // see https://github.com/pieroxy/lz-string
        if (typeof SqueakDBFake == "undefined") {
            if (typeof indexedDB == "undefined")
                console.warn("IndexedDB not supported by this browser, using localStorage");
            window.SqueakDBFake = {
                bigFiles: {},
                bigFileThreshold: 100000,
                get: function(filename) {
                    var buffer = SqueakDBFake.bigFiles[filename];
                    if (!buffer) {
                        var string = Squeak.Settings["squeak-file:" + filename];
                        if (!string) {
                            var compressed = Squeak.Settings["squeak-file.lz:" + filename];
                            if (compressed) {
                                if (typeof LZString == "object") {
                                    string = LZString.decompressFromUTF16(compressed);
                                } else {
                                    console.error("LZString not loaded: cannot decompress " + filename);
                                }
                            }
                        }
                        if (string) {
                            var bytes = new Uint8Array(string.length);
                            for (var i = 0; i < bytes.length; i++)
                                bytes[i] = string.charCodeAt(i) & 0xFF;
                            buffer = bytes.buffer;
                        }
                    }
                    var req = {result: buffer};
                    setTimeout(function(){
                        if (req.onsuccess) req.onsuccess({target: req});
                    }, 0);
                    return req;
                },
                put: function(buffer, filename) {
                    if (buffer.byteLength > SqueakDBFake.bigFileThreshold) {
                        if (!SqueakDBFake.bigFiles[filename])
                            console.log("File " + filename + " (" + buffer.byteLength + " bytes) too large, storing in memory only");
                        SqueakDBFake.bigFiles[filename] = buffer;
                    } else {
                        var string = Squeak.bytesAsString(new Uint8Array(buffer));
                        if (typeof LZString == "object") {
                            var compressed = LZString.compressToUTF16(string);
                            Squeak.Settings["squeak-file.lz:" + filename] = compressed;
                            delete Squeak.Settings["squeak-file:" + filename];
                        } else {
                            Squeak.Settings["squeak-file:" + filename] = string;
                        }
                    }
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess()}, 0);
                    return req;
                },
                delete: function(filename) {
                    delete Squeak.Settings["squeak-file:" + filename];
                    delete Squeak.Settings["squeak-file.lz:" + filename];
                    delete SqueakDBFake.bigFiles[filename];
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess()}, 0);
                    return req;
                },
                openCursor: function() {
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess({target: req})}, 0);
                    return req;
                },
            }
        }
        return SqueakDBFake;
    },
    fileGet: function(filepath, thenDo, errorDo) {
        if (!errorDo) errorDo = function(err) { console.log(err) };
        var path = this.splitFilePath(filepath);
        if (!path.basename) return errorDo("Invalid path: " + filepath);
        // if we have been writing to memory, return that version
        if (window.SqueakDBFake && SqueakDBFake.bigFiles[path.fullname])
            return thenDo(SqueakDBFake.bigFiles[path.fullname]);
        this.dbTransaction("readonly", "get " + filepath, function(fileStore) {
            var getReq = fileStore.get(path.fullname);
            getReq.onerror = function(e) { errorDo(e.target.error.name) };
            getReq.onsuccess = function(e) {
                if (this.result !== undefined) return thenDo(this.result);
                // might be a template
                Squeak.fetchTemplateFile(path.fullname,
                    function gotTemplate(template) {thenDo(template)},
                    function noTemplate() {
                        // if no indexedDB then we have checked fake db already
                        if (typeof indexedDB == "undefined") return errorDo("file not found: " + path.fullname);
                        // fall back on fake db, may be file is there
                        var fakeReq = Squeak.dbFake().get(path.fullname);
                        fakeReq.onerror = function(e) { errorDo("file not found: " + path.fullname) };
                        fakeReq.onsuccess = function(e) { thenDo(this.result); }
                    });
            };
        });
    },
    filePut: function(filepath, contents, optSuccess) {
        // store file, return dir entry if successful
        var path = this.splitFilePath(filepath); if (!path.basename) return null;
        var directory = this.dirList(path.dirname); if (!directory) return null;
        // get or create entry
        var entry = directory[path.basename],
            now = this.totalSeconds();
        if (!entry) { // new file
            entry = [/*name*/ path.basename, /*ctime*/ now, /*mtime*/ 0, /*dir*/ false, /*size*/ 0];
            directory[path.basename] = entry;
        } else if (entry[3]) // is a directory
            return null;
        // update directory entry
        entry[2] = now; // modification time
        entry[4] = contents.byteLength || contents.length || 0;
        Squeak.Settings["squeak:" + path.dirname] = JSON.stringify(directory);
        // put file contents (async)
        this.dbTransaction("readwrite", "put " + filepath,
            function(fileStore) {
                fileStore.put(contents, path.fullname);
            },
            function transactionComplete() {
                if (optSuccess) optSuccess();
            });
        return entry;
    },
    fileDelete: function(filepath, entryOnly) {
        var path = this.splitFilePath(filepath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        var entry = directory[path.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        // delete entry from directory
        delete directory[path.basename];
        Squeak.Settings["squeak:" + path.dirname] = JSON.stringify(directory);
        if (entryOnly) return true;
        // delete file contents (async)
        this.dbTransaction("readwrite", "delete " + filepath, function(fileStore) {
            fileStore.delete(path.fullname);
        });
        return true;
    },
    fileRename: function(from, to) {
        var oldpath = this.splitFilePath(from); if (!oldpath.basename) return false;
        var newpath = this.splitFilePath(to); if (!newpath.basename) return false;
        var olddir = this.dirList(oldpath.dirname); if (!olddir) return false;
        var entry = olddir[oldpath.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        var samedir = oldpath.dirname == newpath.dirname;
        var newdir = samedir ? olddir : this.dirList(newpath.dirname); if (!newdir) return false;
        if (newdir[newpath.basename]) return false; // exists already
        delete olddir[oldpath.basename];            // delete old entry
        entry[0] = newpath.basename;                // rename entry
        newdir[newpath.basename] = entry;           // add new entry
        Squeak.Settings["squeak:" + newpath.dirname] = JSON.stringify(newdir);
        if (!samedir) Squeak.Settings["squeak:" + oldpath.dirname] = JSON.stringify(olddir);
        // move file contents (async)
        this.fileGet(oldpath.fullname,
            function success(contents) {
                this.dbTransaction("readwrite", "rename " + oldpath.fullname + " to " + newpath.fullname, function(fileStore) {
                    fileStore.delete(oldpath.fullname);
                    fileStore.put(contents, newpath.fullname);
                });
            }.bind(this),
            function error(msg) {
                console.log("File rename failed: " + msg);
            }.bind(this));
        return true;
    },
    fileExists: function(filepath) {
        var path = this.splitFilePath(filepath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        var entry = directory[path.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        return true;
    },
    dirCreate: function(dirpath, withParents) {
        var path = this.splitFilePath(dirpath); if (!path.basename) return false;
        if (withParents && !Squeak.Settings["squeak:" + path.dirname]) Squeak.dirCreate(path.dirname, true);
        var directory = this.dirList(path.dirname); if (!directory) return false;
        if (directory[path.basename]) return false;
        var now = this.totalSeconds(),
            entry = [/*name*/ path.basename, /*ctime*/ now, /*mtime*/ now, /*dir*/ true, /*size*/ 0];
        directory[path.basename] = entry;
        Squeak.Settings["squeak:" + path.fullname] = JSON.stringify({});
        Squeak.Settings["squeak:" + path.dirname] = JSON.stringify(directory);
        return true;
    },
    dirDelete: function(dirpath) {
        var path = this.splitFilePath(dirpath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        if (!directory[path.basename]) return false;
        var children = this.dirList(path.fullname);
        if (!children) return false;
        for (var child in children) return false; // not empty
        // delete from parent
        delete directory[path.basename];
        Squeak.Settings["squeak:" + path.dirname] = JSON.stringify(directory);
        // delete itself
        delete Squeak.Settings["squeak:" + path.fullname];
        return true;
    },
    dirList: function(dirpath, includeTemplates) {
        // return directory entries or null
        var path = this.splitFilePath(dirpath),
            localEntries = Squeak.Settings["squeak:" + path.fullname],
            template = includeTemplates && Squeak.Settings["squeak-template:" + path.fullname];
        function addEntries(dir, entries) {
            for (var key in entries) {
                if (entries.hasOwnProperty(key)) {
                    var entry = entries[key];
                    dir[entry[0]] = entry;
                }
            }
        }
        if (localEntries || template) {
            // local entries override templates
            var dir = {};
            if (template) addEntries(dir, JSON.parse(template).entries);
            if (localEntries) addEntries(dir, JSON.parse(localEntries));
            return dir;
        }
        if (path.fullname == "/") return {};
        return null;
    },
    splitFilePath: function(filepath) {
        if (filepath[0] !== '/') filepath = '/' + filepath;
        filepath = filepath.replace(/\/\//g, '/');      // replace double-slashes
        var matches = filepath.match(/(.*)\/(.*)/),
            dirname = matches[1] ? matches[1] : '/',
            basename = matches[2] ? matches[2] : null;
        return {fullname: filepath, dirname: dirname, basename: basename};
    },
    splitUrl: function(url, base) {
        var matches = url.match(/(.*\/)?(.*)/),
            uptoslash = matches[1] || '',
            filename = matches[2] || '';
        if (!uptoslash.match(/^[a-z]+:\/\//)) {
            if (base && !base.match(/\/$/)) base += '/';
            uptoslash = (base || '') + uptoslash;
            url = uptoslash + filename;
        }
        return {full: url, uptoslash: uptoslash, filename: filename};
    },
    flushFile: function(file) {
        if (file.modified) {
            var buffer = file.contents.buffer;
            if (buffer.byteLength !== file.size) {
                buffer = new ArrayBuffer(file.size);
                (new Uint8Array(buffer)).set(file.contents.subarray(0, file.size));
            }
            Squeak.filePut(file.name, buffer);
            // if (/SqueakDebug.log/.test(file.name)) {
            //     var chars = Squeak.bytesAsString(new Uint8Array(buffer));
            //     console.warn(chars.replace(/\r/g, '\n'));
            // }
            file.modified = false;
        }
    },
    flushAllFiles: function() {
        if (typeof SqueakFiles == 'undefined') return;
        for (var name in SqueakFiles)
            this.flushFile(SqueakFiles[name]);
    },
    closeAllFiles: function() {
        // close the files held open in memory
        Squeak.flushAllFiles();
        delete window.SqueakFiles;
    },
    fetchTemplateDir: function(path, url) {
        // Called on app startup. Fetch url/sqindex.json and
        // cache all subdirectory entries in Squeak.Settings.
        // File contents is only fetched on demand
        path = Squeak.splitFilePath(path).fullname;
        function ensureTemplateParent(template) {
            var path = Squeak.splitFilePath(template);
            if (path.dirname !== "/") ensureTemplateParent(path.dirname);
            var template = JSON.parse(Squeak.Settings["squeak-template:" + path.dirname] || '{"entries": {}}');
            if (!template.entries[path.basename]) {
                var now = Squeak.totalSeconds();
                template.entries[path.basename] = [path.basename, now, now, true, 0];
                Squeak.Settings["squeak-template:" + path.dirname] = JSON.stringify(template);
            }
        }
        function checkSubTemplates(path, url) {
            var template = JSON.parse(Squeak.Settings["squeak-template:" + path]);
            for (var key in template.entries) {
                var entry = template.entries[key];
                if (entry[3]) Squeak.fetchTemplateDir(path + "/" + entry[0], url + "/" + entry[0]);
            };
        }
        if (Squeak.Settings["squeak-template:" + path]) {
            checkSubTemplates(path, url);
        } else  {
            var index = url + "/sqindex.json";
            var rq = new XMLHttpRequest();
            rq.open('GET', index, true);
            rq.onload = function(e) {
                if (rq.status == 200) {
                    console.log("adding template " + path);
                    ensureTemplateParent(path);
                    var entries = JSON.parse(rq.response),
                        template = {url: url, entries: {}};
                    for (var key in entries) {
                        var entry = entries[key];
                        template.entries[entry[0]] = entry;
                    }
                    Squeak.Settings["squeak-template:" + path] = JSON.stringify(template);
                    checkSubTemplates(path, url);
                }
                else rq.onerror(rq.statusText);
            };
            rq.onerror = function(e) {
                console.log("cannot load template index " + index);
            }
            rq.send();
        }
    },
    fetchTemplateFile: function(path, ifFound, ifNotFound) {
        path = Squeak.splitFilePath(path);
        var template = Squeak.Settings["squeak-template:" + path.dirname];
        if (!template) return ifNotFound();
        var url = JSON.parse(template).url;
        if (!url) return ifNotFound();
        url += "/" + path.basename;
        var rq = new XMLHttpRequest();
        rq.open("get", url, true);
        rq.responseType = "arraybuffer";
        rq.timeout = 30000;
        rq.onreadystatechange = function() {
            if (this.readyState != this.DONE) return;
            if (this.status == 200) {
                var buffer = this.response;
                console.log("Got " + buffer.byteLength + " bytes from " + url);
                Squeak.dirCreate(path.dirname, true);
                Squeak.filePut(path.fullname, buffer);
                ifFound(buffer);
            } else {
                console.error("Download failed (" + this.status + ") " + url);
                ifNotFound();
            }
        }
        console.log("Fetching " + url);
        rq.send();
    },
});
