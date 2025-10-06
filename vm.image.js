import { normalizeMemoryOptions, deriveYoungSpaceLimit } from "./vm.memory.config.js";

"use strict";
/*
 * Copyright (c) 2013-2025 Vanessa Freudenberg
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

Object.subclass('Squeak.Image',
'about', {
    about: function() {
    /*
    Object Format
    =============
    Each Squeak object is a Squeak.Object instance, only SmallIntegers are JS numbers.
    Instance variables/fields reference other objects directly via the "pointers" property.
    A Spur image uses Squeak.ObjectSpur instances instead. Characters are not immediate,
    but made identical using a character table. They are created with their mark bit set to
    true, so are ignored by the GC.
    {
        sqClass: reference to class object
        format: format integer as in Squeak oop header
        hash: identity hash integer
        pointers: (optional) Array referencing inst vars + indexable fields
        words: (optional) Array of numbers (words)
        bytes: (optional) Array of numbers (bytes)
        float: (optional) float value if this is a Float object
        isNil: (optional) true if this is the nil object
        isTrue: (optional) true if this is the true object
        isFalse: (optional) true if this is the false object
        isFloat: (optional) true if this is a Float object
        isFloatClass: (optional) true if this is the Float class
        isCompact: (optional) true if this is a compact class
        oop: identifies this object in a snapshot (assigned on GC, new space object oops are negative)
        mark: boolean (used only during GC, otherwise false)
        dirty: boolean (true when an object may have a ref to a new object, set on every write, reset on GC)
        nextObject: linked list of objects in old space and young space (newly created objects do not have this yet)
    }

    Object Memory
    =============
    Objects in old space are a linked list (firstOldObject). When loading an image, all objects are old.
    Objects are tenured to old space during a full GC.
    New objects are only referenced by other objects' pointers, and thus can be garbage-collected
    at any time by the Javascript GC.
    A partial GC creates a linked list of new objects reachable from old space. We call this
    list "young space". It is not stored, but only created by primitives like nextObject,
    nextInstance, or become to support enumeration of new space.
    To efficiently find potential young space roots, any write to an instance variable sets
    the "dirty" flag of the object, allowing to skip clean objects.

    Weak references are finalized by a full GC. A partial GC only finalizes young weak references.

    */
    }
},
'initializing', {
    initialize: function(name, memoryOptions) {
        this.memoryPolicy = normalizeMemoryOptions(memoryOptions);
        this.headRoom = this.memoryPolicy.headroomBytes;
        this.totalMemory = 0;
        this.headerFlags = 0;
        this.name = name;
        this.headerAudit = new ImageHeaderAudit(name);
        this.gcCount = 0;
        this.gcMilliseconds = 0;
        this.pgcCount = 0;
        this.pgcMilliseconds = 0;
        this.gcTenured = 0;
        this.allocationCount = 0;
        this.oldSpaceCount = 0;
        this.youngSpaceCount = 0;
        this.newSpaceCount = 0;
        this.hasNewInstances = {};
        this.newSpaceBytes = 0;
        this.youngSpaceBytes = 0;
        this._partialGCInProgress = false;
        this.memoryPolicy.newSpaceLimit = 0;
        this.extraVMMemory = 0;
        this.memoryTelemetry = null;
    },
    readFromBuffer: function(arraybuffer, thenDo, progressDo) {
        console.log('squeak: reading ' + this.name + ' (' + arraybuffer.byteLength + ' bytes)');
        this.startupTime = Date.now();
        var data = new DataView(arraybuffer),
            littleEndian = false,
            pos = 0;
        if (!this.headerAudit) this.headerAudit = new ImageHeaderAudit(this.name);
        this.headerAudit.reset(this.name);
        var readWord32 = function() {
            var int = data.getUint32(pos, littleEndian);
            pos += 4;
            return int;
        };
        var readWord64 = function() {
            // we assume littleEndian for now
            var lo = data.getUint32(pos, true),
                hi = data.getUint32(pos+4, true);
            pos += 8;
            return Squeak.word64FromUint32(hi, lo);
        };
        var readWord = readWord32;
        var wordSize = 4;
        var readBits = function(nWords, isPointers) {
            if (isPointers) { // do endian conversion
                var oops = [];
                while (oops.length < nWords)
                    oops.push(readWord());
                return oops;
            } else { // words (no endian conversion yet)
                var bits = new Uint32Array(arraybuffer, pos, nWords * wordSize / 4);
                pos += nWords * wordSize;
                return bits;
            }
        };
        // read version and determine endianness
        var headerProbeLength = Math.min(516, arraybuffer.byteLength);
        var headerInfo = detectImageHeader(new Uint8Array(arraybuffer, 0, headerProbeLength), this.headerAudit);
        if (!headerInfo) throw Error("bad image version");
        littleEndian = headerInfo.littleEndian;
        var fileHeaderSize = headerInfo.fileHeaderSize;
        pos = fileHeaderSize;
        var version = readWord();
        if (version !== headerInfo.version) version = headerInfo.version;
        this.version = version;
        var nativeFloats = (version & 1) !== 0;
        this.hasClosures = !([6501, 6502, 68000].indexOf(version) >= 0);
        this.isSpur = (version & 16) !== 0;
        // var multipleByteCodeSetsActive = (version & 256) !== 0; // not used
        var is64Bit = version >= 68000;
        if (is64Bit && !this.isSpur) {
            var compatibility = tryLoadNativeCompatibilityImageFromBuffer({
                buffer: arraybuffer,
                littleEndian: littleEndian,
                headerInfo: headerInfo,
                audit: this.headerAudit,
                imageName: this.name,
            });
            if (compatibility) {
                this._finalizeCompatibilityLoad(compatibility, thenDo, progressDo);
                return;
            }
            if (this.headerAudit) {
                this.headerAudit.recordIssue("unsupported-nonspur-64", {
                    reason: "no-native-loader",
                });
            }
            throw Error("64 bit non-spur images not supported yet");
        }
        if (is64Bit)  { readWord = readWord64; wordSize = 8; }
        // parse image header
        var imageHeaderSize = readWord32(); // always 32 bits
        var objectMemorySize = readWord(); //first unused location in heap
        var oldBaseAddr = readWord(); //object memory base address of image
        var specialObjectsOopInt = readWord(); //oop of array of special oops
        var lastHash = readWord32(); if (is64Bit) readWord32(); // not used
        var savedWindowSize = readWord(); // not used
        this.headerFlags = readWord(); // vm attribute 48
        this.savedHeaderWords = [lastHash, savedWindowSize, this.headerFlags];
        for (var i = 0; i < 4; i++) {
            this.savedHeaderWords.push(readWord32());
        }
        var firstSegSize = readWord();
        var prevObj;
        var oopMap = new Map();
        var rawBits = new Map();
        var headerSize = fileHeaderSize + imageHeaderSize;
        pos = headerSize;
        if (!this.isSpur) {
            // read traditional object memory
            while (pos < headerSize + objectMemorySize) {
                var nWords = 0;
                var classInt = 0;
                var header = readWord();
                switch (header & Squeak.HeaderTypeMask) {
                    case Squeak.HeaderTypeSizeAndClass:
                        nWords = header >>> 2;
                        classInt = readWord();
                        header = readWord();
                        break;
                    case Squeak.HeaderTypeClass:
                        classInt = header - Squeak.HeaderTypeClass;
                        header = readWord();
                        nWords = (header >>> 2) & 63;
                        break;
                    case Squeak.HeaderTypeShort:
                        nWords = (header >>> 2) & 63;
                        classInt = (header >>> 12) & 31; //compact class index
                        //Note classInt<32 implies compact class index
                        break;
                    case Squeak.HeaderTypeFree:
                        throw Error("Unexpected free block");
                }
                nWords--;  //length includes base header which we have already read
                var oop = pos - 4 - headerSize, //0-rel byte oop of this object (base header)
                    format = (header>>>8) & 15,
                    hash = (header>>>17) & 4095,
                    bits = readBits(nWords, format < 5);
                var object = new Squeak.Object();
                object.initFromImage(oop, classInt, format, hash);
                if (classInt < 32) object.hash |= 0x10000000;    // see fixCompactOops()
                if (prevObj) prevObj.nextObject = object;
                this.oldSpaceCount++;
                prevObj = object;
                //oopMap is from old oops to actual objects
                oopMap.set(oldBaseAddr + oop, object);
                //rawBits holds raw content bits for objects
                rawBits.set(oop, bits);
            }
            this.firstOldObject = oopMap.get(oldBaseAddr+4);
            this.lastOldObject = object;
            this.lastOldObject.nextObject = null; // Add next object pointer as indicator this is in fact an old object
            this.oldSpaceBytes = objectMemorySize;
        } else {
            // Read all Spur object memory segments
            this.oldSpaceBytes = firstSegSize - 16;
            var segmentEnd = pos + firstSegSize,
                addressOffset = 0,
                classPages = null,
                skippedBytes = 0,
                oopAdjust = {};
            while (pos < segmentEnd) {
                while (pos < segmentEnd - 16) {
                    // read objects in segment
                    var objPos = pos,
                        formatAndClass = readWord32(),
                        sizeAndHash = readWord32(),
                        size = sizeAndHash >>> 24;
                    if (size === 255) { // this was the extended size header, read actual header
                        size = formatAndClass;
                        // In 64 bit images the size can actually be 56 bits. LOL. Nope.
                        // if (is64Bit) size += (sizeAndHash & 0x00FFFFFF) * 0x100000000;
                        formatAndClass = readWord32();
                        sizeAndHash = readWord32();
                    }
                    var oop = addressOffset + pos - 8 - headerSize,
                        format = (formatAndClass >>> 24) & 0x1F,
                        classID = formatAndClass & 0x003FFFFF,
                        hash = sizeAndHash & 0x003FFFFF;
                    var bits = readBits(size, format < 10 && classID > 0);
                    // align on 8 bytes, min size 16 bytes
                    pos += is64Bit
                      ? (size < 1 ? 1 - size : 0) * 8
                      : (size < 2 ? 2 - size : size & 1) * 4;
                    // low class ids are internal to Spur
                    if (classID >= 32) {
                        var object = new Squeak.ObjectSpur();
                        object.initFromImage(oop, classID, format, hash);
                        if (prevObj) prevObj.nextObject = object;
                        this.oldSpaceCount++;
                        prevObj = object;
                        //oopMap is from old oops to actual objects
                        oopMap.set(oldBaseAddr + oop, object);
                        //rawBits holds raw content bits for objects
                        rawBits.set(oop, bits);
                        oopAdjust[oop] = skippedBytes;
                        // account for size difference of 32 vs 64 bit oops
                        if (is64Bit) {
                            var overhead = object.overhead64(bits);
                            skippedBytes += overhead.bytes;
                            // OTOH, in 32 bits we need the extra size header sooner
                            // so in some cases 64 bits has 2 words less overhead
                            if (overhead.sizeHeader) {
                                oopAdjust[oop] -= 8;
                                skippedBytes -= 8;
                            }
                        }
                    } else {
                        skippedBytes += pos - objPos;
                        if (classID === 16 && !classPages) classPages = bits;
                        if (classID) oopMap.set(oldBaseAddr + oop, bits);  // used in spurClassTable()
                    }
                }
                if (pos !== segmentEnd - 16) throw Error("invalid segment");
                // last 16 bytes in segment is a bridge object
                var deltaWords = readWord32(),
                    deltaWordsHi = readWord32(),
                    segmentBytes = readWord32(),
                    segmentBytesHi = readWord32();
                //  if segmentBytes is zero, the end of the image has been reached
                if (segmentBytes !== 0) {
                    var deltaBytes = deltaWordsHi & 0xFF000000 ? (deltaWords & 0x00FFFFFF) * 4 : 0;
                    segmentEnd += segmentBytes;
                    addressOffset += deltaBytes;
                    skippedBytes += 16 + deltaBytes;
                    this.oldSpaceBytes += deltaBytes + segmentBytes;
                }
            }
            this.oldSpaceBytes -= skippedBytes;
            this.firstOldObject = oopMap.get(oldBaseAddr);
            this.lastOldObject = object;
            this.lastOldObject.nextObject = null; // Add next object pointer as indicator this is in fact an old object
        }

        var finalizeContext = {
            oopMap: oopMap,
            rawBits: rawBits,
            classPages: classPages,
            specialObjectsOopInt: specialObjectsOopInt,
            littleEndian: littleEndian,
            nativeFloats: nativeFloats,
            is64Bit: is64Bit,
            oopAdjust: oopAdjust,
            oldBaseAddr: oldBaseAddr,
        };
        this._finalizeImageLoad(finalizeContext, thenDo, progressDo);
    },
    _finalizeImageLoad: function(context, thenDo, progressDo, options) {
        this.totalMemory = this.oldSpaceBytes + this.headRoom;
        this.totalMemory = Math.ceil(this.totalMemory / 1000000) * 1000000;
        this._finalizeMemoryPolicyAfterLoad();

        var controller = this._createInstallController(context, {
            finalizeProgressDo: progressDo,
            thenDo: thenDo,
            streaming: options && !!options.streaming,
            scheduler: options && options.scheduler,
        });

        if (!controller.streaming) {
            controller.installAllSync();
        } else if (options && options.activateStreaming !== false) {
            controller.activateStreaming();
        }

        return controller;
    },
    _createInstallController: function(context, options) {
        options = options || {};
        if (this._activeInstallController) {
            this._activeInstallController.updateOptions(options);
            return this._activeInstallController;
        }
        var controller = new Squeak.ImageInstallController(this, context, options);
        this._activeInstallController = controller;
        return controller;
    },
    _finalizeCompatibilityLoad: function(snapshot, thenDo, progressDo) {
        this.compatibilityMode = snapshot && snapshot.format ? snapshot.format : "legacy-64";
        this.compatibilitySnapshot = snapshot || null;
        this.firstOldObject = null;
        this.lastOldObject = null;
        this.specialObjectsArray = null;
        this.oldSpaceCount = snapshot && snapshot.metadata && snapshot.metadata.objects ? snapshot.metadata.objects.total : 0;
        this.oldSpaceBytes = 0;
        this.headerFlags = snapshot && snapshot.metadata ? snapshot.metadata.flags : 0;
        this.savedHeaderWords = [];
        this.totalMemory = this.headRoom;
        this._finalizeMemoryPolicyAfterLoad();
        if (typeof progressDo === "function") progressDo(1);
        if (typeof thenDo === "function") thenDo(snapshot);
    },
    readFromStream: function(streamSource, thenDo, progressDo) {
        if (!streamSource) throw Error("stream source required");
        var descriptor = Squeak.normalizeImageStreamSource(streamSource);
        if (!descriptor || typeof descriptor.iterator !== "object") {
            throw Error("invalid stream source");
        }
        if (!this.headerAudit) this.headerAudit = new ImageHeaderAudit(this.name);
        this.headerAudit.reset(this.name);
        var totalBytes = descriptor.totalBytes;
        var label = totalBytes ? ' (' + totalBytes + ' bytes)' : '';
        console.log('squeak: streaming ' + this.name + label);
        this.startupTime = Date.now();
        var progressAdapter = progressDo ? new Squeak.ImageStreamProgressAdapter(progressDo, {
            totalBytes: totalBytes,
        }) : null;
        var descriptorForLoader = Object.assign({}, descriptor);
        var existingOnProgress = descriptor.onProgress;
        if (progressAdapter) {
            progressAdapter.start();
            descriptorForLoader.onProgress = function(fetched, capacity) {
                if (typeof existingOnProgress === "function") existingOnProgress(fetched, capacity);
                progressAdapter.handleDownload(fetched, capacity);
            };
        }
        var finalizeProgressDo = progressAdapter ? progressAdapter.handleFinalize.bind(progressAdapter) : progressDo;
        var loader = new Squeak.StreamingImageLoader(this, descriptorForLoader, {
            thenDo: thenDo,
            progressAdapter: progressAdapter,
            finalizeProgressDo: finalizeProgressDo,
        });
        var promise = loader.load().then(function(result) {
            if (progressAdapter) progressAdapter.complete();
            return result;
        });
    if (promise && typeof promise.catch === "function") {
        promise = promise.catch(function(error) {
            console.error(error);
            throw error;
        });
    }
    return promise;
    },
    decorateKnownObjects: function() {
        var splObjs = this.specialObjectsArray.pointers;
        splObjs[Squeak.splOb_NilObject].isNil = true;
        splObjs[Squeak.splOb_TrueObject].isTrue = true;
        splObjs[Squeak.splOb_FalseObject].isFalse = true;
        splObjs[Squeak.splOb_ClassFloat].isFloatClass = true;
        if (!this.isSpur) {
            this.compactClasses = this.specialObjectsArray.pointers[Squeak.splOb_CompactClasses].pointers;
            for (var i = 0; i < this.compactClasses.length; i++)
                if (!this.compactClasses[i].isNil)
                    this.compactClasses[i].isCompact = true;
        }
        if (!Number.prototype.sqInstName)
            Object.defineProperty(Number.prototype, 'sqInstName', {
                enumerable: false,
                value: function() { return this.toString() }
            });
    },
    fixCompactOops: function() {
        // instances of compact classes might have been saved with a non-compact header
        // fix their oops here so validation succeeds later
        if (this.isSpur) return;
        var obj = this.firstOldObject,
            adjust = 0;
        while (obj) {
            var hadCompactHeader = obj.hash > 0x0FFFFFFF,
                mightBeCompact = !!obj.sqClass.isCompact;
            if (hadCompactHeader !== mightBeCompact) {
                var isCompact = obj.snapshotSize().header === 0;
                if (hadCompactHeader !== isCompact) {
                    adjust += isCompact ? -4 : 4;
                }
            }
            obj.hash &= 0x0FFFFFFF;
            obj.oop += adjust;
            obj = obj.nextObject;
        }
        this.oldSpaceBytes += adjust;
    },
    fixCompiledMethods: function() {
        // in the 6501 pre-release image, some CompiledMethods
        // do not have the proper class
        if (this.version >= 6502) return;
        var obj = this.firstOldObject,
            compiledMethodClass = this.specialObjectsArray.pointers[Squeak.splOb_ClassCompiledMethod];
        while (obj) {
            if (obj.isMethod()) obj.sqClass = compiledMethodClass;
            obj = obj.nextObject;
        }
    },
    fixSkippedOops: function(oopAdjust) {
        // reading Spur skips some internal objects
        // we adjust the oops of following objects here
        // this is like the compaction phase of our GC
        var obj = this.firstOldObject;
        while (obj) {
            obj.oop -= oopAdjust[obj.oop];
            obj = obj.nextObject;
        }
        // do a sanity check
        obj = this.lastOldObject;
        if (obj.addr() + obj.totalBytes() !== this.oldSpaceBytes)
            throw Error("image size doesn't match object sizes")
    },
    fixPCs: function() {
        // In 64 bits literals take up twice as much space
        // The pc starts after the last literal. Fix it.
        var clsMethodContext = this.specialObjectsArray.pointers[Squeak.splOb_ClassMethodContext],
            pc = Squeak.Context_instructionPointer,
            method = Squeak.Context_method,
            clsBlockClosure = this.specialObjectsArray.pointers[Squeak.splOb_ClassBlockClosure],
            startpc = Squeak.Closure_startpc,
            outerContext = Squeak.Closure_outerContext,
            obj = this.firstOldObject;
        while (obj) {
            if (obj.sqClass === clsMethodContext) {
                obj.pointers[pc] -= obj.pointers[method].pointers.length * 4;
            } else if (obj.sqClass === clsBlockClosure) {
                obj.pointers[startpc] -= obj.pointers[outerContext].pointers[method].pointers.length * 4;
            }
            obj = obj.nextObject;
        }
    },
    ensureFullBlockClosureClass: function(splObs, compactClasses) {
        // Read FullBlockClosure class from compactClasses if not yet present in specialObjectsArray.
        if (splObs.pointers[Squeak.splOb_ClassFullBlockClosure].isNil && compactClasses[38]) {
            splObs.pointers[Squeak.splOb_ClassFullBlockClosure] = compactClasses[38];
        }
    },
},
'garbage collection - full', {
    fullGC: function(reason) {
        // Collect garbage and return first tenured object (to support object enumeration)
        // Old space is a linked list of objects - each object has an "nextObject" reference.
        // New space objects do not have that pointer, they are garbage-collected by JavaScript.
        // But they have an allocation id so the survivors can be ordered on tenure.
        // The "nextObject" references are created by collecting all new objects,
        // sorting them by id, and then linking them into old space.
        this.vm.addMessage("fullGC: " + reason);
        var start = Date.now();
        var previousNew = this.newSpaceCount; // includes young and newly allocated
        var previousOld = this.oldSpaceCount;
        var newObjects = this.markReachableObjects(); // technically these are young objects
        this.removeUnmarkedOldObjects();
        this.appendToOldObjects(newObjects);
        this.youngSpaceBytes = 0;
        this.newSpaceBytes = 0;
        this._syncLowSpaceMonitor();
        this.finalizeWeakReferences();
        this.allocationCount += this.newSpaceCount;
        this.newSpaceCount = 0;
        this.youngSpaceCount = 0;
        this.hasNewInstances = {};
        this.gcCount++;
        var durationMs = Date.now() - start;
        this.gcMilliseconds += durationMs;
        var delta = previousOld - this.oldSpaceCount; // absolute change
        var survivingNew = newObjects.length;
        var survivingOld = this.oldSpaceCount - survivingNew;
        var gcedNew = previousNew - survivingNew;
        var gcedOld = previousOld - survivingOld;
        console.log("Full GC (" + reason + "): " + durationMs + " ms;" +
            " before: " + previousOld.toLocaleString() + " old objects;" +
            " allocated " + previousNew.toLocaleString() + " new;" +
            " surviving " + survivingOld.toLocaleString() + " old;" +
            " tenuring " + survivingNew.toLocaleString() + " new;" +
            " gc'ed " + gcedOld.toLocaleString() + " old and " + gcedNew.toLocaleString() + " new;" +
            " total now: " + this.oldSpaceCount.toLocaleString() + " (" + (delta > 0 ? "+" : "") + delta.toLocaleString() + ", "
            + this.oldSpaceBytes.toLocaleString() + " bytes)"
            );

        if (this.vm && this.vm.executionProfiler && typeof this.vm.executionProfiler.recordGC === "function") {
            try {
                this.vm.executionProfiler.recordGC({
                    kind: "full",
                    reason: reason || null,
                    durationMs: durationMs,
                    stats: {
                        previousNew: previousNew,
                        previousOld: previousOld,
                        survivingNew: survivingNew,
                        survivingOld: survivingOld,
                        gcedNew: gcedNew,
                        gcedOld: gcedOld
                    }
                });
            } catch (_) {}
        }

        return newObjects.length > 0 ? newObjects[0] : null;
    },
    gcRoots: function() {
        // the roots of the system
        this.vm.storeContextRegisters();        // update active context
        return [this.specialObjectsArray, this.vm.activeContext];
    },
    markReachableObjects: function() {
        // FullGC: Visit all reachable objects and mark them.
        // Return surviving new objects (young objects to be tenured).
        // Contexts are handled specially: they have garbage beyond the stack pointer
        // which must not be traced, and is cleared out here
        // In weak objects, only the inst vars are traced
        var todo = this.gcRoots();
        var newObjects = [];
        this.weakObjects = [];
        while (todo.length > 0) {
            var object = todo.pop();
            if (object.mark) continue;    // objects are added to todo more than once
            if (object.oop < 0)           // it's a new object
                newObjects.push(object);
            object.mark = true;           // mark it
            if (!object.sqClass.mark)     // trace class if not marked
                todo.push(object.sqClass);
            var body = object.pointers;
            if (body) {                   // trace all unmarked pointers
                var n = body.length;
                if (object.isWeak()) {
                    n = object.sqClass.classInstSize();     // do not trace weak fields
                    this.weakObjects.push(object);
                }
                if (this.vm.isContext(object)) {            // contexts have garbage beyond SP
                    n = object.contextSizeWithStack();
                    for (var i = n; i < body.length; i++)   // clean up that garbage
                        body[i] = this.vm.nilObj;
                }
                for (var i = 0; i < n; i++)
                    if (typeof body[i] === "object" && !body[i].mark)      // except immediates
                        todo.push(body[i]);
                // Note: "immediate" character objects in Spur always stay marked
            }
        }
        // pre-spur sort by oop to preserve creation order
        return this.isSpur ? newObjects : newObjects.sort(function(a,b){return b.oop - a.oop});
    },
    removeUnmarkedOldObjects: function() {
        // FullGC: Unlink unmarked old objects from the nextObject linked list
        // Reset marks of remaining objects, and adjust their oops
        // Set this.lastOldObject to last old object
        var removedCount = 0,
            removedBytes = 0,
            obj = this.firstOldObject;
        obj.mark = false; // we know the first object (nil) was marked
        while (true) {
            var next = obj.nextObject;
            if (!next) {// we're done
                this.lastOldObject = obj;
                this.lastOldObject.nextObject = null; // Add next object pointer as indicator this is in fact an old object
                this.oldSpaceBytes -= removedBytes;
                this.oldSpaceCount -= removedCount;
                return;
            }
            // reset partial GC flag
            if (next.dirty) next.dirty = false;
            // if marked, continue with next object
            if (next.mark) {
                obj = next;
                obj.mark = false;           // unmark for next GC
                obj.oop -= removedBytes;    // compact oops
            } else { // otherwise, remove it
                var corpse = next;
                obj.nextObject = corpse.nextObject;     // drop from old-space list
                corpse.oop = -(++this.newSpaceCount);   // move to new-space for finalizing
                removedBytes += corpse.totalBytes();
                removedCount++;
                //console.log("removing " + removedCount + " " + removedBytes + " " + corpse.totalBytes() + " " + corpse.toString())
            }
        }
    },
    appendToOldObjects: function(newObjects) {
        // FullGC: append new objects to linked list of old objects
        // and unmark them
        var oldObj = this.lastOldObject;
        //var oldBytes = this.oldSpaceBytes;
        for (var i = 0; i < newObjects.length; i++) {
            var newObj = newObjects[i];
            newObj.mark = false;
            this.oldSpaceBytes = newObj.setAddr(this.oldSpaceBytes);     // add at end of memory
            oldObj.nextObject = newObj;
            oldObj = newObj;
            //console.log("tenuring " + (i+1) + " " + (this.oldSpaceBytes - oldBytes) + " " + newObj.totalBytes() + " " + newObj.toString());
        }
        oldObj.nextObject = null;   // might have been in young space
        this.lastOldObject = oldObj;
        this.lastOldObject.nextObject = null; // Add next object pointer as indicator this is in fact an old object
        this.oldSpaceCount += newObjects.length;
        this.gcTenured += newObjects.length;
        this.youngSpaceBytes = 0;
        this.newSpaceBytes = 0;
        this._syncLowSpaceMonitor();
    },
    tenureIfYoung: function(object) {
        if (object.oop < 0) {
            this.appendToOldObjects([object]);
        }
    },
    finalizeWeakReferences: function() {
        // nil out all weak fields that did not survive GC
        var weakObjects = this.weakObjects;
        this.weakObjects = null;
        for (var o = 0; o < weakObjects.length; o++) {
            var weakObj = weakObjects[o],
                pointers = weakObj.pointers,
                firstWeak = weakObj.sqClass.classInstSize(),
                finalized = false;
            for (var i = firstWeak; i < pointers.length; i++) {
                if (pointers[i].oop < 0) {    // ref is not in old-space
                    pointers[i] = this.vm.nilObj;
                    finalized = true;
                }
            }
            if (finalized) {
                this.vm.pendingFinalizationSignals++;
                if (firstWeak >= 2) { // check if weak obj is a finalizer item
                    var list = weakObj.pointers[Squeak.WeakFinalizerItem_list];
                    if (list.sqClass == this.vm.specialObjects[Squeak.splOb_ClassWeakFinalizer]) {
                        // add weak obj as first in the finalization list
                        var items = list.pointers[Squeak.WeakFinalizationList_first];
                        weakObj.pointers[Squeak.WeakFinalizerItem_next] = items;
                        list.pointers[Squeak.WeakFinalizationList_first] = weakObj;
                    }
                }
            }
        };
        if (this.vm.pendingFinalizationSignals > 0) {
            this.vm.forceInterruptCheck();                      // run finalizer asap
        }
    },
},
'garbage collection - partial', {
    partialGC: function(reason) {
        // make a linked list of young objects
        // and finalize weak refs
        if (this._partialGCInProgress) return null;
        this._partialGCInProgress = true;
        this.vm.addMessage("partialGC: " + reason);
        try {
            var start = Date.now();
            var previous = this.newSpaceCount;
            var young = this.findYoungObjects();
            this.appendToYoungSpace(young);
            this.finalizeWeakReferences();
            this.cleanupYoungSpace(young);
            this.allocationCount += this.newSpaceCount - young.length;
            this.youngSpaceCount = young.length;
            this.newSpaceCount = this.youngSpaceCount;
            var youngBytes = 0;
            for (var i = 0; i < young.length; i++) {
                youngBytes += young[i].totalBytes();
            }
            this.youngSpaceBytes = youngBytes;
            this.newSpaceBytes = youngBytes;
            this.pgcCount++;
            var durationMs = Date.now() - start;
            this.pgcMilliseconds += durationMs;
            console.log("Partial GC (" + reason+ "): " + durationMs + " ms, " +
                "found " + this.youngRootsCount.toLocaleString() + " roots in " + this.oldSpaceCount.toLocaleString() + " old, " +
                "kept " + this.youngSpaceCount.toLocaleString() + " young (" + (previous - this.youngSpaceCount).toLocaleString() + " gc'ed)");
            this._syncLowSpaceMonitor();
            if (this.vm && this.vm.executionProfiler && typeof this.vm.executionProfiler.recordGC === "function") {
                try {
                    this.vm.executionProfiler.recordGC({
                        kind: "partial",
                        reason: reason || null,
                        durationMs: durationMs,
                        stats: {
                            previousNew: previous,
                            survivingNew: this.youngSpaceCount,
                            gcedNew: previous - this.youngSpaceCount,
                            youngRoots: this.youngRootsCount
                        }
                    });
                } catch (_) {}
            }
            return young[0];
        } finally {
            this._partialGCInProgress = false;
        }
    },
    youngRoots: function() {
        // PartialGC: Find new objects directly pointed to by old objects.
        // For speed we only scan "dirty" objects that have been written to
        var roots = this.gcRoots().filter(function(obj){return obj.oop < 0;}),
            object = this.firstOldObject;
        while (object) {
            if (object.dirty) {
                var body = object.pointers,
                    dirty = false;
                for (var i = 0; i < body.length; i++) {
                    var child = body[i];
                    if (typeof child === "object" && child.oop < 0) { // if child is new
                        roots.push(child);
                        dirty = true;
                    }
                }
                if (!dirty) object.dirty = false;
            }
            object = object.nextObject;
        }
        return roots;
    },
    findYoungObjects: function() {
        // PartialGC: find new objects transitively reachable from old objects
        var todo = this.youngRoots(),     // direct pointers from old space
            newObjects = [];
        this.youngRootsCount = todo.length;
        this.weakObjects = [];
        while (todo.length > 0) {
            var object = todo.pop();
            if (object.mark) continue;    // objects are added to todo more than once
            newObjects.push(object);
            object.mark = true;           // mark it
            if (object.sqClass.oop < 0)   // trace class if new
                todo.push(object.sqClass);
            var body = object.pointers;
            if (body) {                   // trace all unmarked pointers
                var n = body.length;
                if (object.isWeak()) {
                    n = object.sqClass.classInstSize();     // do not trace weak fields
                    this.weakObjects.push(object);
                }
                if (this.vm.isContext(object)) {            // contexts have garbage beyond SP
                    n = object.contextSizeWithStack();
                    for (var i = n; i < body.length; i++)   // clean up that garbage
                        body[i] = this.vm.nilObj;
                }
                for (var i = 0; i < n; i++) {
                    var child = body[i];
                    if (typeof child === "object" && child.oop < 0)
                        todo.push(child);
                }
            }
        }
        // pre-spur sort by oop to preserve creation order
        return this.isSpur ? newObjects : newObjects.sort(function(a,b){return b.oop - a.oop});
    },
    appendToYoungSpace: function(objects) {
        // PartialGC: link new objects into young list
        // and give them positive oops temporarily so finalization works
        var tempOop = this.lastOldObject.oop + 1;
        for (var i = 0; i < objects.length; i++) {
            var obj = objects[i];
            if (this.hasNewInstances[obj.oop]) {
                delete this.hasNewInstances[obj.oop];
                this.hasNewInstances[tempOop] = true;
            }
            obj.oop = tempOop;
            obj.nextObject = objects[i + 1];
            tempOop++;
        }
    },
    cleanupYoungSpace: function(objects) {
        // PartialGC: After finalizing weak refs, make oops
        // in young space negative again
        var obj = objects[0],
            youngOop = -1;
        while (obj) {
            if (this.hasNewInstances[obj.oop]) {
                delete this.hasNewInstances[obj.oop];
                this.hasNewInstances[youngOop] = true;
            }
            obj.oop = youngOop;
            obj.mark = false;
            obj = obj.nextObject;
            youngOop--;
        }
    },
},
'creating', {
    registerObject: function(obj) {
        // We don't actually register the object yet, because that would prevent
        // it from being garbage-collected by the Javascript collector
        obj.oop = -(++this.newSpaceCount); // temp oops are negative. Real oop assigned when surviving GC
        this.lastHash = (13849 + (27181 * this.lastHash)) & 0xFFFFFFFF;
        return this.lastHash & 0xFFF;
    },
    registerObjectSpur: function(obj) {
        // We don't actually register the object yet, because that would prevent
        // it from being garbage-collected by the Javascript collector
        obj.oop = -(++this.newSpaceCount); // temp oops are negative. Real oop assigned when surviving GC
        return 0; // actual hash created on demand
    },
    instantiateClass: function(aClass, indexableSize, filler) {
        var newObject = new (aClass.classInstProto()); // Squeak.Object
        var hash = this.registerObject(newObject);
        newObject.initInstanceOf(aClass, indexableSize, hash, filler);
        this.hasNewInstances[aClass.oop] = true;   // need GC to find all instances
        this._recordAllocation(newObject);
        return newObject;
    },
    clone: function(object) {
        var newObject = new (object.sqClass.classInstProto()); // Squeak.Object
        var hash = this.registerObject(newObject);
        newObject.initAsClone(object, hash);
        this.hasNewInstances[newObject.sqClass.oop] = true;   // need GC to find all instances
        this._recordAllocation(newObject);
        return newObject;
    },
},
'memory', {
    _finalizeMemoryPolicyAfterLoad: function() {
        if (!this.memoryPolicy) return;
        var limit = deriveYoungSpaceLimit(this.totalMemory, this.memoryPolicy);
        var availableHeadroom = this.totalMemory - this.oldSpaceBytes;
        if (!isFinite(availableHeadroom) || availableHeadroom < 0) availableHeadroom = 0;
        if (limit > availableHeadroom) limit = availableHeadroom;
        this.memoryPolicy.newSpaceLimit = limit > 0 ? limit : 0;
    },
    _applyHeadroomAdjustment: function(bytes) {
        if (!this.memoryPolicy) return false;
        if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) return false;
        var target = Math.round(bytes);
        if (target < 0) target = 0;
        if (target === this.headRoom) return false;
        this.headRoom = target;
        this.memoryPolicy.headroomBytes = target;
        this.totalMemory = this.oldSpaceBytes + target;
        this._finalizeMemoryPolicyAfterLoad();
        this._syncLowSpaceMonitor();
        return true;
    },
    _estimateFreeBytes: function() {
        var used = this.oldSpaceBytes + this.youngSpaceBytes + this.newSpaceBytes;
        var free = this.totalMemory - used;
        return free > 0 ? free : 0;
    },
    _syncLowSpaceMonitor: function() {
        if (this.vm && typeof this.vm.signalLowSpaceIfNecessary === "function") {
            this.vm.signalLowSpaceIfNecessary(this._estimateFreeBytes());
        }
    },
    _trackNewAllocationBytes: function(bytes) {
        if (!bytes || !isFinite(bytes) || bytes <= 0) return;
        this.newSpaceBytes += bytes;
        this._syncLowSpaceMonitor();
        this._maybeTriggerPartialGC("allocation");
    },
    _maybeTriggerPartialGC: function(reason) {
        if (!this.vm || this._partialGCInProgress) return;
        var policy = this.memoryPolicy || {};
        var limit = policy.newSpaceLimit || 0;
        var shouldCollect = false;
        if (limit > 0 && this.newSpaceBytes >= limit) {
            shouldCollect = true;
        } else {
            var lowSpace = (typeof policy.lowSpaceBytes === "number" && isFinite(policy.lowSpaceBytes)) ? policy.lowSpaceBytes : 0;
            if (lowSpace > 0) {
                var available = this.totalMemory - (this.oldSpaceBytes + this.youngSpaceBytes);
                if (this.newSpaceBytes + lowSpace > available) {
                    shouldCollect = true;
                }
            }
        }
        if (shouldCollect) {
            this._triggerPartialGC(reason || "memory-budget");
        }
    },
    _triggerPartialGC: function(reason) {
        if (!this.vm || typeof this.partialGC !== "function") return null;
        return this.partialGC(reason);
    },
    _recordAllocation: function(object) {
        if (!object || typeof object.totalBytes !== "function") return;
        var size = object.totalBytes();
        if (size && isFinite(size) && size > 0) {
            this._trackNewAllocationBytes(size);
        }
    },
    _collectHostMemoryStats: function() {
        var stats = {};
        var hasStats = false;
        if (typeof performance === "object" && performance && typeof performance.memory === "object" && performance.memory) {
            var memory = performance.memory;
            if (typeof memory.usedJSHeapSize === "number" && isFinite(memory.usedJSHeapSize)) {
                stats.usedJSHeapSize = memory.usedJSHeapSize;
                hasStats = true;
            }
            if (typeof memory.totalJSHeapSize === "number" && isFinite(memory.totalJSHeapSize)) {
                stats.totalJSHeapSize = memory.totalJSHeapSize;
                hasStats = true;
            }
            if (typeof memory.jsHeapSizeLimit === "number" && isFinite(memory.jsHeapSizeLimit)) {
                stats.jsHeapSizeLimit = memory.jsHeapSizeLimit;
                hasStats = true;
            }
        }
        if (typeof navigator === "object" && navigator && typeof navigator.deviceMemory === "number" && isFinite(navigator.deviceMemory)) {
            stats.deviceMemory = navigator.deviceMemory;
            hasStats = true;
        }
        return hasStats ? stats : null;
    },
    captureMemorySnapshot: function(reason) {
        var total = typeof this.totalMemory === "number" && isFinite(this.totalMemory) ? this.totalMemory : 0;
        var free = this._estimateFreeBytes();
        if (!isFinite(free) || free < 0) free = 0;
        if (!isFinite(total) || total < 0) total = 0;
        var oldBytes = typeof this.oldSpaceBytes === "number" && isFinite(this.oldSpaceBytes) ? this.oldSpaceBytes : 0;
        var youngBytes = typeof this.youngSpaceBytes === "number" && isFinite(this.youngSpaceBytes) ? this.youngSpaceBytes : 0;
        var newBytes = typeof this.newSpaceBytes === "number" && isFinite(this.newSpaceBytes) ? this.newSpaceBytes : 0;
        var policy = this.memoryPolicy || {};
        var policySnapshot = {
            headroomBytes: typeof policy.headroomBytes === "number" && isFinite(policy.headroomBytes) ? policy.headroomBytes : null,
            lowSpaceBytes: typeof policy.lowSpaceBytes === "number" && isFinite(policy.lowSpaceBytes) ? policy.lowSpaceBytes : null,
            newSpaceLimit: typeof policy.newSpaceLimit === "number" && isFinite(policy.newSpaceLimit) ? policy.newSpaceLimit : null,
            youngSpaceRatio: typeof policy.youngSpaceRatio === "number" && isFinite(policy.youngSpaceRatio) ? policy.youngSpaceRatio : null,
            explicitYoungBytes: typeof policy.explicitYoungBytes === "number" && isFinite(policy.explicitYoungBytes) ? policy.explicitYoungBytes : null,
        };
        var used = total - free;
        if (!isFinite(used) || used < 0) used = 0;
        return {
            timestamp: Date.now(),
            reason: reason || "manual",
            totalBytes: total,
            oldSpaceBytes: oldBytes,
            youngSpaceBytes: youngBytes,
            newSpaceBytes: newBytes,
            freeBytes: free,
            usedBytes: used,
            youngAllocatedBytes: youngBytes + newBytes,
            policy: policySnapshot,
            host: this._collectHostMemoryStats(),
        };
    },
    memorySnapshotToArray: function(snapshot) {
        var snap = snapshot || this.captureMemorySnapshot("array");
        var policy = snap.policy || {};
        var host = snap.host || {};
        function numberOrNull(value) {
            return (typeof value === "number" && isFinite(value)) ? value : null;
        }
        return [
            snap.timestamp || Date.now(),
            numberOrNull(snap.totalBytes) || 0,
            numberOrNull(snap.oldSpaceBytes) || 0,
            numberOrNull(snap.youngSpaceBytes) || 0,
            numberOrNull(snap.newSpaceBytes) || 0,
            numberOrNull(snap.usedBytes) || 0,
            numberOrNull(snap.freeBytes) || 0,
            numberOrNull(snap.youngAllocatedBytes) || 0,
            numberOrNull(policy.headroomBytes),
            numberOrNull(policy.lowSpaceBytes),
            numberOrNull(policy.newSpaceLimit),
            numberOrNull(policy.youngSpaceRatio),
            numberOrNull(policy.explicitYoungBytes),
            numberOrNull(host.usedJSHeapSize),
            numberOrNull(host.totalJSHeapSize),
            numberOrNull(host.jsHeapSizeLimit),
            numberOrNull(host.deviceMemory),
            snap.reason || "",
        ];
    },
    latestMemorySnapshotArray: function() {
        var telemetry = this.memoryTelemetry;
        if (telemetry && typeof telemetry.latest === "function") {
            var latest = telemetry.latest();
            if (latest) return this.memorySnapshotToArray(latest);
        }
        return this.memorySnapshotToArray(this.captureMemorySnapshot("on-demand"));
    },
    memoryTelemetryHistoryArrays: function() {
        var telemetry = this.memoryTelemetry;
        if (telemetry && Array.isArray(telemetry.history) && telemetry.history.length) {
            var image = this;
            return telemetry.history.map(function(entry) {
                return image.memorySnapshotToArray(entry);
            });
        }
        return [this.memorySnapshotToArray(this.captureMemorySnapshot("on-demand"))];
    },
},
'operations', {
    bulkBecome: function(fromArray, toArray, twoWay, copyHash) {
        if (!fromArray)
            return !toArray;
        var n = fromArray.length;
        if (n !== toArray.length)
            return false;
        // need to visit all objects: find young objects now
        // so oops do not change later
        var firstYoungObject = null;
        if (this.newSpaceCount > 0)
            firstYoungObject = this.partialGC("become");  // does update context
        else
            this.vm.storeContextRegisters();    // still need to update active context
        // obj.oop used as dict key here is why we store them
        // rather than just calculating at image snapshot time
        var mutations = {};
        for (var i = 0; i < n; i++) {
            var obj = fromArray[i];
            if (!obj.sqClass) return false;  //non-objects in from array
            if (mutations[obj.oop]) return false; //repeated oops in from array
            else mutations[obj.oop] = toArray[i];
        }
        if (twoWay) for (var i = 0; i < n; i++) {
            var obj = toArray[i];
            if (!obj.sqClass) return false;  //non-objects in to array
            if (mutations[obj.oop]) return false; //repeated oops in to array
            else mutations[obj.oop] = fromArray[i];
        }
        // unless copyHash is false, make hash stay with the reference, not with the object
        if (copyHash) for (var i = 0; i < n; i++) {
            if (!toArray[i].sqClass) return false; //cannot change hash of non-objects
            var fromHash = fromArray[i].hash;
            fromArray[i].hash = toArray[i].hash;
            toArray[i].hash = fromHash;
            // Spur class table is not part of the object memory in SqueakJS
            // so won't be updated below, we have to update it manually
            if (this.isSpur && this.classTable[fromHash] === fromArray[i]) {
                this.classTable[fromHash] = toArray[i];
            }
        }
        // temporarily append young objects to old space
        this.lastOldObject.nextObject = firstYoungObject;
        // Now, for every object...
        var obj = this.firstOldObject;
        while (obj) {
            // mutate the class
            var mut = mutations[obj.sqClass.oop];
            if (mut) {
                obj.sqClass = mut;
                if (mut.oop < 0) obj.dirty = true;
            }
            // and mutate body pointers
            var body = obj.pointers;
            if (body) for (var j = 0; j < body.length; j++) {
                mut = mutations[body[j].oop];
                if (mut) {
                    body[j] = mut;
                    if (mut.oop < 0) obj.dirty = true;
                }
            }
            obj = obj.nextObject;
        }
        // separate old / young space again
        this.lastOldObject.nextObject = null;
        this.vm.flushMethodCacheAfterBecome(mutations);
        return true;
    },
    objectAfter: function(obj) {
        // if this was the last old object, continue with young objects
        return obj.nextObject || this.nextObjectWithGC("nextObject", obj);
    },
    someInstanceOf: function(clsObj) {
        var obj = this.firstOldObject;
        while (obj) {
            if (obj.sqClass === clsObj)
                return obj;
            obj = obj.nextObject || this.nextObjectWithGCFor(obj, clsObj);
        }
        return null;
    },
    nextInstanceAfter: function(obj) {
        var clsObj = obj.sqClass;
        while (true) {
            obj = obj.nextObject || this.nextObjectWithGCFor(obj, clsObj);
            if (!obj) return null;
            if (obj.sqClass === clsObj)
                return obj;
        }
    },
    nextObjectWithGC: function(reason, obj) {
        // obj is either the last object in old space (after enumerating it)
        // or young space (after enumerating the list returned by partialGC)
        // or a random new object
        var limit = obj.oop > 0 ? 0 : this.youngSpaceCount;
        if (this.newSpaceCount <= limit) return null; // no more objects
        if (obj.oop < 0) this.fullGC(reason); // found a non-young new object
        return this.partialGC(reason);
    },
    nextObjectWithGCFor: function(obj, clsObj) {
        // this is nextObjectWithGC but avoids GC if no instances in new space
        if (!this.hasNewInstances[clsObj.oop]) return null;
        return this.nextObjectWithGC("instance of " + clsObj.className(), obj);
    },
    allInstancesOf: function(clsObj) {
        var obj = this.firstOldObject,
            result = [];
        while (obj) {
            if (obj.sqClass === clsObj) result.push(obj);
            obj = obj.nextObject || this.nextObjectWithGCFor(obj, clsObj);
        }
        return result;
    },
    writeToBuffer: function() {
        var headerSize = 64,
            data = new DataView(new ArrayBuffer(headerSize + this.oldSpaceBytes)),
            pos = 0;
        var writeWord = function(word) {
            data.setUint32(pos, word);
            pos += 4;
        };
        writeWord(this.formatVersion()); // magic number
        writeWord(headerSize);
        writeWord(this.oldSpaceBytes); // end of memory
        writeWord(this.firstOldObject.addr()); // base addr (0)
        writeWord(this.objectToOop(this.specialObjectsArray));
        writeWord(this.lastHash);
        writeWord((800 << 16) + 600);  // window size
        while (pos < headerSize)
            writeWord(0);
        // objects
        var obj = this.firstOldObject,
            n = 0;
        while (obj) {
            pos = obj.writeTo(data, pos, this);
            obj = obj.nextObject;
            n++;
        }
        if (pos !== data.byteLength) throw Error("wrong image size");
        if (n !== this.oldSpaceCount) throw Error("wrong object count");
        return data.buffer;
    },
    objectToOop: function(obj) {
        // unsigned word for use in snapshot
        if (typeof obj ===  "number")
            return obj << 1 | 1; // add tag bit
        if (obj.oop < 0) throw Error("temporary oop");
        return obj.oop;
    },
    bytesLeft: function() {
        return this._estimateFreeBytes();
    },
    formatVersion: function() {
        return this.isSpur ? 6521 : this.hasClosures ? 6504 : 6502;
    },
    segmentVersion: function() {
        // a more complex version that tells both the word reversal and the endianness
        // of the machine it came from.  Low half of word is 6502.  Top byte is top byte
        // of #doesNotUnderstand: ($d on big-endian or $s on little-endian).
        // In SqueakJS we write non-Spur images and segments as big-endian, Spur as little-endian
        // (TODO: write non-Spur as little-endian too since that matches all modern platforms)
        var dnuFirstWord = this.isSpur ? 'seod' : 'does';
        return this.formatVersion() | (dnuFirstWord.charCodeAt(0) << 24);
    },
    storeImageSegment: function(segmentWordArray, outPointerArray, arrayOfRoots) {
        // This primitive will store a binary image segment (in the same format as the Squeak image file) of the receiver and every object in its proper tree of subParts (ie, that is not refered to from anywhere else outside the tree).  Note: all elements of the receiver are treated as roots determining the extent of the tree.  All pointers from within the tree to objects outside the tree will be copied into the array of outpointers.  In their place in the image segment will be an oop equal to the offset in the outpointer array (the first would be 4). but with the high bit set.
        // The primitive expects the array and wordArray to be more than adequately long.  In this case it returns normally, and truncates the two arrays to exactly the right size.  If either array is too small, the primitive will fail, but in no other case.

        // use a DataView to access the segment as big-endian words
        var segment = new DataView(segmentWordArray.words.buffer),
            pos = 0, // write position in segment in bytes
            outPointers = outPointerArray.pointers,
            outPos = 0; // write position in outPointers in words

        // write header
        segment.setUint32(pos, this.segmentVersion()); pos += 4;

        // we don't want to deal with new space objects
        this.fullGC("storeImageSegment");

        // First mark the root array and all root objects
        arrayOfRoots.mark = true;
        for (var i = 0; i < arrayOfRoots.pointers.length; i++)
            if (typeof arrayOfRoots.pointers[i] === "object")
                arrayOfRoots.pointers[i].mark = true;

        // Then do a mark pass over all objects. This will stop at our marked roots,
        // thus leaving our segment unmarked in their shadow
        this.markReachableObjects();

        // Finally unmark the rootArray and all root objects
        arrayOfRoots.mark = false;
        for (var i = 0; i < arrayOfRoots.pointers.length; i++)
            if (typeof arrayOfRoots.pointers[i] === "object")
                arrayOfRoots.pointers[i].mark = false;

        // helpers for mapping objects to segment oops
        var segmentOops = {}, // map from object oop to segment oop
            todo = []; // objects that were added to the segment but still need to have their oops mapped

        // if an object does not yet have a segment oop, write it to the segment or outPointers
        function addToSegment(object) {
            var oop = segmentOops[object.oop];
            if (!oop) {
                if (object.mark) {
                    // object is outside segment, add to outPointers
                    if (outPos >= outPointers.length) return 0; // fail if outPointerArray is too small
                    oop = 0x80000004 + outPos * 4;
                    outPointers[outPos++] = object;
                    // no need to mark outPointerArray dirty, all objects are in old space
                } else {
                    // add object to segment.
                    if (pos + object.totalBytes() > segment.byteLength) return 0; // fail if segment is too small
                    oop = pos + (object.snapshotSize().header + 1) * 4; // addr plus extra headers + base header
                    pos = object.writeTo(segment, pos, this);
                    // the written oops inside the object still need to be mapped to segment oops
                    todo.push(object);
                }
                segmentOops[object.oop] = oop;
            }
            return oop;
        }
        addToSegment = addToSegment.bind(this);

        // if we have to bail out, clean up what we modified
        function cleanUp() {
            // unmark all objects
            var obj = this.firstOldObject;
            while (obj) {
                obj.mark = false;
                obj = obj.nextObject;
            }
            // forget weak objects collected by markReachableObjects()
            this.weakObjects = null;
            // return code for failure
            return false;
        }
        cleanUp = cleanUp.bind(this);

        // All external objects, and only they, are now marked.
        // Write the array of roots into the segment
        addToSegment(arrayOfRoots);

        // Now fix the oops inside written objects.
        // This will add more objects to the segment (if they are unmarked),
        // or to outPointers (if they are marked).
        while (todo.length > 0) {
            var obj = todo.shift(),
                oop = segmentOops[obj.oop],
                headerSize = obj.snapshotSize().header,
                objBody = obj.pointers,
                hasClass = headerSize > 0;
            if (hasClass) {
                var classOop = addToSegment(obj.sqClass);
                if (!classOop) return cleanUp(); // ran out of space
                var headerType = headerSize === 1 ? Squeak.HeaderTypeClass : Squeak.HeaderTypeSizeAndClass;
                segment.setUint32(oop - 8, classOop | headerType);
            }
            if (!objBody) continue;
            for (var i = 0; i < objBody.length; i++) {
                var child = objBody[i];
                if (typeof child !== "object") continue;
                var childOop = addToSegment(child);
                if (!childOop) return cleanUp(); // ran out of space
                segment.setUint32(oop + i * 4, childOop);
            }
        }

        // Truncate image segment and outPointerArray to actual size
        var obj = segmentWordArray.oop < outPointerArray.oop ? segmentWordArray : outPointerArray,
            removedBytes = 0;
        while (obj) {
            obj.oop -= removedBytes;
            if (obj === segmentWordArray) {
                removedBytes += (obj.words.length * 4) - pos;
                obj.words = new Uint32Array(obj.words.buffer.slice(0, pos));
            } else if (obj === outPointerArray) {
                removedBytes += (obj.pointers.length - outPos) * 4;
                obj.pointers.length = outPos;
            }
            obj = obj.nextObject;
        }
        this.oldSpaceBytes -= removedBytes;

        // unmark all objects etc
        cleanUp();

        return true;
    },
    loadImageSegment: function(segmentWordArray, outPointerArray) {
        // The C VM creates real objects from the segment in-place.
        // We do the same, inserting the new objects directly into old-space
        // between segmentWordArray and its following object (endMarker).
        // This only increases oldSpaceCount but not oldSpaceBytes.
        // The code below is almost the same as readFromBuffer() ... should unify
        if (segmentWordArray.words.length === 1) {
            // segment already loaded
            return segmentWordArray.nextObject;
        }
        var segment = new DataView(segmentWordArray.words.buffer),
            littleEndian = false,
            nativeFloats = false,
            pos = 0;
        var readWord = function() {
            var word = segment.getUint32(pos, littleEndian);
            pos += 4;
            return word;
        };
        var readBits = function(nWords, format) {
            if (format < 5) { // pointers (do endian conversion)
                var oops = [];
                while (oops.length < nWords)
                    oops.push(readWord());
                return oops;
            } else { // words (no endian conversion yet)
                var bits = new Uint32Array(segment.buffer, pos, nWords);
                pos += nWords * 4;
                return bits;
            }
        };
        // check version
        var version = readWord();
        if (version & 0xFFFF !== 6502) {
            littleEndian = true; pos = 0;
            version = readWord();
            if (version & 0xFFFF !== 6502) {
                console.error("image segment format not supported");
                return null;
            }
        }
        // read objects
        this.tenureIfYoung(segmentWordArray);
        var prevObj = segmentWordArray,
            endMarker = prevObj.nextObject,
            oopOffset = segmentWordArray.oop,
            oopMap = new Map(),
            rawBits = new Map();
        while (pos < segment.byteLength) {
            var nWords = 0,
                classInt = 0,
                header = readWord();
            switch (header & Squeak.HeaderTypeMask) {
                case Squeak.HeaderTypeSizeAndClass:
                    nWords = header >>> 2;
                    classInt = readWord();
                    header = readWord();
                    break;
                case Squeak.HeaderTypeClass:
                    classInt = header - Squeak.HeaderTypeClass;
                    header = readWord();
                    nWords = (header >>> 2) & 63;
                    break;
                case Squeak.HeaderTypeShort:
                    nWords = (header >>> 2) & 63;
                    classInt = (header >>> 12) & 31; //compact class index
                    //Note classInt<32 implies compact class index
                    break;
                case Squeak.HeaderTypeFree:
                    throw Error("Unexpected free block");
            }
            nWords--;  //length includes base header which we have already read
            var oop = pos, //0-rel byte oop of this object (base header)
                format = (header>>>8) & 15,
                hash = (header>>>17) & 4095,
                bits = readBits(nWords, format);

            var object = new Squeak.Object();
            object.initFromImage(oop + oopOffset, classInt, format, hash);
            prevObj.nextObject = object;
            this.oldSpaceCount++;
            prevObj = object;
            oopMap.set(oop, object);
            rawBits.set(oop + oopOffset, bits);
        }
        object.nextObject = endMarker;
        // add outPointers to oopMap
        for (var i = 0; i < outPointerArray.pointers.length; i++)
            oopMap.set(0x80000004 + i * 4, outPointerArray.pointers[i]);
        // add compactClasses to oopMap
        var compactClasses = this.specialObjectsArray.pointers[Squeak.splOb_CompactClasses].pointers,
            fakeClsOop = 0, // make up a compact-classes array with oops, as if loading an image
            compactClassOops = compactClasses.map(function(cls) {
                oopMap.set(--fakeClsOop, cls); return fakeClsOop; });
        // truncate segmentWordArray array to one element
        segmentWordArray.words = new Uint32Array([segmentWordArray.words[0]]);
        delete segmentWordArray.uint8Array; // in case it was a view onto words
        // map objects using oopMap
        var roots = segmentWordArray.nextObject,
            floatClass = this.specialObjectsArray.pointers[Squeak.splOb_ClassFloat],
            obj = roots;
        do {
            obj.installFromImage(oopMap, rawBits, compactClassOops, floatClass, littleEndian, nativeFloats);
            obj = obj.nextObject;
        } while (obj !== endMarker);
        return roots;
    },
},
'spur support',
{
    initSpurOverrides: function() {
        this.registerObject = this.registerObjectSpur;
        this.writeToBuffer = this.writeToBufferSpur;
        this.storeImageSegment = this.storeImageSegmentSpur;
        this.loadImageSegment = this.loadImageSegmentSpur;
    },
    spurClassTable: function(oopMap, rawBits, classPages, splObjs) {
        var classes = {},
            nil = this.firstOldObject;
        // read class table pages
        for (var p = 0; p < 4096; p++) {
            var page = oopMap.get(classPages[p]);
            if (page.oop) page = rawBits.get(page.oop); // page was not properly hidden
            if (page.length === 1024) for (var i = 0; i < 1024; i++) {
                var entry = oopMap.get(page[i]);
                if (!entry) throw Error("Invalid class table entry (oop " + page[i] + ")");
                if (entry !== nil) {
                    var classIndex = p * 1024 + i;
                    classes[classIndex] = entry;
                }
            }
        }
        // add known classes which may not be in the table
        for (var key in Squeak) {
            if (/^splOb_Class/.test(key)) {
                var knownClass = oopMap.get(rawBits.get(splObjs.oop)[Squeak[key]]);
                if (knownClass !== nil) {
                    var classIndex = knownClass.hash;
                    if (classIndex > 0 && classIndex < 1024)
                        classes[classIndex] = knownClass;
                }
            }
        }
        classes[3] = classes[1];      // SmallInteger needs two entries
        this.classTable = classes;
        this.classTableIndex = 1024;  // first page is special
        return classes;
    },
    enterIntoClassTable: function(newClass) {
        var index = this.classTableIndex,
            table = this.classTable;
        while (index <= 0x3FFFFF) {
            if (!table[index]) {
                table[index] = newClass;
                newClass.hash = index;
                this.classTableIndex = index;
                return index;
            }
            index++;
        }
        console.error("class table full?"); // todo: clean out old class table entries
        return null;
    },
    initImmediateClasses: function(oopMap, rawBits, splObs) {
        var special = rawBits.get(splObs.oop);
        this.characterClass = oopMap.get(special[Squeak.splOb_ClassCharacter]);
        this.floatClass = oopMap.get(special[Squeak.splOb_ClassFloat]);
        this.largePosIntClass = oopMap.get(special[Squeak.splOb_ClassLargePositiveInteger]);
        this.largeNegIntClass = oopMap.get(special[Squeak.splOb_ClassLargeNegativeInteger]);
        // init named prototypes
        this.characterClass.classInstProto("Character");
        this.floatClass.classInstProto("BoxedFloat64");
        this.largePosIntClass.classInstProto("LargePositiveInteger");
        this.largeNegIntClass.classInstProto("LargeNegativeInteger");
        this.characterTable = {};
    },
    getCharacter: function(unicode) {
        var char = this.characterTable[unicode];
        if (!char) {
            char = new this.characterClass.instProto;
            char.initInstanceOfChar(this.characterClass, unicode);
            this.characterTable[unicode] = char;
        }
        return char;
    },
    instantiateFloat: function(bits) {
        var float = new this.floatClass.instProto;
        this.registerObjectSpur(float);
        this.hasNewInstances[this.floatClass.oop] = true;
        float.initInstanceOfFloat(this.floatClass, bits);
        return float;
    },
    instantiateLargeFromSmall: function(hi, lo) {
        // get rid of 3 tag bits
        lo = hi << 29 | lo >>> 3 ; // shift 3 bits from hi to lo
        hi = hi >> 3; // shift by 3 with sign extension
        // value is always positive, class determines sign
        var negative = hi < 0;
        if (negative) { hi = -hi; lo = -lo; if (lo !== 0) hi--; }
        var size = hi === 0 ? 4 : hi <= 0xFF ? 5 : hi <= 0xFFFF ? 6 : hi <= 0xFFFFFF ? 7 : 8;
        var largeIntClass = negative ? this.largeNegIntClass : this.largePosIntClass;
        var largeInt = new largeIntClass.instProto;
        this.registerObjectSpur(largeInt);
        this.hasNewInstances[largeIntClass.oop] = true;
        largeInt.initInstanceOfLargeInt(largeIntClass, size);
        var bytes = largeInt.bytes;
        for (var i = 0; i < 4; i++) { bytes[i] = lo & 255; lo >>= 8; }
        for (var i = 4; i < size; i++) { bytes[i] = hi & 255; hi >>= 8; }
        return largeInt;
    },
    ensureClassesInTable: function() {
        // make sure all classes are in class table
        // answer number of class pages
        var obj = this.firstOldObject;
        var maxIndex = 1024; // at least one page
        while (obj) {
            var cls = obj.sqClass;
            if (cls.hash === 0) this.enterIntoClassTable(cls);
            if (cls.hash > maxIndex) maxIndex = cls.hash;
            if (this.classTable[cls.hash] !== cls) throw Error("Class not in class table");
            obj = obj.nextObject;
        }
        return (maxIndex >> 10) + 1;
    },
    classTableBytes: function(numPages) {
        // space needed for master table and minor pages
        return (4 + 4104 + numPages * (4 + 1024)) * 4;
    },
    writeFreeLists: function(data, pos, littleEndian, oopOffset) {
        // we fake an empty free lists object
        data.setUint32(pos, 0x0A000012, littleEndian); pos += 4;
        data.setUint32(pos, 0x20000000, littleEndian); pos += 4;
        pos += 32 * 4;  // 32 zeros
        return pos;
    },
    writeClassTable: function(data, pos, littleEndian, objToOop, numPages) {
        // write class tables as Spur expects them, faking their oops
        var nilFalseTrueBytes = 3 * 16,
            freeListBytes = 8 + 32 * 4,
            majorTableSlots = 4096 + 8,         // class pages plus 8 hiddenRootSlots
            minorTableSlots = 1024,
            majorTableBytes = 16 + majorTableSlots * 4,
            minorTableBytes = 16 + minorTableSlots * 4,
            firstPageOop = nilFalseTrueBytes + freeListBytes + majorTableBytes + 8;
        // major table
        data.setUint32(pos, majorTableSlots, littleEndian); pos += 4;
        data.setUint32(pos,      0xFF000000, littleEndian); pos += 4;
        data.setUint32(pos,      0x02000010, littleEndian); pos += 4;
        data.setUint32(pos,      0xFF000000, littleEndian); pos += 4;
        for (var p = 0; p < numPages; p++) {
            data.setUint32(pos, firstPageOop + p * minorTableBytes, littleEndian); pos += 4;
        }
        pos += (majorTableSlots - numPages) * 4;  // rest is nil
        // minor tables
        var classID = 0;
        for (var p = 0; p < numPages; p++) {
            data.setUint32(pos, minorTableSlots, littleEndian); pos += 4;
            data.setUint32(pos,      0xFF000000, littleEndian); pos += 4;
            data.setUint32(pos,      0x02000010, littleEndian); pos += 4;
            data.setUint32(pos,      0xFF000000, littleEndian); pos += 4;
            for (var i = 0; i < minorTableSlots; i++) {
                var classObj = this.classTable[classID];
                if (classObj && classObj.pointers) {
                    if (!classObj.hash) throw Error("class without id");
                    if (classObj.hash !== classID && classID >= 32 || classObj.oop < 0) {
                        console.warn("freeing class index " + classID + " " + classObj.className());
                        classObj = null;
                        delete this.classTable[classID];
                    }
                }
                if (classObj) data.setUint32(pos, objToOop(classObj), littleEndian);
                pos += 4;
                classID++;
            }
        }
        return pos;
    },
    writeToBufferSpur: function() {
        var headerSize = 64,
            trailerSize = 16,
            freeListsSize = 136,
            numPages = this.ensureClassesInTable(),
            hiddenSize = freeListsSize + this.classTableBytes(numPages),
            data = new DataView(new ArrayBuffer(headerSize + hiddenSize + this.oldSpaceBytes + trailerSize)),
            littleEndian = true,
            start = Date.now(),
            pos = 0;
        function writeWord(word) {
            data.setUint32(pos, word, littleEndian);
            pos += 4;
        };
        function objToOop(obj) {
            if (typeof obj === "number")
                return obj << 1 | 1; // add tag bit
            if (obj._format === 7) {
                if (obj.hash !== (obj.oop >> 2) || (obj.oop & 3) !== 2)
                    throw Error("Bad immediate char");
                return obj.oop;
            }
            if (obj.oop < 0) throw Error("temporary oop");
            // oops after nil/false/true are shifted by size of hidden objects
            return obj.oop < 48 ? obj.oop : obj.oop + hiddenSize;
        };
        writeWord(this.formatVersion()); // magic number
        writeWord(headerSize);
        writeWord(hiddenSize + this.oldSpaceBytes + trailerSize); // end of memory
        writeWord(this.firstOldObject.addr()); // base addr (0)
        writeWord(objToOop(this.specialObjectsArray));
        this.savedHeaderWords.forEach(writeWord);
        writeWord(hiddenSize + this.oldSpaceBytes + trailerSize); //first segment size
        while (pos < headerSize)
            writeWord(0);
        // write objects
        var obj = this.firstOldObject,
            n = 0;
        pos = obj.writeTo(data, pos, littleEndian, objToOop); obj = obj.nextObject; n++; // write nil
        pos = obj.writeTo(data, pos, littleEndian, objToOop); obj = obj.nextObject; n++; // write false
        pos = obj.writeTo(data, pos, littleEndian, objToOop); obj = obj.nextObject; n++; // write true
        pos = this.writeFreeLists(data, pos, littleEndian, objToOop); // write hidden free list
        pos = this.writeClassTable(data, pos, littleEndian, objToOop, numPages); // write hidden class table
        while (obj) {
            pos = obj.writeTo(data, pos, littleEndian, objToOop);
            obj = obj.nextObject;
            n++;
        }
        // write segement trailer
        writeWord(0x4A000003);
        writeWord(0x00800000);
        writeWord(0);
        writeWord(0);
        // done
        if (pos !== data.byteLength) throw Error("wrong image size");
        if (n !== this.oldSpaceCount) throw Error("wrong object count");
        var time = Date.now() - start;
        console.log("Wrote " + n + " objects in " + time + " ms, image size " + pos + " bytes")
        return data.buffer;
    },
    storeImageSegmentSpur: function(segmentWordArray, outPointerArray, arrayOfRoots) {
        // see comment in segmentVersion() if you implement this
        // also see markReachableObjects() about immediate chars
        this.vm.warnOnce("not implemented for Spur yet: primitive 98 (primitiveStoreImageSegment)");
        return false;
    },
    loadImageSegmentSpur: function(segmentWordArray, outPointerArray) {
        this.vm.warnOnce("not implemented for Spur yet: primitive 99 (primitiveLoadImageSegment)");
        return null;
    },
});

