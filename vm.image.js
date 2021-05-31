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
    A partial GC links new objects to support enumeration of new space.

    Weak references are finalized by a full GC. A partial GC only finalizes young weak references.

    */
    }
},
'initializing', {
    initialize: function(name) {
        this.headRoom = 32000000; // TODO: pass as option
        this.totalMemory = 0;
        this.name = name;
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
    },
    readFromBuffer: function(arraybuffer, thenDo, progressDo) {
        console.log('squeak: reading ' + this.name + ' (' + arraybuffer.byteLength + ' bytes)');
        this.startupTime = Date.now();
        var data = new DataView(arraybuffer),
            littleEndian = false,
            pos = 0;
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
        var versions = [6501, 6502, 6504, 6505, 6521, 68000, 68002, 68003, 68021],
            version = 0,
            fileHeaderSize = 0;
        while (true) {  // try all four endianness + header combos
            littleEndian = !littleEndian;
            pos = fileHeaderSize;
            version = readWord();
            if (versions.indexOf(version) >= 0) break;
            if (!littleEndian) fileHeaderSize += 512;
            if (fileHeaderSize > 512) throw Error("bad image version");
        };
        this.version = version;
        var nativeFloats = [6505, 6521, 68003, 68021].indexOf(version) >= 0;
        this.hasClosures = [6504, 6505, 6521, 68002, 68003, 68021].indexOf(version) >= 0;
        this.isSpur = [6521, 68021].indexOf(version) >= 0;
        var is64Bit = version >= 68000;
        if (is64Bit && !this.isSpur) throw Error("64 bit non-spur images not supported yet");
        if (is64Bit)  { readWord = readWord64; wordSize = 8; }
        // parse image header
        var imageHeaderSize = readWord32(); // always 32 bits
        var objectMemorySize = readWord(); //first unused location in heap
        var oldBaseAddr = readWord(); //object memory base address of image
        var specialObjectsOopInt = readWord(); //oop of array of special oops
        this.savedHeaderWords = [];
        for (var i = 0; i < 7; i++) {
            this.savedHeaderWords.push(readWord32());
            if (is64Bit && i < 3) readWord32(); // skip half
        }
        var firstSegSize = readWord();
        var prevObj;
        var oopMap = {};
        var rawBits = {};
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
                oopMap[oldBaseAddr + oop] = object;
                //rawBits holds raw content bits for objects
                rawBits[oop] = bits;
            }
            this.firstOldObject = oopMap[oldBaseAddr+4];
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
                        oopMap[oldBaseAddr + oop] = object;
                        //rawBits holds raw content bits for objects
                        rawBits[oop] = bits;
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
                        if (classID) oopMap[oldBaseAddr + oop] = bits;  // used in spurClassTable()
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
            this.firstOldObject = oopMap[oldBaseAddr];
            this.lastOldObject = object;
            this.lastOldObject.nextObject = null; // Add next object pointer as indicator this is in fact an old object
        }

        this.totalMemory = this.oldSpaceBytes + this.headRoom;

        if (true) {
            // For debugging: re-create all objects from named prototypes
            var _splObs = oopMap[specialObjectsOopInt],
                cc = this.isSpur ? this.spurClassTable(oopMap, rawBits, classPages, _splObs)
                    : rawBits[oopMap[rawBits[_splObs.oop][Squeak.splOb_CompactClasses]].oop];
            var renamedObj = null;
            object = this.firstOldObject;
            prevObj = null;
            while (object) {
                prevObj = renamedObj;
                renamedObj = object.renameFromImage(oopMap, rawBits, cc);
                if (prevObj) prevObj.nextObject = renamedObj;
                else this.firstOldObject = renamedObj;
                oopMap[oldBaseAddr + object.oop] = renamedObj;
                object = object.nextObject;
            }
            this.lastOldObject = renamedObj;
            this.lastOldObject.nextObject = null; // Add next object pointer as indicator this is in fact an old object
        }

        // properly link objects by mapping via oopMap
        var splObs         = oopMap[specialObjectsOopInt];
        var compactClasses = rawBits[oopMap[rawBits[splObs.oop][Squeak.splOb_CompactClasses]].oop];
        var floatClass     = oopMap[rawBits[splObs.oop][Squeak.splOb_ClassFloat]];
        // Spur needs different arguments for installFromImage()
        if (this.isSpur) {
            this.initImmediateClasses(oopMap, rawBits, splObs);
            compactClasses = this.spurClassTable(oopMap, rawBits, classPages, splObs);
            nativeFloats = this.getCharacter.bind(this);
            this.initSpurOverrides();
        }
        var obj = this.firstOldObject,
            done = 0;
        var mapSomeObjects = function() {
            if (obj) {
                var stop = done + (this.oldSpaceCount / 20 | 0);    // do it in 20 chunks
                while (obj && done < stop) {
                    obj.installFromImage(oopMap, rawBits, compactClasses, floatClass, littleEndian, nativeFloats, is64Bit && {
                            makeFloat: function makeFloat(bits) {
                                return this.instantiateFloat(bits);
                            }.bind(this),
                            makeLargeFromSmall: function makeLargeFromSmall(hi, lo) {
                                return this.instantiateLargeFromSmall(hi, lo);
                            }.bind(this),
                        });
                    obj = obj.nextObject;
                    done++;
                }
                if (progressDo) progressDo(done / this.oldSpaceCount);
                return true;    // do more
            } else { // done
                this.specialObjectsArray = splObs;
                this.decorateKnownObjects();
                if (this.isSpur) {
                    this.fixSkippedOops(oopAdjust);
                    if (is64Bit) this.fixPCs();
                    this.ensureFullBlockClosureClass(this.specialObjectsArray, compactClasses);
                } else {
                    this.fixCompiledMethods();
                    this.fixCompactOops();
                }
                return false;   // don't do more
            }
        }.bind(this);
        function mapSomeObjectsAsync() {
            if (mapSomeObjects()) {
                self.setTimeout(mapSomeObjectsAsync, 0);
            } else {
                if (thenDo) thenDo();
            }
        };
        if (!progressDo) {
            while (mapSomeObjects()) {};   // do it synchronously
            if (thenDo) thenDo();
        } else {
            self.setTimeout(mapSomeObjectsAsync, 0);
        }
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
        var newObjects = this.markReachableObjects();
        this.removeUnmarkedOldObjects();
        this.appendToOldObjects(newObjects);
        this.finalizeWeakReferences();
        this.allocationCount += this.newSpaceCount;
        this.newSpaceCount = 0;
        this.youngSpaceCount = 0;
        this.hasNewInstances = {};
        this.gcCount++;
        this.gcMilliseconds += Date.now() - start;
        console.log("Full GC (" + reason + "): " + (Date.now() - start) + " ms");
        return newObjects.length > 0 ? newObjects[0] : null;
    },
    gcRoots: function() {
        // the roots of the system
        this.vm.storeContextRegisters();        // update active context
        return [this.specialObjectsArray, this.vm.activeContext];
    },
    markReachableObjects: function() {
        // FullGC: Visit all reachable objects and mark them.
        // Return surviving new objects
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
        this.vm.addMessage("partialGC: " + reason);
        var start = Date.now();
        var young = this.findYoungObjects();
        this.appendToYoungSpace(young);
        this.finalizeWeakReferences();
        this.cleanupYoungSpace(young);
        this.allocationCount += this.newSpaceCount - young.length;
        this.youngSpaceCount = young.length;
        this.newSpaceCount = this.youngSpaceCount;
        this.pgcCount++;
        this.pgcMilliseconds += Date.now() - start;
        console.log("Partial GC (" + reason+ "): " + (Date.now() - start) + " ms");
        return young[0];
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
                object.dirty = dirty;
            }
            object = object.nextObject;
        }
        return roots;
    },
    findYoungObjects: function() {
        // PartialGC: find new objects transitively reachable from old objects
        var todo = this.youngRoots(),     // direct pointers from old space
            newObjects = [];
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
        return newObject;
    },
    clone: function(object) {
        var newObject = new (object.sqClass.classInstProto()); // Squeak.Object
        var hash = this.registerObject(newObject);
        newObject.initAsClone(object, hash);
        this.hasNewInstances[newObject.sqClass.oop] = true;   // need GC to find all instances
        return newObject;
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
        return this.totalMemory - this.oldSpaceBytes;
    },
    formatVersion: function() {
        return this.isSpur ? 6521 : this.hasClosures ? 6504 : 6502;
    },
    segmentVersion: function() {
        var dnu = this.specialObjectsArray.pointers[Squeak.splOb_SelectorDoesNotUnderstand],
            wholeWord = new Uint32Array(dnu.bytes.buffer, 0, 1);
        return this.formatVersion() | (wholeWord[0] & 0xFF000000);
    },
    loadImageSegment: function(segmentWordArray, outPointerArray) {
        // The C VM creates real objects from the segment in-place.
        // We do the same, linking the new objects directly into old-space.
        // The code below is almost the same as readFromBuffer() ... should unify
        var data = new DataView(segmentWordArray.words.buffer),
            littleEndian = false,
            nativeFloats = false,
            pos = 0;
        var readWord = function() {
            var int = data.getUint32(pos, littleEndian);
            pos += 4;
            return int;
        };
        var readBits = function(nWords, format) {
            if (format < 5) { // pointers (do endian conversion)
                var oops = [];
                while (oops.length < nWords)
                    oops.push(readWord());
                return oops;
            } else { // words (no endian conversion yet)
                var bits = new Uint32Array(data.buffer, pos, nWords);
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
            oopMap = {},
            rawBits = {};
        while (pos < data.byteLength) {
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
            oopMap[oop] = object;
            rawBits[oop + oopOffset] = bits;
        }
        object.nextObject = endMarker;
        // add outPointers to oopMap
        for (var i = 0; i < outPointerArray.pointers.length; i++)
            oopMap[0x80000004 + i * 4] = outPointerArray.pointers[i];
        // add compactClasses to oopMap
        var compactClasses = this.specialObjectsArray.pointers[Squeak.splOb_CompactClasses].pointers,
            fakeClsOop = 0, // make up a compact-classes array with oops, as if loading an image
            compactClassOops = compactClasses.map(function(cls) {
                oopMap[--fakeClsOop] = cls; return fakeClsOop; });
        // truncate segmentWordArray array to one element
        segmentWordArray.words = new Uint32Array([segmentWordArray.words[0]]);
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
    },
    spurClassTable: function(oopMap, rawBits, classPages, splObjs) {
        var classes = {},
            nil = this.firstOldObject;
        // read class table pages
        for (var p = 0; p < 4096; p++) {
            var page = oopMap[classPages[p]];
            if (page.oop) page = rawBits[page.oop]; // page was not properly hidden
            if (page.length === 1024) for (var i = 0; i < 1024; i++) {
                var entry = oopMap[page[i]];
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
                var knownClass = oopMap[rawBits[splObjs.oop][Squeak[key]]];
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
        var special = rawBits[splObs.oop];
        this.characterClass = oopMap[special[Squeak.splOb_ClassCharacter]];
        this.floatClass = oopMap[special[Squeak.splOb_ClassFloat]];
        this.largePosIntClass = oopMap[special[Squeak.splOb_ClassLargePositiveInteger]];
        this.largeNegIntClass = oopMap[special[Squeak.splOb_ClassLargeNegativeInteger]];
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
                    if (classObj.hash !== classID && classID >= 32) {
                        console.warn("freeing class index " + classID + " " + classObj.className());
                        classObj = null;
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
});
