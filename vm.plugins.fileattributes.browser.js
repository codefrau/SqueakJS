"use strict";
/*
 * Copyright (c) 2025 SqueakJS contributors
 *
 * FileAttributesPlugin for SqueakJS — hand-written (not generated from VMMaker),
 * like SocketPlugin.js. Maps Pharo's file-stat primitives onto SqueakJS's virtual
 * filesystem (Squeak.dirList / Squeak.splitFilePath). Implements enough of the
 * plugin for Pharo's FileSystem to boot: existence, per-attribute + bulk stat,
 * the S_IF* type masks, PATH_MAX, a version string, path passthrough, directory
 * streams, and no-op permission/owner setters.
 *
 * Attribute numbering follows Pharo's File class>>fileAttributeNumberMap:
 *   1 name  2 mode  3 inode  4 deviceId  5 nlink  6 uid  7 gid  8 size
 *   9 accessUnixTime  10 modificationUnixTime  11 changeUnixTime  12 creationUnixTime
 *   13 isReadable  14 isWritable  15 isExecutable  16 isSymlink
 * Timestamps are Unix seconds; SqueakJS FS entries store Squeak-epoch seconds
 * (since 1901-01-01), so subtract the 1901→1970 offset.
 */

Object.extend(Squeak.Primitives.prototype,
'FileAttributesPlugin', {
    fa_SQUEAK_TO_UNIX: 2177452800,   // seconds between 1901-01-01 and 1970-01-01
    fa_S_IFMT:  0xF000, fa_S_IFSOCK: 0xC000, fa_S_IFLNK: 0xA000, fa_S_IFREG: 0x8000,
    fa_S_IFBLK: 0x6000, fa_S_IFDIR:  0x4000, fa_S_IFCHR: 0x2000, fa_S_IFIFO: 0x1000,

    // [name, ctimeSqueak, mtimeSqueak, isDir, sizeBytes] for a path, or null if absent.
    // "/" is the (always-present) root directory.
    fa_entryFor: function(sqPath) {
        if (!Squeak.splitFilePath || !Squeak.dirList) return null; // no virtual FS (e.g. Node) → fail gracefully
        var p = Squeak.splitFilePath(this.filenameFromSqueak(sqPath));
        if (p.fullname === "/") return ["", 0, 0, true, 0];
        var dir = Squeak.dirList(p.dirname, true);
        return (dir && dir[p.basename]) || null;
    },
    fa_mode: function(entry) {
        // type bits + conventional perms (0755 dirs / 0644 files); the perms only
        // need to survive Pharo's (mode bitAnd: S_IFMT) type checks + posixPermissions.
        return entry[3] ? (this.fa_S_IFDIR | 0x1ED) : (this.fa_S_IFREG | 0x1A4);
    },
    fa_attribute: function(entry, num, name) {
        var toUnix = this.fa_SQUEAK_TO_UNIX;
        switch (num) {
            case 1:  return name;                      // targetName
            case 2:  return this.fa_mode(entry);       // mode
            case 3:  return 0;                         // inode
            case 4:  return 0;                         // deviceId
            case 5:  return 1;                         // nlink
            case 6:  return 0;                         // uid
            case 7:  return 0;                         // gid
            case 8:  return entry[4] || 0;             // size
            case 9:  return (entry[2] || 0) - toUnix;  // accessUnixTime
            case 10: return (entry[2] || 0) - toUnix;  // modificationUnixTime
            case 11: return (entry[2] || 0) - toUnix;  // changeUnixTime
            case 12: return (entry[1] || 0) - toUnix;  // creationUnixTime
            case 13: return true;                      // isReadable
            case 14: return true;                      // isWritable
            case 15: return !!entry[3];                // isExecutable (directories are)
            case 16: return false;                     // isSymlink
        }
        return null;
    },
    // Missing file → fail handing Pharo a PrimitiveError with errorCode -3 (cantStatPath):
    // File>>signalError:for: maps exactly that to FileDoesNotExistException, which callers
    // like File isDirectory:/exists: rely on catching. A plain symbol error code would raise
    // PrimitiveFailed instead and abort whole startup subsystems (e.g. the startup-script
    // loader dies scanning a non-existent preferences folder).
    fa_failMissing: function() {
        var cls = this.fa_primitiveErrorClass;
        if (cls === undefined)
            cls = this.fa_primitiveErrorClass = this.vm.globalNamed("PrimitiveError") || null;
        if (cls) {
            var err = this.vm.instantiateClass(cls, 0);
            err.pointers[1] = -3; // errorCode := cantStatPath (slots: errorName, errorCode)
            this.vm.primFailErrorObject = err;
        }
        this.vm.primFailCode = Squeak.PrimErrNotFound;
        return false;
    },

    fileAttributes_primitiveFileExists: function(argCount) {
        var pathObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var entry = this.fa_entryFor(pathObj.bytesAsString());
        return this.popNandPushIfOK(argCount + 1, entry ? this.vm.trueObj : this.vm.falseObj);
    },
    fileAttributes_primitiveFileAttribute: function(argCount) {
        var num = this.stackInteger(0),
            pathObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var sqPath = pathObj.bytesAsString(),
            entry = this.fa_entryFor(sqPath);
        if (!entry) return this.fa_failMissing();
        var name = Squeak.splitFilePath(this.filenameFromSqueak(sqPath)).basename;
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(this.fa_attribute(entry, num, name)));
    },
    fileAttributes_primitiveFileAttributes: function(argCount) {
        var mask = this.stackInteger(0),
            pathObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var sqPath = pathObj.bytesAsString(),
            entry = this.fa_entryFor(sqPath);
        if (!entry) return this.fa_failMissing();
        var name = Squeak.splitFilePath(this.filenameFromSqueak(sqPath)).basename,
            wantStat = mask & 1, wantAccess = mask & 2, stat = null, access = null, i;
        if (wantStat) { stat = []; for (i = 1; i <= 12; i++) stat.push(this.fa_attribute(entry, i, name)); }
        if (wantAccess) access = [true, true, !!entry[3]];
        // Decoder (File class>>fileAttributes:mask:): mask&2r11 = 1 → stat array directly,
        // = 3 → { statArray, accessArray } (statArray at: 1).
        var result = wantStat && wantAccess ? [stat, access]
                   : wantStat ? stat
                   : wantAccess ? access : [];
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(result));
    },
    fileAttributes_primitiveFileMasks: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(
            [this.fa_S_IFMT, this.fa_S_IFSOCK, this.fa_S_IFLNK, this.fa_S_IFREG,
             this.fa_S_IFBLK, this.fa_S_IFDIR, this.fa_S_IFCHR, this.fa_S_IFIFO]));
    },
    fileAttributes_primitivePathMax: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, 4096);
    },
    fileAttributes_primitiveVersionString: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.makeStString("SqueakJS-FileAttributesPlugin 1.0"));
    },
    // Our FS paths are already UTF-8; platform<->st conversion is the identity (return a copy).
    fileAttributes_primitivePlatToStPath: function(argCount) { return this.fa_pathPassthrough(argCount); },
    fileAttributes_primitiveStToPlatPath: function(argCount) { return this.fa_pathPassthrough(argCount); },
    fa_pathPassthrough: function(argCount) {
        var pathObj = this.stackNonInteger(0);
        if (!this.success) return false;
        return this.popNandPushIfOK(argCount + 1, this.makeStString(pathObj.bytesAsString()));
    },
    fileAttributes_primitiveLogicalDrives: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, 0);   // Windows-only drive mask; none here
    },

    // Directory streams. Protocol (see Pharo's DiskStore>>directoryAt:nodesDo:):
    // opendir answers {encodedFirstEntryName. statAttributes. dirPointer} — the "new VM
    // (FileAttributesPlugin > 1.4)" shape — or nil if the directory can't be opened (we
    // also answer nil for an empty one). readdir answers {encodedName. statAttributes} or
    // nil at the end. statAttributes[1] is the symlink target (nil here → skipped).
    // The dirPointer is an integer id into fa_openDirs.
    fa_nextDirEntry: function(d) {
        if (d.pos >= d.names.length) return null;
        var name = d.names[d.pos++],
            e = d.entries[name],
            toUnix = this.fa_SQUEAK_TO_UNIX,
            mtime = (e[2] || 0) - toUnix,
            attrs = [null, this.fa_mode(e), 0, 0, 1, 0, 0, e[4] || 0,
                     mtime, mtime, mtime, (e[1] || 0) - toUnix];
        return [this.makeStString(name), this.makeStObject(attrs)];
    },
    fileAttributes_primitiveOpendir: function(argCount) {
        var pathObj = this.stackNonInteger(0);
        if (!this.success || !Squeak.dirList) return false;
        var entries = Squeak.dirList(this.filenameFromSqueak(pathObj.bytesAsString()), true);
        if (!entries) return this.popNandPushIfOK(argCount + 1, this.vm.nilObj);
        if (!this.fa_openDirs) { this.fa_openDirs = {}; this.fa_nextDir = 0; }
        var d = { entries: entries, names: Object.keys(entries).sort(), pos: 0 };
        var first = this.fa_nextDirEntry(d);
        if (!first) return this.popNandPushIfOK(argCount + 1, this.vm.nilObj); // empty
        var id = ++this.fa_nextDir;
        this.fa_openDirs[id] = d;
        return this.popNandPushIfOK(argCount + 1, this.makeStArray([first[0], first[1], id]));
    },
    fileAttributes_primitiveReaddir: function(argCount) {
        var id = this.stackInteger(0);
        if (!this.success) return false;
        var d = this.fa_openDirs && this.fa_openDirs[id];
        var e = d && this.fa_nextDirEntry(d);
        return this.popNandPushIfOK(argCount + 1, e ? this.makeStArray(e) : this.vm.nilObj);
    },
    fileAttributes_primitiveRewinddir: function(argCount) {
        var id = this.stackInteger(0);
        if (!this.success) return false;
        var d = this.fa_openDirs && this.fa_openDirs[id];
        if (d) d.pos = 0;
        return this.popNIfOK(argCount);
    },
    fileAttributes_primitiveClosedir: function(argCount) {
        var id = this.stackInteger(0);
        if (!this.success) return false;
        if (this.fa_openDirs) delete this.fa_openDirs[id];
        return this.popNIfOK(argCount);
    },

    // Permission / owner mutation isn't meaningful in the virtual FS — succeed as no-ops.
    fileAttributes_primitiveChangeMode: function(argCount) { return this.popNIfOK(argCount); },
    fileAttributes_primitiveChangeOwner: function(argCount) { return this.popNIfOK(argCount); },
    fileAttributes_primitiveSymlinkChangeOwner: function(argCount) { return this.popNIfOK(argCount); },
});