Squeak.normalizeImageStreamSource = function(source) {
    if (!source) return null;

    var descriptor = {
        totalBytes: typeof source.totalBytes === "number" ? source.totalBytes : null,
    };

    var resumeFactory = null;
    var maxResumes = typeof source.maxResumes === "number" ? source.maxResumes : null;

    function wrapResume(fn) {
        if (typeof fn !== "function") return null;
        return async function(info) {
            var result = await fn(info || {});
            if (!result) return null;
            if (typeof result.next === "function") {
                return { iterator: result };
            }
            if (result.iterator && typeof result.iterator.next === "function") {
                return result;
            }
            return null;
        };
    }

    if (typeof source.createIterator === "function") {
        var iterator = source.createIterator(0);
        if (!iterator || typeof iterator.next !== "function") return null;
        descriptor.iterator = iterator;
        resumeFactory = wrapResume(function(info) {
            var offset = info && typeof info.offset === "number" ? info.offset : 0;
            return source.createIterator(offset);
        });
    } else if (typeof source[Symbol.asyncIterator] === "function") {
        descriptor.iterator = source[Symbol.asyncIterator]();
    } else if (source.iterator && typeof source.iterator.next === "function") {
        descriptor.iterator = source.iterator;
    } else if (source.stream && typeof source.stream[Symbol.asyncIterator] === "function") {
        descriptor.iterator = source.stream[Symbol.asyncIterator]();
    } else if (typeof source.getIterator === "function") {
        var iter = source.getIterator();
        if (!iter || typeof iter.next !== "function") return null;
        descriptor.iterator = iter;
    } else {
        return null;
    }

    if (typeof source.resumeFrom === "function") {
        resumeFactory = wrapResume(function(info) {
            return source.resumeFrom(info || {});
        });
    } else if (typeof source.resume === "function") {
        resumeFactory = wrapResume(source.resume.bind(source));
    } else if (typeof source.recover === "function") {
        resumeFactory = wrapResume(source.recover.bind(source));
    }

    if (resumeFactory) {
        descriptor.resume = resumeFactory;
        descriptor.maxResumes = typeof maxResumes === "number" ? maxResumes : 1;
    }

    if (typeof source.onProgress === "function") descriptor.onProgress = source.onProgress.bind(source);
    if (typeof source.onChunk === "function") descriptor.onChunk = source.onChunk.bind(source);
    if (typeof source.onRecovery === "function") descriptor.onRecovery = source.onRecovery.bind(source);
    if (typeof source.onFailure === "function") descriptor.onFailure = source.onFailure.bind(source);

    return descriptor;
};

