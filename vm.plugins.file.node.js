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

var fs = require("fs");
var path = require("path");

var previousWriteBuffers = [
    "", // stdin, unused
    "", // stdout
    "", // stderr
];

var openFileDescriptors = [];

Object.extend(Squeak.Primitives.prototype,
'FilePlugin', {
    primitiveDirectoryCreate: function(argCount) {
        var dirNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var dirName = dirNameObj.bytesAsString();
        try {
            fs.mkdirSync(dirName);
        } catch(e) {
            console.error("Failed to create directory: " + dirName);
            return false;
        }
        return this.popNIfOK(argCount);	// Answer self
    },
    primitiveDirectoryDelete: function(argCount) {
        var dirNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var dirName = dirName.bytesAsString();
        try {
            fs.rmdirSync(dirName);
        } catch(e) {
            console.error("Failed to delete directory: " + dirName);
            return false;
        }
        return this.popNIfOK(argCount);	// Answer self
    },
    primitiveDirectoryDelimitor: function(argCount) {
        var delimitor = this.emulateMac ? ':' : path.sep;
        return this.popNandPushIfOK(argCount + 1, this.charFromInt(delimitor.charCodeAt(0)));
    },
    primitiveDirectoryLookup: function(argCount) {
        var index = this.stackInteger(0),
            dirNameObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var dirName = dirNameObj.bytesAsString();
        var entry = null;
        try {
            var dirEntries = fs.readdirSync(dirName);
            if(index < 1 || index > dirEntries.length) return false;
            var dirEntry = dirEntries[index - 1];
            var stats = fs.statSync(dirName + path.sep + dirEntry);
            entry = [
                dirEntry,                                           // Name
                Math.floor((stats.ctimeMs - Squeak.Epoch) / 1000),  // Creation time (seconds sinds Smalltalk epoch)
                Math.floor((stats.mtimeMs - Squeak.Epoch) / 1000),  // Modification time (seconds sinds Smalltalk epoch)
                stats.isDirectory(),                                // Directory flag
                stats.isFile() ? stats.size : 0                     // File size
            ];
        } catch(e) {
            if (e.errno !== -20) {
                console.error("Failed to read directory: " + dirName);
            }
            return false;
        }
        this.popNandPushIfOK(argCount + 1, this.makeStObject(entry));  // entry or nil
        return true;
    },
    primitiveFileStdioHandles: function(argCount) {
        var handles = [
            this.makeFileHandle('/dev/stdin', 0, false),
            this.makeFileHandle('/dev/stdout', 1, true),
            this.makeFileHandle('/dev/stderr', 2, true),
        ];
        this.popNandPushIfOK(argCount + 1, this.makeStArray(handles));
        return true;
    },
    primitiveFileOpen: function(argCount) {
        var writeFlag = this.stackBoolean(0),
            fileNameObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var fileName = fileNameObj.bytesAsString();
        var fd;
        try {
            fd = fs.openSync(fileName, writeFlag ? "a+" : "r");
            if (fd < 0) return false;
        } catch(e) {
            console.error("Failed to open file: " + fileName);
            return false;
        }
        var handle = this.makeFileHandle(fileName, fd, writeFlag);
        openFileDescriptors.push(fd);
        this.popNandPushIfOK(argCount + 1, handle);
        return true;
    },
    primitiveFileSize: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success) return false;
        var fileSize;
        try {
            fileSize = fs.fstatSync(handle.fd).size;
        } catch(e) {
            console.error("Failed to get file size");
            return false;
        }
        this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(fileSize));
        return true;
    },
    primitiveFileGetPosition: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success) return false;
        this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(handle.filePos));
        return true;
    },
    primitiveFileSetPosition: function(argCount) {
        var pos = this.stackPos32BitInt(0),
            handle = this.stackNonInteger(1);
        if (!this.success) return false;
        handle.filePos = pos;
        return this.popNIfOK(argCount);	// Answer self
    },
    primitiveFileAtEnd: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success) return false;
        var fileAtEnd;
        try {
            fileAtEnd = handle.filePos >= fs.fstatSync(handle.fd).size;
        } catch(e) {
            console.error("Failed to decide if at end of file");
            return false;
        }
        this.popNandPushIfOK(argCount + 1, this.makeStObject(fileAtEnd));
        return true;
    },
    primitiveDirectorySetMacTypeAndCreator: function(argCount) {
        return this.popNIfOK(argCount);	// Answer self
    },
    primitiveFileRead: function(argCount) {
        var count = this.stackInteger(0),
            startIndex = this.stackInteger(1) - 1, // make zero based
            arrayObj = this.stackNonInteger(2),
            handle = this.stackNonInteger(3);
        if (!this.success) return false;
        if (!count) return this.popNandPushIfOK(argCount + 1, 0);
        if (!arrayObj.bytes) {
            console.warn("File reading into non-bytes object not implemented yet");
            return false;
        }
        if (startIndex < 0 || startIndex + count > arrayObj.bytes.length)
            return false;
        if (handle.fd === 0) {
            console.warn("File reading on stdin not implemented yet");
            return false;
        }
        var bytesRead;
        try {
            bytesRead = fs.readSync(handle.fd, arrayObj.bytes, startIndex, count, handle.filePos);
            handle.filePos += bytesRead;
        } catch(e) {
            console.error("Failed to read from file");
            return false;
        }
        this.popNandPushIfOK(argCount + 1, bytesRead);
        return true;
    },
    primitiveFileWrite: function(argCount) {
        var count = this.stackInteger(0),
            startIndex = this.stackInteger(1) - 1, // make zero based
            arrayObj = this.stackNonInteger(2),
            handle = this.stackNonInteger(3);
        if (!this.success || !handle.fileWrite) return false;
        if (!count) return this.popNandPushIfOK(argCount + 1, 0);
        var array = arrayObj.bytes || arrayObj.wordsAsUint8Array();
        if (!array) return false;
        if (startIndex < 0 || startIndex + count > array.length)
            return false;
        var bytesWritten;
        if (handle.fd === 1 || handle.fd === 2) {
            var logger = handle.fd === 1 ? console.log : console.error;
            var buffer = array.slice(startIndex, startIndex + count);
            while (count > 0 && buffer.length > 0) {
                var linefeedIndex = buffer.indexOf(10);
                if (linefeedIndex >= 0) {
                    logger(previousWriteBuffers[handle.fd] + String.fromCharCode.apply(null, buffer.slice(0, linefeedIndex)));
                    previousWriteBuffers[handle.fd] = "";
                    buffer = buffer.slice(linefeedIndex + 1);
                    bytesWritten += linefeedIndex + 1;  // incl. the linefeed character
                    count -= linefeedIndex + 1;
                    handle.filePos += linefeedIndex + 1;
                } else {
                    previousWriteBuffers[handle.fd] += String.fromCharCode.apply(null, buffer);
                    bytesWritten += buffer.length;
                    count -= buffer.length;
                    handle.filePos += buffer.length;
                }
            }
        } else {
            try {
                bytesWritten = fs.writeSync(handle.fd, array, startIndex, count, handle.filePos);
                handle.filePos += bytesWritten;
            } catch(e) {
                console.error("Failed to write to file");
                return false;
            }
        }
        this.popNandPushIfOK(argCount + 1, bytesWritten);
        return true;
    },
    primitiveFileFlush: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success) return false;
        if (handle.fd === 1 || handle.fd === 2) {
            var logger = handle.fd === 1 ? console.log : console.error;
            logger(previousWriteBuffers[handle.fd]);
            previousWriteBuffers[handle.fd] = "";
        } else {
            try {
                fs.fsyncSync(handle.fd);
            } catch(e) {
                console.error("Failed to flush file");
                return false;
            }
        }
        return this.popNIfOK(argCount);	// Answer self
    },
    primitiveFileTruncate: function(argCount) {
        var pos = this.stackPos32BitInt(0),
            handle = this.stackNonInteger(1);
        if (!this.success || !handle.fileWrite) return false;
        try {
            var fileSize = fs.fstatSync(handle.fd).size;
            if (fileSize > pos) {
                fs.ftruncateSync(handle.fd, pos);
                if (handle.filePos > pos) handle.filePos = pos;
            }
        } catch(e) {
            console.error("Failed to truncate file");
            return false;
        }
        return this.popNIfOK(argCount);	// Answer self
    },
    primitiveFileClose: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success) return false;
        try {
            fs.closeSync(handle.fd);
            openFileDescriptors = openFileDescriptors.filter(function(fd) { return fd !== handle.fd; });
        } catch(e) {
            console.error("Failed to close file");
            return false;
        }
        return this.popNIfOK(argCount);	// Answer self
    },
    primitiveFileRename: function(argCount) {
        var oldNameObj = this.stackNonInteger(1),
            newNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var oldName = oldNameObj.bytesAsString(),
            newName = newNameObj.bytesAsString();
        try {
            fs.renameSync(oldName, newName);
        } catch(e) {
            console.error("Failed to rename file from: " + oldName + " to: " + newName);
            return false;
        }
        return this.popNIfOK(argCount);	// Answer self
    },
    primitiveFileDelete: function(argCount) {
        var fileNameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var fileName = fileNameObj.bytesAsString();
        try {
            fs.unlinkSync(fileName);
        } catch(e) {
            console.error("Failed to delete file: " + fileName);
            return false;
        }
        return this.popNIfOK(argCount);	// Answer self
    },
    makeFileHandle: function(filename, fd, writeFlag) {
        var handle = this.makeStString("squeakjs:" + filename);
        handle.fd = fd;                 // shared between handles
        handle.fileWrite = writeFlag;   // specific to this handle
        handle.filePos = 0;             // specific to this handle
        return handle;
    },
    filenameToSqueak: function(unixpath) {
        return unixpath;
    },
    filenameFromSqueak: function(filepath) {
        return filepath;
    },
});

Object.extend(Squeak, {
    flushAllFiles: function() {
        openFileDescriptors.forEach(function(fd) {
            try {
                fs.fsyncSync(fd);
            } catch(e) {
                console.error("Failed to flush one of the files");
            }
        });
    },
    filePut: function(fileName, buffer) {
        try {
            fs.writeFileSync(fileName, new DataView(buffer));
        } catch(e) {
            console.error("Failed to create file with content: " + fileName);
        }
    },
});
