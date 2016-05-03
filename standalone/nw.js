function patchSqueakForNode(root) {
    var fs = require("fs");
    var Squeak = window.Squeak;
    Object.extend(Squeak, {
        fileGet: (filepath, thenDo, errorDo) => {
            fs.readFile(root + filepath, (err, data) => {
                if (err) {
                    errorDo(err);
                } else {
                    thenDo((data instanceof ArrayBuffer) ? data : data.buffer);
                }
            });
        },
        filePut: (filepath, contents, optSuccess) => {
            var path = Squeak.splitFilePath(filepath); if (!path.basename) return null;
            var now = Squeak.totalSeconds();
            var entry = [path.basename, now, 0, false, contents.byteLength || contents.length || 0];
            fs.writeFile(root + filepath, contents, err => {});
            return entry;
        },
        fileDelete: (filepath, entryOnly) => {
            fs.unlinkSync(root + filepath);
        },
        fileRename: (from, to) => {
            fs.renameSync(root + from, root + to);
        },
        fileExists: (filepath) => {
            try {
                fs.accessSync(root + filepath);
                return true;
            } catch(e) {
                return false;
            }
        },
        dirCreate: (dirpath, withParents) => {
            var path = Squeak.splitFilePath(dirpath); if (!path.basename) return false;
            if (withParents && !Squeak.fileExists(path.dirname)) {
                Squeak.dirCreate(path.dirname, true);
            }
            try {
                fs.mkdirSync(root + dirpath);
                return true;
            } catch(e) {
                return false;
            }
        },
        dirDelete: (dirpath) => {
            try {
                fs.rmdirSync(root + dirpath);
                return true;
            } catch(e) {
                return false;
            }
        },
        dirList: (dirpath, includeTemplates) => {
            try {
                var dir = {};
                var files = fs.readdirSync(root + dirpath);
                files.forEach(f => {
                    var stats = fs.statSync(root + dirpath + f);
                    dir[f] = [f, stats.ctime, stats.mtime, stats.isDirectory(), stats.size];
                });
                return dir;
            } catch(e) {
                return null;
            }
        },
        primitiveQuit: (argCount) => {
            Squeak.flushAllFiles();
            nw.App.quit();
        },
    });
}