Squeak.StreamingImageLoader = function(image, descriptor, options) {
    this.image = image;
    options = options || {};
    this.progressAdapter = options.progressAdapter || null;
    this.finalizeProgressDo = options.finalizeProgressDo || null;
    this.totalBytes = descriptor.totalBytes || null;
    this.reader = new Squeak.ImageStreamCursor(descriptor.iterator, {
        totalBytes: this.totalBytes,
        onChunk: descriptor.onChunk,
        onProgress: descriptor.onProgress,
        resume: descriptor.resume,
        maxResumes: descriptor.maxResumes,
        onRecovery: descriptor.onRecovery,
    });
    this.thenDo = options.thenDo;
    this.scheduler = options.scheduler || null;
    this.onStreamFailure = typeof descriptor.onFailure === "function" ? descriptor.onFailure : null;
};

Squeak.StreamingImageLoader.prototype.load = async function() {
    try {
        return await this._loadInternal();
    } catch (error) {
        var controller = this.image && this.image._activeInstallController;
        if (controller && typeof controller.abort === "function") {
            if (typeof controller.whenComplete === "function") {
                try {
                    controller.whenComplete().catch(function() {});
                } catch (promiseError) {
                    console.warn("image stream completion handler failed", promiseError);
                }
            }
            controller.abort(error);
        }
        if (this.onStreamFailure) {
            try {
                var attempts = this.reader && typeof this.reader.getResumeAttempts === "function"
                    ? this.reader.getResumeAttempts()
                    : undefined;
                this.onStreamFailure(error, { attempts: attempts });
            } catch (failureError) {
                console.warn("image stream failure handler threw", failureError);
            }
        }
        if (this.progressAdapter && typeof this.progressAdapter.fail === "function") {
            this.progressAdapter.fail(error);
        }
        throw error;
    }
};

