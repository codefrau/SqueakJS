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

Object.extend(Squeak.Primitives.prototype,
'FilePlugin', {
    primitiveDirectoryCreate: function(argCount) {
        var dirNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var dirName = this.filenameFromSqueak(dirNameObj.bytesAsString());
        this.success = Squeak.dirCreate(dirName);
        if (!this.success) {
            var path = Squeak.splitFilePath(dirName);
            console.log("Directory not created: " + path.fullname);
        }
        return this.popNIfOK(argCount);
    },
    primitiveDirectoryDelete: function(argCount) {
        var dirNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var dirName = this.filenameFromSqueak(dirNameObj.bytesAsString());
        this.success = Squeak.dirDelete(dirName);
        return this.popNIfOK(argCount);
    },
    primitiveDirectoryDelimitor: function(argCount) {
        var delimitor = this.emulateMac ? ':' : '/';
        return this.popNandPushIfOK(1, this.charFromInt(delimitor.charCodeAt(0)));
    },
    primitiveDirectoryEntry: function(argCount) {
        var dirNameObj = this.stackNonInteger(1),
            fileNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var sqFileName = fileNameObj.bytesAsString();
        var fileName = this.filenameFromSqueak(fileNameObj.bytesAsString());
        var sqDirName = dirNameObj.bytesAsString();
        var dirName = this.filenameFromSqueak(dirNameObj.bytesAsString());
        var entries = Squeak.dirList(dirName, true);
        if (!entries) {
            var path = Squeak.splitFilePath(dirName);
            console.log("Directory not found: " + path.fullname);
            return false;
        }
        var entry = entries[fileName];
        this.popNandPushIfOK(argCount+1, this.makeStObject(entry));  // entry or nil
        return true;
    },
    primitiveDirectoryLookup: function(argCount) {
        var index = this.stackInteger(0),
            dirNameObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var sqDirName = dirNameObj.bytesAsString();
        var dirName = this.filenameFromSqueak(sqDirName);
        var entries = Squeak.dirList(dirName, true);
        if (!entries) {
            var path = Squeak.splitFilePath(dirName);
            console.log("Directory not found: " + path.fullname);
            return false;
        }
        var keys = Object.keys(entries).sort(),
            entry = entries[keys[index - 1]];
        if (sqDirName === "/") { // fake top-level dir
            if (index === 1) {
                if (!entry) entry = [0, 0, 0, 0, 0];
                entry[0] = "SqueakJS";
                entry[3] = true;
            }
            else entry = null;
        }
        this.popNandPushIfOK(argCount+1, this.makeStObject(entry));  // entry or nil
        return true;
    },
    primitiveDirectorySetMacTypeAndCreator: function(argCount) {
        return this.popNIfOK(argCount);
    },
    primitiveFileAtEnd: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        this.popNandPushIfOK(argCount+1, this.makeStObject(handle.filePos >= handle.file.size));
        return true;
    },
    primitiveFileClose: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        if (typeof handle.file === "string") {
             this.fileConsoleFlush(handle.file);
        } else {
            this.fileClose(handle.file);
            this.vm.breakOut();     // return to JS asap so async file handler can run
            handle.file = null;
        }
        return this.popNIfOK(argCount);
    },
    primitiveFileDelete: function(argCount) {
        var fileNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var fileName = this.filenameFromSqueak(fileNameObj.bytesAsString());
        this.success = Squeak.fileDelete(fileName);
        return this.popNIfOK(argCount);
    },
    primitiveFileFlush: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        if (typeof handle.file === "string") {
             this.fileConsoleFlush(handle.file);
        } else {
            Squeak.flushFile(handle.file);
            this.vm.breakOut();     // return to JS asap so async file handler can run
        }
        return this.popNIfOK(argCount);
    },
    primitiveFileGetPosition: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(handle.filePos));
        return true;
    },
    makeFileHandle: function(filename, file, writeFlag) {
        var handle = this.makeStString("squeakjs:" + filename);
        handle.file = file;             // shared between handles
        handle.fileWrite = writeFlag;   // specific to this handle
        handle.filePos = 0;             // specific to this handle
        return handle;
    },
    primitiveFileOpen: function(argCount) {
        var writeFlag = this.stackBoolean(0),
            fileNameObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var fileName = this.filenameFromSqueak(fileNameObj.bytesAsString()),
            file = this.fileOpen(fileName, writeFlag);
        if (!file) return false;
        var handle = this.makeFileHandle(file.name, file, writeFlag);
        this.popNandPushIfOK(argCount+1, handle);
        return true;
    },
    primitiveFileRead: function(argCount) {
        var count = this.stackInteger(0),
            startIndex = this.stackInteger(1) - 1, // make zero based
            arrayObj = this.stackNonInteger(2),
            handle = this.stackNonInteger(3);
        if (!this.success || !arrayObj.isWordsOrBytes() || !handle.file) return false;
        if (!count) return this.popNandPushIfOK(argCount+1, 0);
        var size = arrayObj.isWords() ? arrayObj.wordsSize() : arrayObj.bytesSize();
        if (startIndex < 0 || startIndex + count > size)
            return false;
        if (typeof handle.file === "string") {
            //this.fileConsoleRead(handle.file, array, startIndex, count);
            this.popNandPushIfOK(argCount+1, 0);
            return true;
        }
        return this.fileContentsDo(handle.file, function(file) {
            if (!file.contents)
                return this.popNandPushIfOK(argCount+1, 0);
            var srcArray, dstArray;
            if (arrayObj.isWords()) {
                srcArray = new Uint32Array(file.contents.buffer);
                dstArray = arrayObj.words,
                count = Math.min(count, (file.size - handle.filePos) >>> 2);
                for (var i = 0; i < count; i++)
                    dstArray[startIndex + i] = srcArray[handle.filePos + i];
                handle.filePos += count << 2;
            } else {
                srcArray = file.contents;
                dstArray = arrayObj.bytes;
                count = Math.min(count, file.size - handle.filePos);
                for (var i = 0; i < count; i++)
                    dstArray[startIndex + i] = srcArray[handle.filePos++];
            }
            this.popNandPushIfOK(argCount+1, Math.max(0, count));
        }.bind(this));
    },
    primitiveFileRename: function(argCount) {
        var oldNameObj = this.stackNonInteger(1),
            newNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var oldName = this.filenameFromSqueak(oldNameObj.bytesAsString()),
            newName = this.filenameFromSqueak(newNameObj.bytesAsString());
        this.success = Squeak.fileRename(oldName, newName);
        this.vm.breakOut();     // return to JS asap so async file handler can run
        return this.popNIfOK(argCount);
    },
    primitiveFileSetPosition: function(argCount) {
        var pos = this.stackPos32BitInt(0),
            handle = this.stackNonInteger(1);
        if (!this.success || !handle.file) return false;
        handle.filePos = pos;
        return this.popNIfOK(argCount);
    },
    primitiveFileSize: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        this.popNandPushIfOK(argCount+1, this.makeLargeIfNeeded(handle.file.size));
        return true;
    },
    primitiveFileStdioHandles: function(argCount) {
        var handles = [
            null, // stdin
            this.makeFileHandle('console.log', 'log', true),
            this.makeFileHandle('console.error', 'error', true),
        ];
        this.popNandPushIfOK(argCount + 1, this.makeStArray(handles));
        return true;
    },
    primitiveFileTruncate: function(argCount) {
        var pos = this.stackPos32BitInt(0),
            handle = this.stackNonInteger(1);
        if (!this.success || !handle.file || !handle.fileWrite) return false;
        if (handle.file.size > pos) {
            handle.file.size = pos;
            handle.file.modified = true;
            if (handle.filePos > handle.file.size) handle.filePos = handle.file.size;
        }
        return this.popNIfOK(argCount);
    },
    primitiveDisableFileAccess: function(argCount) {
        return this.fakePrimitive("FilePlugin.primitiveDisableFileAccess", 0, argCount);
    },
    primitiveFileWrite: function(argCount) {
        var count = this.stackInteger(0),
            startIndex = this.stackInteger(1) - 1, // make zero based
            arrayObj = this.stackNonInteger(2),
            handle = this.stackNonInteger(3);
        if (!this.success || !handle.file || !handle.fileWrite) return false;
        if (!count) return this.popNandPushIfOK(argCount+1, 0);
        var array = arrayObj.bytes || arrayObj.wordsAsUint8Array();
        if (!array) return false;
        if (startIndex < 0 || startIndex + count > array.length)
            return false;
        if (typeof handle.file === "string") {
            this.fileConsoleWrite(handle.file, array, startIndex, count);
            this.popNandPushIfOK(argCount+1, count);
            return true;
        }
        return this.fileContentsDo(handle.file, function(file) {
            var srcArray = array,
                dstArray = file.contents || [];
            if (handle.filePos + count > dstArray.length) {
                var newSize = dstArray.length === 0 ? handle.filePos + count :
                    Math.max(handle.filePos + count, dstArray.length + 10000);
                file.contents = new Uint8Array(newSize);
                file.contents.set(dstArray);
                dstArray = file.contents;
            }
            for (var i = 0; i < count; i++)
                dstArray[handle.filePos++] = srcArray[startIndex + i];
            if (handle.filePos > file.size) file.size = handle.filePos;
            file.modified = true;
            this.popNandPushIfOK(argCount+1, count);
        }.bind(this));
    },
    fileOpen: function(filename, writeFlag) {
        // if a file is opened for read and write at the same time,
        // they must share the contents. That's why all open files
        // are held in the ref-counted global SqueakFiles
        if (typeof SqueakFiles == 'undefined')
            window.SqueakFiles = {};
        var path = Squeak.splitFilePath(filename);
        if (!path.basename) return null;    // malformed filename
        // fetch or create directory entry
        var directory = Squeak.dirList(path.dirname, true);
        if (!directory) return null;
        var entry = directory[path.basename],
            contents = null;
        if (entry) {
            // if it is open already, return it
            var file = SqueakFiles[path.fullname];
            if (file) {
                ++file.refCount;
                return file;
            }
        } else {
            if (!writeFlag) {
                console.log("File not found: " + path.fullname);
                return null;
            }
            contents = new Uint8Array();
            entry = Squeak.filePut(path.fullname, contents.buffer);
            if (!entry) {
                console.log("Cannot create file: " + path.fullname);
                return null;
            }
        }
        // make the file object
        var file = {
            name: path.fullname,
            size: entry[4],         // actual file size, may differ from contents.length
            contents: contents,     // possibly null, fetched when needed
            modified: false,
            refCount: 1
        };
        SqueakFiles[file.name] = file;
        return file;
    },
    fileClose: function(file) {
        Squeak.flushFile(file);
        if (--file.refCount == 0)
            delete SqueakFiles[file.name];
    },
    fileContentsDo: function(file, func) {
        if (file.contents) {
            func(file);
        } else {
            if (file.contents === false) // failed to get contents before
                return false;
            this.vm.freeze(function(unfreeze) {
                Squeak.fileGet(file.name,
                    function success(contents) {
                        if (contents == null) return error(file.name);
                        file.contents = this.asUint8Array(contents);
                        unfreeze();
                        func(file);
                    }.bind(this),
                    function error(msg) {
                        console.log("File get failed: " + msg);
                        file.contents = false;
                        unfreeze();
                        func(file);
                    }.bind(this));
            }.bind(this));
        }
        return true;
    },
    fileConsoleBuffer: {
        log: '',
        error: ''
    },
    fileConsoleWrite: function(logOrError, array, startIndex, count) {
        // buffer until there is a newline
        var bytes = array.subarray(startIndex, startIndex + count),
            buffer = this.fileConsoleBuffer[logOrError] + Squeak.bytesAsString(bytes),
            lines = buffer.match('([^]*)\n(.*)');
        if (lines) {
            console[logOrError](lines[1]);  // up to last newline
            buffer = lines[2];              // after last newline
        }
        this.fileConsoleBuffer[logOrError] = buffer;
    },
    fileConsoleFlush: function(logOrError) {
        var buffer = this.fileConsoleBuffer[logOrError];
        if (buffer) {
            console[logOrError](buffer);
            this.fileConsoleBuffer[logOrError] = '';
        }
    },
});