Squeak.StreamingImageLoader.prototype._loadInternal = async function() {
    var reader = this.reader,
        image = this.image,
        progressAdapter = this.progressAdapter,
        finalizeProgressDo = this.finalizeProgressDo,
        thenDo = this.thenDo,
        scheduler = this.scheduler;

    var headerAudit = image.headerAudit;
    if (!headerAudit) {
        headerAudit = new ImageHeaderAudit(image.name);
        image.headerAudit = headerAudit;
    }

    await reader.ensure(516);
    var headerProbe = reader.peek(Math.min(516, reader.bufferedSize()));
    var headerInfo = detectImageHeader(headerProbe, headerAudit);
    if (!headerInfo) throw Error("bad image version");
    var headerBytes = headerInfo.fileHeaderSize > 0 ? reader.peek(headerInfo.fileHeaderSize) : new Uint8Array(0);
    var compatibilityRecorder = new CompatibilityImageRecorder(headerBytes);
    reader.drop(headerInfo.fileHeaderSize);

    var littleEndian = headerInfo.littleEndian;
    var readUint32 = async function() {
        var bytes = await reader.read(4);
        compatibilityRecorder.record(bytes);
        return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, littleEndian);
    };
    var readUint64 = async function() {
        var bytes = await reader.read(8);
        compatibilityRecorder.record(bytes);
        var view = new DataView(bytes.buffer, bytes.byteOffset, 8);
        var lo = view.getUint32(littleEndian ? 0 : 4, littleEndian);
        var hi = view.getUint32(littleEndian ? 4 : 0, littleEndian);
        return Squeak.word64FromUint32(hi, lo);
    };

    var headerBytesRead = 0;
    var version = await readUint32();
    headerBytesRead += 4;
    if (version !== headerInfo.version) version = headerInfo.version;
    image.version = version;
    var nativeFloats = (version & 1) !== 0;
    image.hasClosures = !([6501, 6502, 68000].indexOf(version) >= 0);
    image.isSpur = (version & 16) !== 0;
    var is64Bit = version >= 68000;
    if (is64Bit && !image.isSpur) {
        var captured = await compatibilityRecorder.collect(reader);
        var compatibility = captured ? tryLoadNativeCompatibilityImageFromBuffer({
            buffer: captured.buffer,
            littleEndian: littleEndian,
            headerInfo: headerInfo,
            audit: headerAudit,
            imageName: image.name,
            bytes: captured,
        }) : null;
        if (compatibility) {
            image._finalizeCompatibilityLoad(compatibility, thenDo, finalizeProgressDo);
            if (progressAdapter) progressAdapter.complete();
            return { __compatibilityHandled: true, snapshot: compatibility };
        }
        if (headerAudit) headerAudit.recordIssue("unsupported-nonspur-64", {
            reason: "no-native-loader",
        });
        throw Error("64 bit non-spur images not supported yet");
    }
    compatibilityRecorder.disable();
    var wordSize = is64Bit ? 8 : 4;
    var readWord = is64Bit ? readUint64 : readUint32;

    var imageHeaderSize = await readUint32();
    headerBytesRead += 4;
    var objectMemorySize = await readWord();
    headerBytesRead += wordSize;
    var oldBaseAddr = await readWord();
    headerBytesRead += wordSize;
    var specialObjectsOopInt = await readWord();
    headerBytesRead += wordSize;
    var lastHash = await readUint32();
    headerBytesRead += 4;
    if (is64Bit) {
        await readUint32();
        headerBytesRead += 4;
    }
    var savedWindowSize = await readWord();
    headerBytesRead += wordSize;
    image.headerFlags = await readWord();
    headerBytesRead += wordSize;
    image.savedHeaderWords = [lastHash, savedWindowSize, image.headerFlags];
    for (var i = 0; i < 4; i++) {
        image.savedHeaderWords.push(await readUint32());
        headerBytesRead += 4;
    }
    var firstSegSize = await readWord();
    headerBytesRead += wordSize;

    if (headerBytesRead < imageHeaderSize) {
        var remainder = imageHeaderSize - headerBytesRead;
        if (remainder > 0) {
            await reader.read(remainder);
            headerBytesRead += remainder;
        }
    } else if (headerBytesRead > imageHeaderSize) {
        throw Error("image header size mismatch");
    }

    var headerSize = headerInfo.fileHeaderSize + imageHeaderSize;
    reader.markHeaderComplete();

    var oopMap = new Map();
    var rawBits = new Map();
    var prevObj = null;
    var object = null;
    var classPages = null;
    var oopAdjust = undefined;

    var finalizeContext = {
        oopMap: oopMap,
        rawBits: rawBits,
        classPages: classPages,
        specialObjectsOopInt: specialObjectsOopInt,
        littleEndian: littleEndian,
        nativeFloats: nativeFloats,
        is64Bit: is64Bit,
        oopAdjust: oopAdjust,
        oldBaseAddr: oldBaseAddr,
    };
    var controller = image._createInstallController(finalizeContext, {
        finalizeProgressDo: finalizeProgressDo,
        thenDo: thenDo,
        streaming: true,
        scheduler: scheduler,
    });
    controller.activateStreaming();

    image.oldSpaceCount = 0;
    if (!image.isSpur) {
        image.oldSpaceBytes = objectMemorySize;
        while (reader.bytesReadSinceHeader() < objectMemorySize) {
            var headerWord = await readWord();
            var nWords = 0;
            var classInt = 0;
            switch (headerWord & Squeak.HeaderTypeMask) {
                case Squeak.HeaderTypeSizeAndClass:
                    nWords = headerWord >>> 2;
                    classInt = await readWord();
                    headerWord = await readWord();
                    break;
                case Squeak.HeaderTypeClass:
                    classInt = headerWord - Squeak.HeaderTypeClass;
                    headerWord = await readWord();
                    nWords = (headerWord >>> 2) & 63;
                    break;
                case Squeak.HeaderTypeShort:
                    nWords = (headerWord >>> 2) & 63;
                    classInt = (headerWord >>> 12) & 31;
                    break;
                case Squeak.HeaderTypeFree:
                    throw Error("Unexpected free block");
            }
            nWords--;
            var objectStart = headerSize + reader.bytesReadSinceHeader() - wordSize;
            var format = (headerWord >>> 8) & 15;
            var hash = (headerWord >>> 17) & 4095;
            var bits = await readBits(reader, nWords, format < 5, wordSize, littleEndian, is64Bit, readWord);
            var oop = objectStart - headerSize;
            object = new Squeak.Object();
            object.initFromImage(oop, classInt, format, hash);
            if (classInt < 32) object.hash |= 0x10000000;
            if (prevObj) prevObj.nextObject = object;
            else image.firstOldObject = object;
            image.oldSpaceCount++;
            prevObj = object;
            oopMap.set(oldBaseAddr + oop, object);
            rawBits.set(oop, bits);
            controller.markObjectAvailable(object);
        }
        image.firstOldObject = oopMap.get(oldBaseAddr + 4);
        image.lastOldObject = object;
        if (image.lastOldObject) image.lastOldObject.nextObject = null;
    } else {
        image.oldSpaceBytes = firstSegSize - 16;
        var addressOffset = 0;
        var skippedBytes = 0;
        oopAdjust = {};
        var segmentBytes = firstSegSize;
        while (segmentBytes) {
            var segmentStart = reader.bytesReadSinceHeader();
            var segmentLimit = segmentStart + segmentBytes - 16;
            while (reader.bytesReadSinceHeader() < segmentLimit) {
                var objHeaderStart = reader.bytesReadSinceHeader();
                var formatAndClass = await readUint32();
                var sizeAndHash = await readUint32();
                var size = sizeAndHash >>> 24;
                if (size === 255) {
                    size = formatAndClass;
                    formatAndClass = await readUint32();
                    sizeAndHash = await readUint32();
                }
                var oop = addressOffset + reader.bytesReadSinceHeader() - 8;
                var format = (formatAndClass >>> 24) & 0x1F;
                var classID = formatAndClass & 0x003FFFFF;
                var hash = sizeAndHash & 0x003FFFFF;
                var bits = await readBits(reader, size, format < 10 && classID > 0, wordSize, littleEndian, is64Bit, readWord);
                var padding = is64Bit
                    ? (size < 1 ? (1 - size) * 8 : 0)
                    : (size < 2 ? (2 - size) * 4 : (size & 1) * 4);
                if (padding > 0) await reader.read(padding);
                if (classID >= 32) {
                    object = new Squeak.ObjectSpur();
                    object.initFromImage(oop, classID, format, hash);
                    if (prevObj) prevObj.nextObject = object;
                    else image.firstOldObject = object;
                    image.oldSpaceCount++;
                    prevObj = object;
                    oopMap.set(oldBaseAddr + oop, object);
                    rawBits.set(oop, bits);
                    oopAdjust[oop] = skippedBytes;
                    controller.markObjectAvailable(object);
                    if (is64Bit) {
                        var overhead = object.overhead64(bits);
                        skippedBytes += overhead.bytes;
                        if (overhead.sizeHeader) {
                            oopAdjust[oop] -= 8;
                            skippedBytes -= 8;
                        }
                    }
                } else {
                    skippedBytes += reader.bytesReadSinceHeader() - objHeaderStart;
                    if (classID === 16 && !classPages) {
                        classPages = bits;
                        finalizeContext.classPages = classPages;
                    }
                    if (classID) oopMap.set(oldBaseAddr + oop, bits);
                }
            }
            var deltaWords = await readUint32();
            var deltaWordsHi = await readUint32();
            var nextSegmentBytes = await readUint32();
            await readUint32(); // segmentBytesHi, unused
            if (nextSegmentBytes !== 0) {
                var deltaBytes = (deltaWordsHi & 0xFF000000) ? (deltaWords & 0x00FFFFFF) * 4 : 0;
                addressOffset += deltaBytes;
                skippedBytes += 16 + deltaBytes;
                image.oldSpaceBytes += deltaBytes + nextSegmentBytes;
                segmentBytes = nextSegmentBytes;
            } else {
                segmentBytes = 0;
            }
        }
        image.oldSpaceBytes -= skippedBytes;
        image.firstOldObject = oopMap.get(oldBaseAddr);
        image.lastOldObject = prevObj;
        if (image.lastOldObject) image.lastOldObject.nextObject = null;
    }

    reader.consumeRemaining();
    finalizeContext.classPages = classPages;
    finalizeContext.oopAdjust = oopAdjust;
    controller.markStreamComplete();
    return controller.whenComplete();
};

Squeak.ImageInstallController = function(image, context, options) {
    options = options || {};
    this.image = image;
    this.context = context;
    this.thenDo = typeof options.thenDo === "function" ? options.thenDo : null;
    this.finalizeProgressDo = typeof options.finalizeProgressDo === "function" ? options.finalizeProgressDo : null;
    this.batchSize = options.batchSize && options.batchSize > 0 ? Math.floor(options.batchSize) : 200;
    this.streaming = !!options.streaming;
    this.scheduler = typeof options.scheduler === "function" ? options.scheduler : function(fn) {
        if (typeof self !== "undefined" && self && typeof self.setTimeout === "function") return self.setTimeout(fn, 0);
        return setTimeout(fn, 0);
    };
    this._installResources = null;
    this._nativeFloatDecoder = context.nativeFloats;
    this._cursor = image.firstOldObject;
    this._renamedTail = null;
    this._availableTail = null;
    this._flushScheduled = false;
    this._streamComplete = !this.streaming;
    this._completed = false;
    this._totalObjects = image.oldSpaceCount || 0;
    this._installedCount = 0;
    var self = this;
    this._completionPromise = new Promise(function(resolve, reject) {
        self._resolveCompletion = resolve;
        self._rejectCompletion = reject;
    });
};

Squeak.ImageInstallController.prototype.updateOptions = function(options) {
    options = options || {};
    if (typeof options.finalizeProgressDo === "function") this.finalizeProgressDo = options.finalizeProgressDo;
    if (typeof options.thenDo === "function") this.thenDo = options.thenDo;
    if (options.batchSize && options.batchSize > 0) this.batchSize = Math.floor(options.batchSize);
    if (typeof options.scheduler === "function") this.scheduler = options.scheduler;
    if (options.streaming !== undefined) this.streaming = !!options.streaming;
};

Squeak.ImageInstallController.prototype.activateStreaming = function() {
    this.streaming = true;
    this._streamComplete = false;
    this._maybeScheduleFlush();
};

Squeak.ImageInstallController.prototype.installAllSync = function() {
    this.streaming = false;
    this._streamComplete = true;
    this._markAllAvailable();
    while (this._consumeBatch(true)) {}
    this._maybeFinish();
};

Squeak.ImageInstallController.prototype.whenComplete = function() {
    return this._completionPromise;
};

Squeak.ImageInstallController.prototype.abort = function(error) {
    if (this._completed) {
        if (error && this._rejectCompletion) {
            this._rejectCompletion(error);
            this._rejectCompletion = null;
        }
        return;
    }
    this._completed = true;
    this.streaming = false;
    this._flushScheduled = false;
    this._cursor = null;
    this._availableTail = null;
    this._renamedTail = null;
    var context = this.context || {};
    if (context.oopMap && typeof context.oopMap.clear === "function") context.oopMap.clear();
    if (context.rawBits && typeof context.rawBits.clear === "function") context.rawBits.clear();
    var image = this.image;
    if (image) {
        image.firstOldObject = null;
        image.lastOldObject = null;
        image.specialObjectsArray = null;
        image.oldSpaceCount = 0;
        image.oldSpaceBytes = 0;
        image.totalMemory = 0;
        image.savedHeaderWords = [];
        image.headerFlags = 0;
        image._activeInstallController = null;
    }
    if (this._rejectCompletion) {
        this._rejectCompletion(error || new Error("image stream aborted"));
        this._rejectCompletion = null;
    }
};

Squeak.ImageInstallController.prototype.markObjectAvailable = function(object) {
    if (!object) return;
    object.__streamParsed = true;
    this._availableTail = object;
    this._totalObjects = this.image.oldSpaceCount || this._totalObjects;
    if (!this._cursor) this._cursor = object;
    this._maybeScheduleFlush();
};

Squeak.ImageInstallController.prototype.markStreamComplete = function() {
    this._streamComplete = true;
    this._maybeScheduleFlush();
};

Squeak.ImageInstallController.prototype._markAllAvailable = function() {
    var object = this.image.firstOldObject;
    while (object) {
        object.__streamParsed = true;
        this._availableTail = object;
        object = object.nextObject;
    }
    if (!this._cursor) this._cursor = this.image.firstOldObject;
};

Squeak.ImageInstallController.prototype._maybeScheduleFlush = function() {
    if (!this.streaming) return;
    if (this._flushScheduled) return;
    if (!this._cursor || !this._cursor.__streamParsed) return;
    var self = this;
    this._flushScheduled = true;
    this.scheduler(function() {
        self._flushScheduled = false;
        try {
            self._consumeBatch(false);
            self._maybeFinish();
        } catch (error) {
            if (self._completed) throw error;
            self._completed = true;
            self.image._activeInstallController = null;
            if (self._rejectCompletion) self._rejectCompletion(error);
            else throw error;
        }
    });
};

Squeak.ImageInstallController.prototype._consumeBatch = function(force) {
    if (!this._ensureInstallResources()) return false;
    var processed = 0;
    while (this._cursor && this._cursor.__streamParsed) {
        if (!force && processed >= this.batchSize) break;
        if (!this._dependenciesReady(this._cursor)) break;
        this._installNext();
        processed++;
    }
    if (processed > 0) this._emitFinalizeProgress();
    if (this.streaming && this._cursor && this._cursor.__streamParsed && processed >= this.batchSize) {
        this._maybeScheduleFlush();
    }
    return processed > 0;
};

Squeak.ImageInstallController.prototype._installNext = function() {
    var object = this._cursor;
    if (!object) return;
    var next = object.nextObject;
    var renamed = this._renameObject(object);
    renamed.nextObject = next;
    this._linkRenamedObject(renamed);
    this._installObject(renamed);
    if (this._installResources && renamed.oop === this.context.specialObjectsOopInt) {
        this._installResources.specialObjects = renamed;
    }
    this._cursor = next;
    this._installedCount++;
};

Squeak.ImageInstallController.prototype._ensureInstallResources = function() {
    if (this._installResources) return true;
    var context = this.context;
    var oopMap = context.oopMap;
    var rawBits = context.rawBits;
    var specialObjects = oopMap.get(context.specialObjectsOopInt);
    if (!specialObjects) return false;
    var classInfo;
    if (this.image.isSpur) {
        if (!context.classPages) return false;
        try {
            classInfo = this.image.spurClassTable(oopMap, rawBits, context.classPages, specialObjects);
        } catch (error) {
            return false;
        }
        this.image.initImmediateClasses(oopMap, rawBits, specialObjects);
        this.image.initSpurOverrides();
        this._nativeFloatDecoder = this.image.getCharacter.bind(this.image);
    } else {
        var splObsBits = rawBits.get(specialObjects.oop);
        if (!splObsBits) return false;
        var compactClassesArray = oopMap.get(splObsBits[Squeak.splOb_CompactClasses]);
        if (!compactClassesArray) return false;
        classInfo = rawBits.get(compactClassesArray.oop);
        if (!classInfo) return false;
    }
    var splObsBitsForFloat = rawBits.get(specialObjects.oop);
    if (!splObsBitsForFloat) return false;
    var floatClass = oopMap.get(splObsBitsForFloat[Squeak.splOb_ClassFloat]);
    if (!floatClass) return false;
    this._installResources = {
        specialObjects: specialObjects,
        compactClasses: classInfo,
        floatClass: floatClass,
    };
    return true;
};

Squeak.ImageInstallController.prototype._dependenciesReady = function(object) {
    var context = this.context;
    var rawBits = context.rawBits;
    var oopMap = context.oopMap;
    var bits = rawBits.get(object.oop);
    if (!bits) return false;
    var format = object._format;
    if (format < 5) {
        for (var i = 0; i < bits.length; i++) {
            var oop = bits[i];
            if (typeof oop === "number") {
                if ((oop & 1) === 1) continue;
                if (!oopMap.has(oop)) return false;
            } else if (!oopMap.has(oop)) {
                return false;
            }
        }
    } else if (format >= 12 && format < 16) {
        if (!this._compiledMethodPointersReady(bits)) return false;
    }
    return true;
};

Squeak.ImageInstallController.prototype._compiledMethodPointersReady = function(bits) {
    if (!bits || bits.length === 0) return true;
    var context = this.context;
    var oopMap = context.oopMap;
    var littleEndian = context.littleEndian;
    var data = new DataView(bits.buffer, bits.byteOffset, bits.byteLength);
    var methodHeader = data.getUint32(0, littleEndian);
    var numLits = (methodHeader >> 10) & 255;
    for (var i = 1; i <= numLits; i++) {
        var offset = i * 4;
        var value = data.getUint32(offset, littleEndian);
        if ((value & 1) === 1) continue;
        if (!oopMap.has(value)) return false;
    }
    return true;
};

Squeak.ImageInstallController.prototype._renameObject = function(object) {
    var context = this.context;
    var oopMap = context.oopMap;
    var rawBits = context.rawBits;
    var classInfo = this._installResources.compactClasses;
    var renamed = object.renameFromImage(oopMap, rawBits, classInfo);
    oopMap.set((context.oldBaseAddr || 0) + object.oop, renamed);
    return renamed;
};

Squeak.ImageInstallController.prototype._linkRenamedObject = function(renamed) {
    if (!this.image.firstOldObject || this._installedCount === 0) {
        this.image.firstOldObject = renamed;
    }
    if (this._renamedTail) {
        this._renamedTail.nextObject = renamed;
    }
    this._renamedTail = renamed;
};

Squeak.ImageInstallController.prototype._installObject = function(object) {
    var context = this.context;
    var installResources = this._installResources;
    var options = context.is64Bit && {
        makeFloat: this.image.instantiateFloat.bind(this.image),
        makeLargeFromSmall: this.image.instantiateLargeFromSmall.bind(this.image),
    };
    object.installFromImage(
        context.oopMap,
        context.rawBits,
        installResources.compactClasses,
        installResources.floatClass,
        context.littleEndian,
        this._nativeFloatDecoder,
        options
    );
};

Squeak.ImageInstallController.prototype._emitFinalizeProgress = function() {
    if (!this.finalizeProgressDo) return;
    if (!this._totalObjects) return;
    var fraction = this._installedCount / this._totalObjects;
    if (fraction < 0) fraction = 0;
    if (fraction > 1) fraction = 1;
    this.finalizeProgressDo(fraction);
};

Squeak.ImageInstallController.prototype._maybeFinish = function() {
    if (this._completed) return;
    if (this._cursor && (!this._cursor.__streamParsed || !this._dependenciesReady(this._cursor))) return;
    if (!this._streamComplete) return;
    if (this._cursor) return;
    this._completed = true;
    if (this._renamedTail) {
        this.image.lastOldObject = this._renamedTail;
        this.image.lastOldObject.nextObject = null;
    }
    var installResources = this._installResources;
    if (installResources) {
        this.image.specialObjectsArray = installResources.specialObjects;
        this.image.decorateKnownObjects();
        if (this.image.isSpur) {
            this.image.fixSkippedOops(this.context.oopAdjust || {});
            if (this.context.is64Bit) this.image.fixPCs();
            this.image.ensureFullBlockClosureClass(this.image.specialObjectsArray, installResources.compactClasses);
        } else {
            this.image.fixCompiledMethods();
            this.image.fixCompactOops();
        }
    }
    if (this.finalizeProgressDo) this.finalizeProgressDo(1);
    if (this.thenDo) this.thenDo();
    if (this._resolveCompletion) this._resolveCompletion();
    this.image._activeInstallController = null;
};

Squeak.ImageStreamProgressAdapter = function(progressDo, options) {
    if (typeof progressDo !== "function") throw Error("progress callback required");
    options = options || {};
    this.progressDo = progressDo;
    this.totalBytes = typeof options.totalBytes === "number" && options.totalBytes > 0
        ? options.totalBytes : null;
    var downloadWeight = options.downloadWeight;
    if (downloadWeight === undefined || downloadWeight === null || !isFinite(downloadWeight)) {
        downloadWeight = 0.7;
    }
    if (downloadWeight < 0) downloadWeight = 0;
    if (downloadWeight > 1) downloadWeight = 1;
    this.downloadWeight = downloadWeight;
    this.finalizeWeight = 1 - downloadWeight;
    this._lastValue = -Infinity;
    this._lastDownloadFraction = 0;
    this._lastFinalizeFraction = 0;
};

Squeak.ImageStreamProgressAdapter.prototype._emit = function(value) {
    var clamped = value < 0 ? 0 : (value > 1 ? 1 : value);
    if (clamped <= this._lastValue) return;
    this._lastValue = clamped;
    try {
        this.progressDo(clamped);
    } catch (error) {
        console.warn("image stream progress callback failed", error);
    }
};

Squeak.ImageStreamProgressAdapter.prototype.start = function() {
    this._emit(0);
};

Squeak.ImageStreamProgressAdapter.prototype.handleDownload = function(fetched, total) {
    if (typeof total === "number" && total > 0 && !this.totalBytes) {
        this.totalBytes = total;
    }
    var denominator = this.totalBytes;
    if (!denominator || !isFinite(denominator) || denominator <= 0) return;
    var fraction = fetched / denominator;
    if (!isFinite(fraction)) return;
    if (fraction < 0) fraction = 0;
    if (fraction > 1) fraction = 1;
    if (fraction <= this._lastDownloadFraction) return;
    this._lastDownloadFraction = fraction;
    this._emit(fraction * this.downloadWeight);
};

Squeak.ImageStreamProgressAdapter.prototype.handleFinalize = function(fraction) {
    if (!isFinite(fraction)) return;
    if (fraction < 0) fraction = 0;
    if (fraction > 1) fraction = 1;
    if (fraction <= this._lastFinalizeFraction) return;
    this._lastFinalizeFraction = fraction;
    var base = this.downloadWeight;
    var value = base + fraction * this.finalizeWeight;
    this._emit(value);
};

Squeak.ImageStreamProgressAdapter.prototype.complete = function() {
    this._emit(1);
};

var IMAGE_HEADER_VERSION_MASK = 0x119EE;
var IMAGE_HEADER_BASE_VERSIONS = [6501, 6502, 6504, 68000, 68002, 68004];
var IMAGE_HEADER_PROBES = [
    { offset: 0, littleEndian: false },
    { offset: 0, littleEndian: true },
    { offset: 512, littleEndian: false },
    { offset: 512, littleEndian: true },
];

function detectImageHeader(bytes, audit) {
    if (!bytes || bytes.byteLength < 4) {
        if (audit) {
            audit.recordIssue("insufficient-bytes", {
                availableBytes: bytes ? bytes.byteLength : 0,
                requiredBytes: 4,
            });
        }
        return null;
    }
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (var i = 0; i < IMAGE_HEADER_PROBES.length; i++) {
        var probe = IMAGE_HEADER_PROBES[i];
        if (bytes.byteLength < probe.offset + 4) continue;
        var word = view.getUint32(probe.offset, probe.littleEndian);
        var recognized = IMAGE_HEADER_BASE_VERSIONS.indexOf((word & IMAGE_HEADER_VERSION_MASK)) >= 0;
        if (audit) {
            audit.recordProbe({
                offset: probe.offset,
                littleEndian: probe.littleEndian,
                word: word >>> 0,
                recognized: recognized,
            });
        }
        if (recognized) {
            var info = {
                littleEndian: probe.littleEndian,
                fileHeaderSize: probe.offset,
                version: word >>> 0,
            };
            if (audit) audit.registerMatch(info);
            return info;
        }
    }
    if (audit) {
        audit.recordIssue("unrecognized-version", {
            availableBytes: bytes.byteLength,
        });
    }
    return null;
}

function analyzeImageVersion(word) {
    var version = word >>> 0;
    var baseVersion = (version & IMAGE_HEADER_VERSION_MASK) >>> 0;
    return {
        word: version,
        wordHex: formatWord(version),
        baseVersion: baseVersion,
        baseVersionHex: formatWord(baseVersion),
        isSpur: (version & 16) !== 0,
        is64Bit: version >= 68000,
        nativeFloats: (version & 1) !== 0,
    };
}

function formatWord(word) {
    var hex = (word >>> 0).toString(16).toUpperCase();
    while (hex.length < 8) hex = "0" + hex;
    return "0x" + hex;
}

function cloneProbe(probe) {
    return {
        offset: probe.offset,
        littleEndian: probe.littleEndian,
        word: probe.word,
        wordHex: probe.wordHex,
        baseVersion: probe.baseVersion,
        baseVersionHex: probe.baseVersionHex,
        recognized: probe.recognized,
    };
}

function ImageHeaderAudit(imageName) {
    this.imageName = imageName || "image";
    this.reset(this.imageName);
}

ImageHeaderAudit.prototype.reset = function(imageName) {
    if (imageName) this.imageName = imageName;
    this.probes = [];
    this.match = null;
    this.issues = [];
    this.resolutions = [];
};

ImageHeaderAudit.prototype.recordProbe = function(probe) {
    var normalized = {
        offset: probe.offset,
        littleEndian: !!probe.littleEndian,
        word: probe.word >>> 0,
    };
    normalized.wordHex = formatWord(normalized.word);
    normalized.baseVersion = (normalized.word & IMAGE_HEADER_VERSION_MASK) >>> 0;
    normalized.baseVersionHex = formatWord(normalized.baseVersion);
    normalized.recognized = !!probe.recognized;
    this.probes.push(normalized);
    return normalized;
};

ImageHeaderAudit.prototype.registerMatch = function(info) {
    if (!info) return;
    this.match = {
        littleEndian: !!info.littleEndian,
        fileHeaderSize: info.fileHeaderSize || 0,
        version: analyzeImageVersion(info.version),
    };
};

ImageHeaderAudit.prototype.recordIssue = function(code, details) {
    var issueDetails = details || {};
    if (!issueDetails.probes && this.probes.length) {
        issueDetails.probes = this.probes.map(cloneProbe);
    }
    if (!issueDetails.version && this.match) {
        issueDetails.version = this.match.version;
    }
    var entry = {
        code: code,
        message: "",
        guidance: "",
        details: issueDetails,
    };
    switch (code) {
        case "insufficient-bytes":
            entry.message = 'Image header for "' + this.imageName + '" is truncated';
            entry.guidance = "Verify the download completed and pass the raw .image bytes to SqueakJS.";
            entry.details = {
                availableBytes: issueDetails.availableBytes || 0,
                requiredBytes: issueDetails.requiredBytes || 4,
            };
            break;
        case "unrecognized-version":
            entry.message = 'Image header for "' + this.imageName + '" is not recognized as a Squeak format.';
            entry.guidance = "Ensure the file is a valid Squeak/Pharo/Cuis image and, if necessary, export a Spur image using a desktop VM.";
            entry.details = {
                availableBytes: issueDetails.availableBytes || 0,
                probes: issueDetails.probes || this.probes.map(cloneProbe),
            };
            break;
        case "unsupported-nonspur-64":
            entry.message = 'Image "' + this.imageName + '" is 64-bit but not Spur, which SqueakJS cannot execute.';
            entry.guidance = "Open the image in a modern Cog/Spur VM and save it as a Spur 64-bit image before loading it in SqueakJS.";
            entry.details = Object.assign({}, issueDetails, {
                version: issueDetails.version || (this.match && this.match.version ? this.match.version : null),
            });
            break;
        default:
            entry.message = 'Image "' + this.imageName + '" encountered an unsupported header configuration.';
            entry.guidance = issueDetails.guidance || "";
    }
    this.issues.push(entry);
    if (typeof console !== "undefined" && console && typeof console.error === "function") {
        console.error("[squeak:image] " + entry.message, {
            guidance: entry.guidance,
            details: entry.details,
        });
    }
    return entry;
};

Squeak.ImageHeaderAudit = ImageHeaderAudit;

var COMPAT_METADATA_MAGIC = "IMCK";
var COMPAT_FLAG_CONVERTED = 0x1;
var COMPAT_MAX_CAPTURE_BYTES = 32 * 1024 * 1024;

function tryLoadNativeCompatibilityImageFromBuffer(options) {
    if (!options) return null;
    var bytes = options.bytes instanceof Uint8Array ? options.bytes
        : options.buffer instanceof ArrayBuffer ? new Uint8Array(options.buffer)
        : null;
    if (!bytes || bytes.byteLength === 0) return null;
    var snapshot = parseNativeCompatibilitySnapshot(bytes, !!options.littleEndian, options.headerInfo);
    if (!snapshot) return null;
    snapshot.source = options.source || "buffer";
    snapshot.imageName = options.imageName || snapshot.imageName || "image";
    if (options.audit && typeof options.audit.recordResolution === "function") {
        options.audit.recordResolution("native-compat-loader", {
            version: snapshot.version,
            metadata: snapshot.metadata,
            byteLength: snapshot.byteLength,
            source: snapshot.source,
        });
    }
    return snapshot;
}

function parseNativeCompatibilitySnapshot(bytes, littleEndian, headerInfo) {
    if (!bytes || bytes.byteLength < 64) return null;
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var metadataOffset = view.getUint32(4, true);
    if (!isFinite(metadataOffset) || metadataOffset < 0) return null;
    if (metadataOffset + 32 > view.byteLength) return null;
    if (!matchesCompatMagic(view, metadataOffset)) return null;
    var schemaVersion = view.getUint32(metadataOffset + 4, true);
    var objectCount = view.getUint32(metadataOffset + 8, true);
    var selectorCount = view.getUint32(metadataOffset + 12, true);
    var objectTableOffset = view.getUint32(metadataOffset + 16, true);
    var selectorTableOffset = view.getUint32(metadataOffset + 20, true);
    var flags = view.getUint32(metadataOffset + 24, true);
    var requiredObjectBytes = metadataOffset + objectTableOffset + objectCount * 4;
    if (requiredObjectBytes > view.byteLength) return null;
    var ids = [];
    var idOffset = metadataOffset + objectTableOffset;
    for (var i = 0; i < objectCount; i++) {
        ids.push(view.getUint32(idOffset + (i * 4), true));
    }
    var selectorOffset = metadataOffset + selectorTableOffset;
    if (selectorOffset > view.byteLength) return null;
    var names = [];
    var cursor = selectorOffset;
    for (var j = 0; j < selectorCount; j++) {
        if (cursor >= view.byteLength) return null;
        var length = view.getUint8(cursor++);
        if (cursor + length > view.byteLength) return null;
        names.push(readAscii(bytes, cursor, length));
        cursor += length;
    }
    var versionWord = view.getUint32(0, littleEndian);
    var version = analyzeImageVersion(versionWord);
    var snapshot = {
        format: "native-nonspur64",
        version: version,
        versionWord: versionWord >>> 0,
        metadataOffset: metadataOffset,
        metadata: {
            schemaVersion: schemaVersion,
            flags: flags >>> 0,
            converted: (flags & COMPAT_FLAG_CONVERTED) !== 0,
            objects: {
                total: objectCount,
                ids: ids,
            },
            selectors: {
                total: selectorCount,
                names: names,
            },
        },
        headerInfo: headerInfo || null,
        byteLength: bytes.byteLength,
        bytes: new Uint8Array(bytes),
        littleEndian: !!littleEndian,
    };
    return snapshot;
}

function matchesCompatMagic(view, offset) {
    if (offset + COMPAT_METADATA_MAGIC.length > view.byteLength) return false;
    for (var i = 0; i < COMPAT_METADATA_MAGIC.length; i++) {
        if (view.getUint8(offset + i) !== COMPAT_METADATA_MAGIC.charCodeAt(i)) return false;
    }
    return true;
}

function readAscii(bytes, offset, length) {
    var chars = [];
    for (var i = 0; i < length; i++) {
        chars.push(String.fromCharCode(bytes[offset + i]));
    }
    return chars.join("");
}

function CompatibilityImageRecorder(initialBytes) {
    this.active = true;
    this.total = 0;
    this.chunks = [];
    if (initialBytes && initialBytes.byteLength) this.record(initialBytes);
}

CompatibilityImageRecorder.prototype.record = function(bytes) {
    if (!this.active || !bytes || !bytes.byteLength) return;
    if (this.total + bytes.byteLength > COMPAT_MAX_CAPTURE_BYTES) {
        this.disable();
        return;
    }
    var copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    this.chunks.push(copy);
    this.total += copy.byteLength;
};

CompatibilityImageRecorder.prototype.collect = async function(reader) {
    if (!this.active) return null;
    if (!reader || typeof reader.takeRemaining !== "function") return null;
    var remaining = await reader.takeRemaining();
    for (var i = 0; i < remaining.length; i++) {
        this.record(remaining[i]);
    }
    this.active = false;
    var merged = mergeUint8Chunks(this.chunks);
    this.chunks = [];
    this.total = merged.byteLength;
    return merged;
};

CompatibilityImageRecorder.prototype.disable = function() {
    this.active = false;
    this.total = 0;
    this.chunks = [];
};

function mergeUint8Chunks(chunks) {
    if (!chunks || chunks.length === 0) return new Uint8Array(0);
    var total = 0;
    for (var i = 0; i < chunks.length; i++) total += chunks[i].byteLength;
    var out = new Uint8Array(total);
    var offset = 0;
    for (var j = 0; j < chunks.length; j++) {
        out.set(chunks[j], offset);
        offset += chunks[j].byteLength;
    }
    return out;
}
ImageHeaderAudit.prototype.recordResolution = function(code, details) {
    var entry = {
        code: code,
        message: "",
        guidance: "",
        details: details || {},
    };
    switch (code) {
        case "native-compat-loader":
            entry.message = 'Image "' + this.imageName + '" loaded via native compatibility path.';
            entry.guidance = "Legacy 64-bit headers were parsed natively; no manual conversion required.";
            break;
        default:
            entry.message = 'Image "' + this.imageName + '" resolved using a compatibility handler.';
    }
    if (!entry.details.version && this.match) {
        entry.details.version = this.match.version;
    }
    if (!entry.details.probes && this.probes.length) {
        entry.details.probes = this.probes.map(cloneProbe);
    }
    this.resolutions.push(entry);
    if (typeof console !== "undefined" && console && typeof console.info === "function") {
        console.info("[squeak:image] " + entry.message, {
            guidance: entry.guidance,
            details: entry.details,
        });
    }
    return entry;
};

async function readBits(reader, nWords, isPointers, wordSize, littleEndian, is64Bit, readWord) {
    if (nWords <= 0) return isPointers ? [] : new Uint32Array(0);
    if (isPointers) {
        var oops = new Array(nWords);
        for (var i = 0; i < nWords; i++) {
            oops[i] = await readWord();
        }
        return oops;
    }
    var byteLength = nWords * wordSize;
    var bytes = await reader.read(byteLength);
    var buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new Uint32Array(buffer);
}

Squeak.ImageStreamCursor = function(iterator, options) {
    this.iterator = iterator;
    this.buffers = [];
    this._buffered = 0;
    this._consumed = 0;
    this._headerOffset = 0;
    this._fetched = 0;
    this.totalBytes = options && typeof options.totalBytes === "number" ? options.totalBytes : null;
    this.onChunk = options && typeof options.onChunk === "function" ? options.onChunk : null;
    this.onProgress = options && typeof options.onProgress === "function" ? options.onProgress : null;
    this.resume = options && typeof options.resume === "function" ? options.resume : null;
    this.maxResumes = options && typeof options.maxResumes === "number"
        ? options.maxResumes : (this.resume ? 1 : 0);
    this.onRecovery = options && typeof options.onRecovery === "function" ? options.onRecovery : null;
    this._resumeAttempts = 0;
};

Squeak.ImageStreamCursor.prototype.ensure = async function(bytes) {
    while (this._buffered < bytes) {
        var result;
        try {
            result = await this.iterator.next();
        } catch (error) {
            if (await this._attemptResume({ reason: "error", error: error })) continue;
            throw error;
        }
        if (result.done) {
            if (await this._attemptResume({ reason: "done" })) continue;
            break;
        }
        var chunk = normalizeChunk(result.value);
        if (!chunk || chunk.byteLength === 0) continue;
        if (this.onChunk) this.onChunk(chunk);
        this.buffers.push(chunk);
        this._buffered += chunk.byteLength;
        this._fetched += chunk.byteLength;
        if (this.onProgress) this.onProgress(this._fetched, this.totalBytes);
    }
    return this._buffered >= bytes;
};

Squeak.ImageStreamCursor.prototype.getResumeAttempts = function() {
    return this._resumeAttempts;
};

Squeak.ImageStreamCursor.prototype._attemptResume = async function(meta) {
    if (!this.resume) return false;
    if (this._resumeAttempts >= this.maxResumes) return false;
    var info = {
        attempts: this._resumeAttempts,
        fetched: this._fetched,
        consumed: this._consumed,
        buffered: this._buffered,
        offset: this._consumed + this._buffered,
        totalBytes: this.totalBytes,
        reason: meta && meta.reason ? meta.reason : "unknown",
        error: meta && meta.error ? meta.error : null,
    };
    var result;
    try {
        result = await this.resume(info);
    } catch (error) {
        if (this.onRecovery) {
            try { this.onRecovery(Object.assign({}, info, { outcome: "failed", error: error })); }
            catch (recoveryError) { console.warn("image stream recovery handler failed", recoveryError); }
        }
        return false;
    }
    if (!result) {
        if (this.onRecovery) {
            try { this.onRecovery(Object.assign({}, info, { outcome: "declined" })); }
            catch (recoveryError2) { console.warn("image stream recovery handler failed", recoveryError2); }
        }
        return false;
    }
    if (result.reset) {
        var resetError = new Error(result.message || "image stream reset");
        resetError.name = "ImageStreamReset";
        resetError.streamReset = true;
        resetError.resumeInfo = info;
        throw resetError;
    }
    var iterator = result.iterator || result;
    if (!iterator || typeof iterator.next !== "function") {
        if (this.onRecovery) {
            try { this.onRecovery(Object.assign({}, info, { outcome: "invalid" })); }
            catch (recoveryError3) { console.warn("image stream recovery handler failed", recoveryError3); }
        }
        return false;
    }
    this.iterator = iterator;
    if (typeof result.totalBytes === "number" && result.totalBytes > 0) {
        this.totalBytes = result.totalBytes;
    }
    if (result.dropBuffered) {
        this.buffers = [];
        this._buffered = 0;
    }
    if (typeof result.adjustFetched === "number" && isFinite(result.adjustFetched)) {
        this._fetched = result.adjustFetched;
    }
    this._resumeAttempts++;
    if (this.onRecovery) {
        try { this.onRecovery(Object.assign({}, info, { outcome: "resumed" })); }
        catch (recoveryError4) { console.warn("image stream recovery handler failed", recoveryError4); }
    }
    return true;
};

Squeak.ImageStreamCursor.prototype.peek = function(bytes, offset) {
    offset = offset || 0;
    if (this._buffered < bytes + offset) throw Error("not enough buffered data");
    var out = new Uint8Array(bytes);
    var remaining = bytes;
    var copyOffset = 0;
    var skip = offset;
    for (var i = 0; i < this.buffers.length && remaining > 0; i++) {
        var buffer = this.buffers[i];
        if (skip >= buffer.byteLength) {
            skip -= buffer.byteLength;
            continue;
        }
        var start = skip;
        var take = Math.min(remaining, buffer.byteLength - start);
        out.set(buffer.subarray(start, start + take), copyOffset);
        copyOffset += take;
        remaining -= take;
        skip = 0;
    }
    return out;
};

Squeak.ImageStreamCursor.prototype.drop = function(bytes) {
    var remaining = bytes;
    while (remaining > 0) {
        if (!this.buffers.length) throw Error("drop exceeds buffer");
        var buffer = this.buffers[0];
        if (remaining < buffer.byteLength) {
            this.buffers[0] = buffer.subarray(remaining);
            this._buffered -= remaining;
            this._consumed += remaining;
            return;
        }
        this.buffers.shift();
        this._buffered -= buffer.byteLength;
        this._consumed += buffer.byteLength;
        remaining -= buffer.byteLength;
    }
};

Squeak.ImageStreamCursor.prototype.read = async function(bytes) {
    if (!(await this.ensure(bytes))) throw Error("unexpected end of stream");
    var out = new Uint8Array(bytes);
    var remaining = bytes;
    var offset = 0;
    while (remaining > 0) {
        var buffer = this.buffers[0];
        if (remaining < buffer.byteLength) {
            out.set(buffer.subarray(0, remaining), offset);
            this.buffers[0] = buffer.subarray(remaining);
            this._buffered -= remaining;
            this._consumed += remaining;
            remaining = 0;
        } else {
            out.set(buffer, offset);
            offset += buffer.byteLength;
            remaining -= buffer.byteLength;
            this.buffers.shift();
            this._buffered -= buffer.byteLength;
            this._consumed += buffer.byteLength;
        }
    }
    return out;
};

Squeak.ImageStreamCursor.prototype.markHeaderComplete = function() {
    this._headerOffset = this._consumed;
};

Squeak.ImageStreamCursor.prototype.bytesReadSinceHeader = function() {
    return this._consumed - this._headerOffset;
};

Squeak.ImageStreamCursor.prototype.bufferedSize = function() {
    return this._buffered;
};

Squeak.ImageStreamCursor.prototype.consumeRemaining = function() {
    while (this.buffers.length > 0) {
        var buffer = this.buffers.shift();
        this._buffered -= buffer.byteLength;
        this._consumed += buffer.byteLength;
    }
};

Squeak.ImageStreamCursor.prototype.takeRemaining = async function() {
    var chunks = [];
    while (this.buffers.length > 0) {
        var buffer = this.buffers.shift();
        this._buffered -= buffer.byteLength;
        this._consumed += buffer.byteLength;
        chunks.push(buffer);
    }
    while (true) {
        var result = await this.iterator.next();
        if (result.done) break;
        var chunk = normalizeChunk(result.value);
        if (!chunk || chunk.byteLength === 0) continue;
        if (this.onChunk) this.onChunk(chunk);
        this._fetched += chunk.byteLength;
        if (this.onProgress && this.totalBytes) {
            this.onProgress(this._fetched, this.totalBytes);
        }
        this._consumed += chunk.byteLength;
        chunks.push(chunk);
    }
    return chunks;
};

function normalizeChunk(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (value && value.buffer instanceof ArrayBuffer && typeof value.byteLength === "number") {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return null;
}
