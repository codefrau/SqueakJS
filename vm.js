module('users.bert.SqueakJS.vm').requires().toRun(function() {
/*
 * Copyright (c) 2013,2014 Bert Freudenberg
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
 
// shorter name for convenience
window.Squeak = users.bert.SqueakJS.vm;

Object.extend(Squeak, {
    // system attributes
    vmVersion: "SqueakJS 0.5.5",
    vmBuild: "unknown",                 // replace at runtime by last-modified?
    vmPath: "/",
    vmFile: "vm.js",
    platformName: "Web",
    platformSubtype: "unknown",
    osVersion: navigator.userAgent,     // might want to parse
    windowSystem: "HTML",

    // object headers
    HeaderTypeMask: 3,
    HeaderTypeSizeAndClass: 0, //3-word header
    HeaderTypeClass: 1,        //2-word header
    HeaderTypeFree: 2,         //free block
    HeaderTypeShort: 3,        //1-word header
    
    // Indices into SpecialObjects array
    splOb_NilObject: 0,
    splOb_FalseObject: 1,
    splOb_TrueObject: 2,
    splOb_SchedulerAssociation: 3,
    splOb_ClassBitmap: 4,
    splOb_ClassInteger: 5,
    splOb_ClassString: 6,
    splOb_ClassArray: 7,
    splOb_SmalltalkDictionary: 8,
    splOb_ClassFloat: 9,
    splOb_ClassMethodContext: 10,
    splOb_ClassBlockContext: 11,
    splOb_ClassPoint: 12,
    splOb_ClassLargePositiveInteger: 13,
    splOb_TheDisplay: 14,
    splOb_ClassMessage: 15,
    splOb_ClassCompiledMethod: 16,
    splOb_TheLowSpaceSemaphore: 17,
    splOb_ClassSemaphore: 18,
    splOb_ClassCharacter: 19,
    splOb_SelectorDoesNotUnderstand: 20,
    splOb_SelectorCannotReturn: 21,
    splOb_TheInputSemaphore: 22,
    splOb_SpecialSelectors: 23,
    splOb_CharacterTable: 24,
    splOb_SelectorMustBeBoolean: 25,
    splOb_ClassByteArray: 26,
    splOb_ClassProcess: 27,
    splOb_CompactClasses: 28,
    splOb_TheTimerSemaphore: 29,
    splOb_TheInterruptSemaphore: 30,
    splOb_FloatProto: 31,
    splOb_SelectorCannotInterpret: 34,
    splOb_MethodContextProto: 35,
    splOb_ClassBlockClosure: 36,
    splOb_BlockContextProto: 37,
    splOb_ExternalObjectsArray: 38,
    splOb_ClassPseudoContext: 39,
    splOb_ClassTranslatedMethod: 40,
    splOb_TheFinalizationSemaphore: 41,
    splOb_ClassLargeNegativeInteger: 42,
    splOb_ClassExternalAddress: 43,
    splOb_ClassExternalStructure: 44,
    splOb_ClassExternalData: 45,
    splOb_ClassExternalFunction: 46,
    splOb_ClassExternalLibrary: 47,
    splOb_SelectorAboutToReturn: 48,
    
    // Class layout:
    Class_superclass: 0,
    Class_mdict: 1,
    Class_format: 2,
    Class_instVars: null,   // 3 or 4 depending on image, see instVarNames()
    Class_name: 6,
    // Context layout:
    Context_sender: 0,
    Context_instructionPointer: 1,
    Context_stackPointer: 2,
    Context_method: 3,
    Context_closure: 4,
    Context_receiver: 5,
    Context_tempFrameStart: 6,
    Context_smallFrameSize: 17,
    Context_largeFrameSize: 57,
    BlockContext_caller: 0,
    BlockContext_argumentCount: 3,
    BlockContext_initialIP: 4,
    BlockContext_home: 5,
    // Closure layout:
    Closure_outerContext: 0,
	Closure_startpc: 1,
	Closure_numArgs: 2,
	Closure_firstCopiedValue: 3,
    // Stream layout:
    Stream_array: 0,
    Stream_position: 1,
    Stream_limit: 2,
    //ProcessorScheduler layout:
    ProcSched_processLists: 0,
    ProcSched_activeProcess: 1,
    //Link layout:
    Link_nextLink: 0,
    //LinkedList layout:
    LinkedList_firstLink: 0,
    LinkedList_lastLink: 1,
    //Semaphore layout:
    Semaphore_excessSignals: 2,
    //Process layout:
    Proc_suspendedContext: 1,
    Proc_priority: 2,
    Proc_myList: 3,	
    // Association layout:
    Assn_key: 0,
    Assn_value: 1,
    // MethodDict layout:
    MethodDict_array: 1,
    MethodDict_selectorStart: 2,
    // Message layout
    Message_selector: 0,
    Message_arguments: 1,
    Message_lookupClass: 2,
    // Point layout:
    Point_x: 0,
    Point_y: 1,
    // LargetInteger layout:
    LargeInteger_bytes: 0,
    LargeInteger_neg: 1,
    // BitBlt layout:
    BitBlt_dest: 0,
    BitBlt_source: 1,
    BitBlt_halftone: 2,
    BitBlt_combinationRule: 3,
    BitBlt_destX: 4,
    BitBlt_destY: 5,
    BitBlt_width: 6,
    BitBlt_height: 7,
    BitBlt_sourceX: 8,
    BitBlt_sourceY: 9,
    BitBlt_clipX: 10,
    BitBlt_clipY: 11,
    BitBlt_clipW: 12,
    BitBlt_clipH: 13,
    BitBlt_colorMap: 14,
    BitBlt_warpBase: 15,
    // Form layout:
    Form_bits: 0,
    Form_width: 1,
    Form_height: 2,
    Form_depth: 3,
    
    // Event constants
    Mouse_Blue: 1,
    Mouse_Yellow: 2,
    Mouse_Red: 4,
    Keyboard_Shift: 8,
    Keyboard_Ctrl: 16,
    Keyboard_Alt: 32,
    Keyboard_Cmd: 64,
    Mouse_All: 1 + 2 + 4,
    Keyboard_All: 8 + 16 + 32 + 64,
    EventTypeNone: 0,
    EventTypeMouse: 1,
    EventTypeKeyboard: 2,
    EventKeyChar: 0,
    EventKeyDown: 1,
    EventKeyUp: 2,

    // other constants
    MinSmallInt: -0x40000000,
    MaxSmallInt:  0x3FFFFFFF,
    NonSmallInt: -0x50000000,           // non-small and neg (so non pos32 too)
    MillisecondClockMask: 0x1FFFFFFF,
    Epoch: Date.UTC(1901,0,1)/1000 + (new Date()).getTimezoneOffset()*60,         // local timezone
});

Object.extend(Squeak, {
    // don't clobber registered modules
    externalModules: Squeak.externalModules || {},
    registerExternalModule: function(name, module) {
        this.externalModules[name] = module;
    },
});

Object.subclass('Squeak.Image',
'about', {
    about: function() {
    /*
    Object Format
    =============
    Each Squeak object is a Squeak.Object instance, only SmallIntegers are JS numbers.
    Instance variables/fields reference other objects directly via the "pointers" property.
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
        nextObject: linked list of objects in old space (new space objects do not have this yet)
    }

    Object Table
    ============
    There is no actual object table. Instead, objects in old space are a linked list.
    New objects are only referenced by other objects' pointers, and thus can be garbage-collected
    at any time by the Javascript GC.
    
    There is no support for weak references yet.

    */    
    }
},
'initializing', {
    initialize: function(arraybuffer, name) {
        this.totalMemory = 100000000; 
        this.name = name;
        this.gcCount = 0;
        this.gcTenured = 0;
        this.gcCompacted = 0;
        this.gcMilliseconds = 0;
        this.allocationCount = 0;
        this.oldSpaceCount = 0;
        this.newSpaceCount = 0;
        this.hasNewInstances = {};
        this.readFromBuffer(arraybuffer);
    },
    readFromBuffer: function(arraybuffer) {
        var data = new DataView(arraybuffer),
            littleEndian = false,
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
                var bits = new Uint32Array(arraybuffer, pos, nWords);
                pos += nWords*4;
                return bits;
            }
        };
        // read version and determine endianness
        var versions = [6502, 6504, 6505, 68000, 68002, 68003],
            version = readWord();
        if (versions.indexOf(version) < 0) {
            littleEndian = true; pos = 0;
            version = readWord();
            if (versions.indexOf(version) < 0) throw Error("bad image version");
        }
        var nativeFloats = (version & 1) != 0;
        this.hasClosures = version == 6504 || version == 68002 || nativeFloats;
        if (version >= 68000) throw Error("64 bit images not supported yet");

        // read header
        var headerSize = readWord();
        var endOfMemory = readWord(); //first unused location in heap
        var oldBaseAddr = readWord(); //object memory base address of image
        var specialObjectsOopInt = readWord(); //oop of array of special oops
        this.lastHash = readWord(); //Should be loaded from, and saved to the image header
        var savedWindowSize = readWord();
        var fullScreenFlag = readWord();
        var extraVMMemory = readWord();
        pos += headerSize - (9 * 4); //skip to end of header
        // read objects
        var prevObj;
        var oopMap = {};
        console.log('squeak: reading objects');
        for (var ptr = 0; ptr < endOfMemory; ) {
            var nWords = 0;
            var classInt = 0;
            var header = readWord();
            switch (header & Squeak.HeaderTypeMask) {
                case Squeak.HeaderTypeSizeAndClass:
                    nWords = header >> 2;
                    classInt = readWord();
                    header = readWord();
                    ptr += 12;
                    break;
                case Squeak.HeaderTypeClass:
                    classInt = header - Squeak.HeaderTypeClass;
                    header = readWord();
                    nWords = (header >> 2) & 63;
                    ptr += 8;
                    break;
                case Squeak.HeaderTypeShort:
                    nWords = (header >> 2) & 63;
                    classInt = (header >> 12) & 31; //compact class index
                    //Note classInt<32 implies compact class index
                    ptr += 4;
                    break;
                case Squeak.HeaderTypeFree:
                    throw Error("Unexpected free block");
            }
            nWords--;  //length includes base header which we have already read
            var oop = ptr - 4, //0-rel byte oop of this object (base header)
                format = (header>>8) & 15,
                hash = (header>>17) & 4095,
                bits = readBits(nWords, format);
            ptr += nWords * 4;

            var object = new Squeak.Object();
            object.initFromImage(oop, classInt, format, hash, bits);
            if (prevObj) prevObj.nextObject = object;
            this.oldSpaceCount++;
            prevObj = object;
            //oopMap is from old oops to new objects
            oopMap[oldBaseAddr + oop] = object;
        }
        //create proper objects
        var splObs         = oopMap[specialObjectsOopInt];
        var compactClasses = oopMap[splObs.bits[Squeak.splOb_CompactClasses]].bits;
        var floatClass     = oopMap[splObs.bits[Squeak.splOb_ClassFloat]];
        console.log('squeak: mapping oops');
        for (var oop in oopMap)
            oopMap[oop].installFromImage(oopMap, compactClasses, floatClass, littleEndian, nativeFloats);
        this.specialObjectsArray = splObs;
        this.decorateKnownObjects();
        this.firstOldObject = oopMap[oldBaseAddr+4];
        this.lastOldObject = prevObj;
        this.oldSpaceBytes = endOfMemory;
     },
    decorateKnownObjects: function() {
        var splObjs = this.specialObjectsArray.pointers;
        splObjs[Squeak.splOb_NilObject].isNil = true;
        splObjs[Squeak.splOb_TrueObject].isTrue = true;
        splObjs[Squeak.splOb_FalseObject].isFalse = true;
        splObjs[Squeak.splOb_ClassFloat].isFloatClass = true;
        this.compactClasses = this.specialObjectsArray.pointers[Squeak.splOb_CompactClasses].pointers;
        for (var i = 0; i < this.compactClasses.length; i++)
            if (!this.compactClasses[i].isNil)
                this.compactClasses[i].isCompact = true;
        if (!Number.prototype.sqInstName)
            Object.defineProperty(Number.prototype, 'sqInstName', {
                enumerable: false,
                value: function() { return this.toString() }
            });
    }

},
'garbage collection', {
    partialGC: function() {
        // no partial GC needed since new space uses the Javascript GC
        return this.totalMemory - this.oldSpaceBytes;
    },
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
        var removedObjects = this.removeUnmarkedOldObjects();
        this.appendToOldObjects(newObjects);
        this.oldSpaceCount += newObjects.length - removedObjects.length;
        this.allocationCount += this.newSpaceCount;
        this.newSpaceCount = 0;
        this.hasNewInstances = {};
        this.gcCount++;
        this.gcTenured += newObjects.length;
        this.gcCompacted += removedObjects.length;
        this.gcMilliseconds += Date.now() - start;
        return newObjects.length > 0 ? newObjects[0] : null;
    },
    markReachableObjects: function() {
        // Visit all reachable objects and mark them.
        // Return surviving new objects
        // Contexts are handled specially: they have garbage beyond the stack pointer
        // which must not be traced, and is cleared out here
        this.vm.storeContextRegisters();        // update active context
        var todo = [this.specialObjectsArray, this.vm.activeContext];
        var newObjects = [];
        while (todo.length > 0) {
            var object = todo.pop();
            if (object.mark) continue;             // objects are added to todo more than once 
            if (!object.nextObject && object !== this.lastOldObject)       // it's a new object
                newObjects.push(object);
            object.mark = true;           // mark it
            if (!object.sqClass.mark)     // trace class if not marked
                todo.push(object.sqClass);
            var body = object.pointers;
            if (body) {                   // trace all unmarked pointers
                var n = body.length;
                if (this.vm.isContext(object))      // contexts have garbage beyond SP
                    n = object.contextSizeWithStack();
                for (var i = 0; i < n; i++)
                    if (typeof body[i] === "object" && !body[i].mark)      // except SmallInts
                        todo.push(body[i]);
                while (n < body.length)             // clean garbage from contexts 
                    body[n++] = this.vm.nilObj;
            }
        }
        // sort by oop to preserve creation order
        return newObjects.sort(function(a,b){return b.oop - a.oop});
    },
    removeUnmarkedOldObjects: function() {
        // Unlink unmarked old objects from the nextObject linked list
        // Reset marks of remaining objects, and adjust their oops
        // Set this.lastOldObject to last old object
        // Return removed old objects (to support finalization later)
        var removed = [],
            removedBytes = 0,
            obj = this.firstOldObject;
        obj.mark = false; // we know the first object (nil) was marked
        while (true) {
            var next = obj.nextObject;
            if (!next) {// we're done
                this.lastOldObject = obj;
                this.oldSpaceBytes -= removedBytes;
                return removed;
            }
            // if marked, continue with next object
            if (next.mark) {
                next.mark = false;     // unmark for next GC
                next.oop -= removedBytes;
                obj = next;
            } else { // otherwise, remove it
                var corpse = next; 
                obj.nextObject = corpse.nextObject; // drop from list
                removedBytes += corpse.totalBytes(); 
                removed.push(corpse);
            }
        }
    },
    appendToOldObjects: function(newObjects) {
        // append new objects to linked list of old objects
        // and unmark them
        var oldObj = this.lastOldObject;
        for (var i = 0; i < newObjects.length; i++) {
            var newObj = newObjects[i];
            newObj.mark = false;
            this.oldSpaceBytes = newObj.setAddr(this.oldSpaceBytes);     // add at end of memory
            oldObj.nextObject = newObj;
            oldObj = newObj;
        }
        this.lastOldObject = oldObj;
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
    instantiateClass: function(aClass, indexableSize, filler) {
        var newObject = new Squeak.Object();
        var hash = this.registerObject(newObject);
        newObject.initInstanceOf(aClass, indexableSize, hash, filler);
        this.hasNewInstances[aClass.oop] = true;   // need GC to find all instances
        return newObject;
    },
    clone: function(object) {
        var newObject = new Squeak.Object();
        var hash = this.registerObject(newObject);
        newObject.initAsClone(object, hash);
        this.hasNewInstances[newObject.sqClass.oop] = true;   // need GC to find all instances
        return newObject;
    },
},
'operations', {
    bulkBecome: function(fromArray, toArray, twoWay, copyHash) {
        var n = fromArray.length;
        if (n !== toArray.length)
            return false;
        // need to visit all objects, so ensure new objects have
        // nextObject pointers and permanent oops
        if (this.newSpaceCount > 0)
            this.fullGC("become");              // does update context
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
            var fromHash = fromArray[i].hash;
            fromArray[i].hash = toArray[i].hash;
            toArray[i].hash = fromHash;
        }
        // Now, for every object...
        var obj = this.firstOldObject;
        while (obj) {
            // mutate the class
            var mut = mutations[obj.sqClass.oop];
            if (mut) obj.sqClass = mut;
            // and mutate body pointers
            var body = obj.pointers;
            if (body) for (var j = 0; j < body.length; j++) {
                mut = mutations[body[j].oop];
                if (mut) body[j] = mut;
            }
            obj = obj.nextObject;
        }
        this.vm.flushMethodCacheAfterBecome(mutations);
        return true;
    },
    objectAfter: function(obj) {
        // if this was the last old object, tenure new objects and try again
        return obj.nextObject || (this.newSpaceCount > 0 && this.fullGC("nextObject"));
    },
    someInstanceOf: function(clsObj) {
        var obj = this.firstOldObject;
        while (true) {
            if (obj.sqClass === clsObj)
                return obj;
            obj = obj.nextObject || this.nextObjectWithGCFor(clsObj);
            if (!obj) return null;
        }
    },
    nextInstanceAfter: function(obj) {
        var clsObj = obj.sqClass;
        while (true) {
            obj = obj.nextObject || this.nextObjectWithGCFor(clsObj);
            if (!obj) return null;
            if (obj.sqClass === clsObj)
                return obj;
        }
    },
    nextObjectWithGCFor: function(clsObj) {
        if (this.newSpaceCount === 0 || !this.hasNewInstances[clsObj.oop]) return null;
        return this.fullGC("instance of " + clsObj.className());
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
        return this.hasClosures ? 6504 : 6502;
    },
});

Object.subclass('Squeak.Object',
'initialization', {
    initInstanceOf: function(aClass, indexableSize, hash, nilObj) {
        this.sqClass = aClass;
        this.hash = hash;
        var instSpec = aClass.pointers[Squeak.Class_format],
            instSize = ((instSpec>>1) & 0x3F) + ((instSpec>>10) & 0xC0) - 1; //0-255
        this.format = (instSpec>>7) & 0xF; //This is the 0-15 code

        if (this.format < 8) {
            if (this.format != 6) {
                if (instSize + indexableSize > 0)
                    this.pointers = this.fillArray(instSize + indexableSize, nilObj);
            } else // Words
                if (indexableSize > 0)
                    if (aClass.isFloatClass) {
                        this.isFloat = true;
                        this.float = 0.0;
                    } else
                        this.words = new Uint32Array(indexableSize); 
        } else // Bytes
            if (indexableSize > 0) {
                // this.format |= -indexableSize & 3;       //deferred to writeTo()
                this.bytes = new Uint8Array(indexableSize); //Methods require further init of pointers
            }

//      Definition of Squeak's format code...
//
//      Pointers only...
//        0      no fields
//        1      fixed fields only (all containing pointers)
//        2      indexable fields only (all containing pointers)
//        3      both fixed and indexable fields (all containing pointers)
//        4      both fixed and indexable weak fields (all containing pointers).
//        5      unused
//      Bits only...
//        6      indexable word fields only (no pointers)
//        7      unused
//        8-11   indexable byte fields only (no pointers) (low 2 bits are low 2 bits of size)
//      Pointer and bits (CompiledMethods only)...
//       12-15   compiled methods:
//               # of literal oops specified in method header,
//               followed by indexable bytes (same interpretation of low 2 bits as above)
    },
    initAsClone: function(original, hash) {
        this.sqClass = original.sqClass;
        this.hash = hash;
        this.format = original.format;
        if (original.isFloat) {
            this.isFloat = original.isFloat;
            this.float = original.float;
        } else {
            if (original.pointers) this.pointers = original.pointers.slice(0);   // copy
            if (original.words) this.words = new Uint32Array(original.words);    // copy
            if (original.bytes) this.bytes = new Uint8Array(original.bytes);     // copy
        }
    },
    initFromImage: function(oop, cls, fmt, hsh, data) {
        // initial creation from Image, with unmapped data
        this.oop = oop;
        this.sqClass = cls;
        this.format = fmt;
        this.hash = hsh;
        this.bits = data;
    },
    installFromImage: function(oopMap, ccArray, floatClass, littleEndian, nativeFloats) {
        //Install this object by decoding format, and rectifying pointers
        var ccInt = this.sqClass;
        // map compact classes
        if ((ccInt>0) && (ccInt<32))
            this.sqClass = oopMap[ccArray[ccInt-1]];
        else
            this.sqClass = oopMap[ccInt];
        var nWords = this.bits.length;
        if (this.format < 5) {
            //Formats 0...4 -- Pointer fields
            if (nWords > 0) {
                var oops = this.bits; // endian conversion was already done
                this.pointers = this.decodePointers(nWords, oops, oopMap);
            }
        } else if (this.format >= 12) {
            //Formats 12-15 -- CompiledMethods both pointers and bits
            var methodHeader = this.decodeWords(1, this.bits, littleEndian)[0],
                numLits = (methodHeader>>10) & 255,
                oops = this.decodeWords(numLits+1, this.bits, littleEndian);
            this.pointers = this.decodePointers(numLits+1, oops, oopMap); //header+lits
            this.bytes = this.decodeBytes(nWords-(numLits+1), this.bits, numLits+1, this.format & 3);
        } else if (this.format >= 8) {
            //Formats 8..11 -- ByteArrays (and ByteStrings)
            if (nWords > 0)
                this.bytes = this.decodeBytes(nWords, this.bits, 0, this.format & 3);
        } else if (this.sqClass == floatClass) {
            //These words are actually a Float
            this.isFloat = true;
            this.float = this.decodeFloat(this.bits, littleEndian, nativeFloats);
            if (this.float == 1.3797216632888e-310) {
                if (/noFloatDecodeWorkaround/.test(window.location.hash)) {
                    // floatDecode workaround disabled
                } else {
                    this.constructor.prototype.decodeFloat = this.decodeFloatDeoptimized;
                    this.float = this.decodeFloat(this.bits, littleEndian, nativeFloats);
                    if (this.float == 1.3797216632888e-310)
                        throw Error("Cannot deoptimize decodeFloat");
                } 
            }
        } else {
            if (nWords > 0)
                this.words = this.decodeWords(nWords, this.bits, littleEndian);
        }
        delete this.bits;
        this.mark = false; // for GC
    },
    decodePointers: function(nWords, theBits, oopMap) {
        //Convert small ints and look up object pointers in oopMap
        var ptrs = [];
        for (var i = 0; i < nWords; i++) {
            var oldOop = theBits[i];
            if ((oldOop&1) == 1)
                ptrs[i] = oldOop >> 1;      // SmallInteger
            else
                ptrs[i] = oopMap[oldOop];   // Object
        }
        return ptrs;        
    },
    decodeWords: function(nWords, theBits, littleEndian) {
        var data = new DataView(theBits.buffer, theBits.byteOffset),
            words = new Uint32Array(nWords);
        for (var i = 0; i < nWords; i++)
            words[i] = data.getUint32(i*4, littleEndian);
        return words;
    },
    decodeBytes: function (nWords, theBits, wordOffset, fmtLowBits) {
        // Adjust size for low bits and make a copy
        var nBytes = (nWords * 4) - fmtLowBits,
            wordsAsBytes = new Uint8Array(theBits.buffer, theBits.byteOffset + wordOffset * 4, nBytes),
            bytes = new Uint8Array(nBytes);
        bytes.set(wordsAsBytes);
        return bytes;
    },
    decodeFloat: function(theBits, littleEndian, nativeFloats) {
        var data = new DataView(theBits.buffer, theBits.byteOffset);
        // it's either big endian ...
        if (!littleEndian) return data.getFloat64(0, false);
        // or real little endian
        if (nativeFloats) return data.getFloat64(0, true);
        // or little endian, but with swapped words
        var buffer = new ArrayBuffer(8),
            swapped = new DataView(buffer);
        swapped.setUint32(0, data.getUint32(4));
        swapped.setUint32(4, data.getUint32(0));
        return swapped.getFloat64(0, true);
    },
    decodeFloatDeoptimized: function(theBits, littleEndian, nativeFloats) {
        var data = new DataView(theBits.buffer, theBits.byteOffset);
        // it's either big endian ...
        if (!littleEndian) return data.getFloat64(0, false);
        // or real little endian
        if (nativeFloats) return data.getFloat64(0, true);
        // or little endian, but with swapped words
        var buffer = new ArrayBuffer(8),
            swapped = new DataView(buffer);
        // wrap in function to defeat Safari's optimizer, which always
        // answers 1.3797216632888e-310 if called more than 25000 times
        (function() {
            swapped.setUint32(0, data.getUint32(4));
            swapped.setUint32(4, data.getUint32(0));
        })();
        return swapped.getFloat64(0, true);
    },
    fillArray: function(length, filler) {
        for (var array = [], i = 0; i < length; i++)
            array[i] = filler;
        return array;
    },
},
'printing', {
    toString: function() {
        return this.sqInstName();
    },
    bytesAsString: function() {
        if (!this.bytes) return '';
    	return Squeak.bytesAsString(this.bytes);
    },
    bytesAsNumberString: function(negative) {
        if (!this.bytes) return '';
        var hex = '0123456789ABCDEF',
            digits = [],
            value = 0;
        for (var i = this.bytes.length - 1; i >= 0; i--) {
            digits.push(hex[this.bytes[i] >> 4]);
            digits.push(hex[this.bytes[i] & 15]);
            value = value * 256 + this.bytes[i];
        }
        var sign = negative ? '-' : '',
            approx = value >= 9007199254740992 ? '≈' : '';
        return sign + '16r' + digits.join('') + ' (' + approx + sign + value + 'L)';
    },
    assnKeyAsString: function() {
        return this.pointers[Squeak.Assn_key].bytesAsString();  
    },
    slotNameAt: function(index) {
        // one-based index
        var instSize = this.instSize();
        if (index <= instSize)
            return this.sqClass.allInstVarNames()[index - 1];
        else
            return (index - instSize).toString();
    },
    sqInstName: function() {
        if (this.isNil) return "nil";
        if (this.isTrue) return "true";
        if (this.isFalse) return "false";
        if (this.isFloat) {var str = this.float.toString(); if (!/\./.test(str)) str += '.0'; return str; }
        var className = this.sqClass.className();
        if (/ /.test(className))
            return 'the ' + className;
        switch (className) {
            case 'String':
            case 'ByteString': return "'" + this.bytesAsString() + "'";
            case 'Symbol':
            case 'ByteSymbol':  return "#" + this.bytesAsString();         
            case 'Point': return this.pointers.join("@");
            case 'Rectangle': return this.pointers.join(" corner: ");
            case 'Association':
            case 'ReadOnlyVariableBinding': return this.pointers.join("->");
            case 'LargePositiveInteger': return this.bytesAsNumberString(false);
            case 'LargeNegativeInteger': return this.bytesAsNumberString(true);
            case 'Character': return "$" + String.fromCharCode(this.pointers[0]) + " (" + this.pointers[0].toString() + ")";
        }
        return  /^[aeiou]/i.test(className) ? 'an ' + className : 'a ' + className;
    },
},
'accessing', {
    isWords: function() {
        return this.format === 6;
    },
    isBytes: function() {
        var fmt = this.format;
        return fmt >= 8 && fmt <= 11;
    },
    isWordsOrBytes: function() {
        var fmt = this.format;
        return fmt == 6  || (fmt >= 8 && fmt <= 11);
    },
    isPointers: function() {
        return this.format <= 4;
    },
    pointersSize: function() {
    	return this.pointers ? this.pointers.length : 0;
    },
    bytesSize: function() {
        return this.bytes ? this.bytes.length : 0;
    },
    wordsSize: function() {
        return this.isFloat ? 2 : this.words ? this.words.length : 0;
    },
    instSize: function() {//same as class.classInstSize, but faster from format
        if (this.format>4 || this.format==2) return 0; //indexable fields only
        if (this.format<2) return this.pointers.length; //indexable fields only
        return this.sqClass.classInstSize(); //0-255
    },
    floatData: function() {
        var buffer = new ArrayBuffer(8);
        var data = new DataView(buffer);
        data.setFloat64(0, this.float, false);
        //1st word is data.getUint32(0, false);
        //2nd word is data.getUint32(4, false);
        return data;
    },
    wordsAsFloat32Array: function() {
        return this.float32Array
            || (this.words && (this.float32Array = new Float32Array(this.words.buffer)));
    },
    wordsAsFloat64Array: function() {
        return this.float64Array
            || (this.words && (this.float64Array = new Float64Array(this.words.buffer)));
    },
    wordsAsInt32Array: function() {
        return this.int32Array
            || (this.words && (this.int32Array = new Int32Array(this.words.buffer)));
    },
    wordsAsInt16Array: function() {
        return this.int16Array
            || (this.words && (this.int16Array = new Int16Array(this.words.buffer)));
    },
    wordsAsUint8Array: function() {
        return this.uint8Array
            || (this.words && (this.uint8Array = new Uint8Array(this.words.buffer)));
    },
    wordsOrBytes: function() {
        if (this.words) return this.words;
        if (this.uint32Array) return this.uint32Array;
        if (!this.bytes) return null;
        return this.uint32Array = new Uint32Array(this.bytes.buffer, 0, this.bytes.length >> 2);
    },
    setAddr: function(addr) {
        // Move this object to addr by setting its oop. Answer address after this object.
        // Used to assign an oop for the first time when tenuring this object during GC.
        // When compacting, the oop is adjusted directly, since header size does not change.
        var words = this.snapshotSize();
        this.oop = addr + words.header * 4;
        return addr + (words.header + words.body) * 4; 
    },
    snapshotSize: function() {
        // words of extra object header and body this object would take up in image snapshot
        // body size includes one header word that is always present
        var nWords =
            this.isFloat ? 2 :
            this.words ? this.words.length :
            this.pointers ? this.pointers.length : 0;
        // methods have both pointers and bytes
        if (this.bytes) nWords += (this.bytes.length + 3) >> 2;
        nWords++; // one header word always present
        var extraHeader = nWords > 63 ? 2 : this.sqClass.isCompact ? 0 : 1;
        return {header: extraHeader, body: nWords};
    },
    addr: function() { // start addr of this object in a snapshot
        return this.oop - this.snapshotSize().header * 4;
    },
    totalBytes: function() {
        // size in bytes this object would take up in image snapshot
        var words = this.snapshotSize();
        return (words.header + words.body) * 4;
    },
    writeTo: function(data, pos, image) {
        // Write 1 to 3 header words encoding type, class, and size, then instance data
        if (this.bytes) this.format |= -this.bytes.length & 3;
        var beforePos = pos,
            size = this.snapshotSize(),
            formatAndHash = ((this.format & 15) << 8) | ((this.hash & 4095) << 17);
        // write header words first
        switch (size.header) {
            case 2:
                data.setUint32(pos, size.body << 2 | Squeak.HeaderTypeSizeAndClass); pos += 4;
                data.setUint32(pos, this.sqClass.oop | Squeak.HeaderTypeSizeAndClass); pos += 4;
                data.setUint32(pos, formatAndHash | Squeak.HeaderTypeSizeAndClass); pos += 4;
                break;
            case 1:
                data.setUint32(pos, this.sqClass.oop | Squeak.HeaderTypeClass); pos += 4;
                data.setUint32(pos, formatAndHash | size.body << 2 | Squeak.HeaderTypeClass); pos += 4;
                break;
            case 0:
                var classIndex = image.compactClasses.indexOf(this.sqClass) + 1;
                data.setUint32(pos, formatAndHash | classIndex << 12 | size.body << 2 | Squeak.HeaderTypeShort); pos += 4;
        }
        // now write body, if any
        if (this.isFloat) {
            data.setFloat64(pos, this.float); pos += 8;
        } else if (this.words) {
            for (var i = 0; i < this.words.length; i++) {
                data.setUint32(pos, this.words[i]); pos += 4;
            }
        } else if (this.pointers) {
            for (var i = 0; i < this.pointers.length; i++) { 
                data.setUint32(pos, image.objectToOop(this.pointers[i])); pos += 4;
            }
        }
        // no "else" because CompiledMethods have both pointers and bytes
        if (this.bytes) {
            for (var i = 0; i < this.bytes.length; i++)
                data.setUint8(pos++, this.bytes[i]);
            // skip to next word
            pos += -this.bytes.length & 3;
        }
        // done
        if (pos !== beforePos + this.totalBytes()) throw Error("written size does not match");
        return pos;
    },
},
'as class', {
    classInstSize: function() {
        // this is a class, answer number of named inst vars
        var format = this.pointers[Squeak.Class_format];
        return ((format >> 10) & 0xC0) + ((format >> 1) & 0x3F) - 1;
    },
    instVarNames: function() {
        var index = this.pointers.length > 9 ? 3 : 4; // index changed in newer images
        return (this.pointers[index].pointers || []).map(function(each) {
            return each.bytesAsString();
        });
    },
    allInstVarNames: function() {
        var superclass = this.superclass();
        if (superclass.isNil)
            return this.instVarNames();
        else
            return superclass.allInstVarNames().concat(this.instVarNames());
    },
    superclass: function() {
        return this.pointers[0];
    },
    className: function() {
        if (!this.pointers) return "?!?";
        var size = this.pointers.length;
        var isMeta = size < 9;  // true for all Squeak versions, hopefully
        var cls = isMeta ? this.pointers[size == 7 ? 6 : 5] : this;
        var nameObj = cls.pointers && cls.pointers[Squeak.Class_name];
        var name = nameObj && nameObj.bytes ? nameObj.bytesAsString() : "???";
        return isMeta ? name + " class" : name;
    }
},
'as method', {
    methodHeader: function() {
        return this.pointers[0];
    },
    methodNumLits: function() {
        return this.pointers.length - 1;
    },
    methodNumArgs: function() {
        return (this.methodHeader()>>24) & 0xF;
    },
    methodPrimitiveIndex: function() {
        var primBits = (this.methodHeader()) & 0x300001FF;
        if (primBits > 0x1FF)
            return (primBits & 0x1FF) + (primBits >> 19);
        else
            return primBits;
    },
    methodClassForSuper: function() {//assn found in last literal
        var assn = this.pointers[this.methodNumLits()];
        return assn.pointers[Squeak.Assn_value];
    },
    methodNeedsLargeFrame: function() {
        return (this.methodHeader() & 0x20000) > 0; 
    },
    methodAddPointers: function(headerAndLits) {
        this.pointers = headerAndLits; 
    },
    methodTempCount: function() {
        return (this.methodHeader()>>18) & 63; 
    },
    methodGetLiteral: function(zeroBasedIndex) {
        return this.pointers[1+zeroBasedIndex]; // step over header
    },
    methodGetSelector: function(zeroBasedIndex) {
        return this.pointers[1+zeroBasedIndex]; // step over header 
    },
    methodSetLiteral: function(zeroBasedIndex, value) {
        this.pointers[1+zeroBasedIndex] = value; // step over header
    },
},
'as context',
{
    contextHome: function() {
        return this.contextIsBlock() ? this.pointers[Squeak.BlockContext_home] : this;
    },
    contextIsBlock: function() {
        return typeof this.pointers[Squeak.BlockContext_argumentCount] === 'number';
    },
    contextMethod: function() {
        return this.contextHome().pointers[Squeak.Context_method];
    },
    contextSender: function() {
        return this.pointers[Squeak.Context_sender];
    },
    contextSizeWithStack: function(vm) {
        // Actual context size is inst vars + stack size. Slots beyond that may contain garbage.
        // If passing in a VM, and this is the activeContext, use the VM's current value.
        if (vm && vm.activeContext === this)
            return vm.sp + 1;
        // following is same as decodeSqueakSP() but works without vm ref
        var sp = this.pointers[Squeak.Context_stackPointer];
        return Squeak.Context_tempFrameStart + (typeof sp === "number" ? sp : 0);
    },
});

Object.subclass('Squeak.Interpreter',
'initialization', {
    initialize: function(image, display) {
        console.log('squeak: initializing interpreter');
        this.Squeak = Squeak;   // store locally to avoid dynamic lookup in Lively
        this.image = image;
        this.image.vm = this;
        this.primHandler = new Squeak.Primitives(this, display);
        this.loadImageState();
        this.hackImage();
        this.initVMState();
        this.loadInitialContext();
        this.initCompiler();
        console.log('squeak: ready');
    },
    loadImageState: function() {
        this.specialObjects = this.image.specialObjectsArray.pointers;
        this.specialSelectors = this.specialObjects[Squeak.splOb_SpecialSelectors].pointers;
        this.nilObj = this.specialObjects[Squeak.splOb_NilObject];
        this.falseObj = this.specialObjects[Squeak.splOb_FalseObject];
        this.trueObj = this.specialObjects[Squeak.splOb_TrueObject];
        this.hasClosures = this.image.hasClosures; 
        // hack for old image that does not support Unix files
        if (!this.findMethod("UnixFileDirectory class>>pathNameDelimiter"))
            this.primHandler.emulateMac = true;
    },
    initVMState: function() {
        this.byteCodeCount = 0;
        this.sendCount = 0;
        this.interruptCheckCounter = 0;
        this.interruptCheckCounterFeedBackReset = 1000;
        this.interruptChecksEveryNms = 3;
        this.nextPollTick = 0;
        this.nextWakeupTick = 0;
        this.lastTick = 0;
        this.interruptKeycode = 2094;  //"cmd-."
        this.interruptPending = false;
        //this.pendingFinalizationSignals = 0;
        this.freeContexts = this.nilObj;
        this.freeLargeContexts = this.nilObj;
        this.reclaimableContextCount = 0;
        this.nRecycledContexts = 0;
        this.nAllocatedContexts = 0;
        this.methodCacheSize = 1024;
        this.methodCacheMask = this.methodCacheSize - 1;
        this.methodCacheRandomish = 0;
        this.methodCache = [];
        for (var i = 0; i < this.methodCacheSize; i++)
            this.methodCache[i] = {lkupClass: null, selector: null, method: null, primIndex: 0, argCount: 0, mClass: null};
        this.breakOutOfInterpreter = false;
        this.breakOutTick = 0;
        this.breakOnMethod = null; // method to break on
        this.breakOnNewMethod = false;
        this.breakOnContextChanged = false;
        this.breakOnContextReturned = null; // context to break on
        this.messages = {};
        this.startupTime = Date.now(); // base for millisecond clock
    },
    loadInitialContext: function() {
        var schedAssn = this.specialObjects[Squeak.splOb_SchedulerAssociation];
        var sched = schedAssn.pointers[Squeak.Assn_value];
        var proc = sched.pointers[Squeak.ProcSched_activeProcess];
        this.activeContext = proc.pointers[Squeak.Proc_suspendedContext];
        this.fetchContextRegisters(this.activeContext);
        this.reclaimableContextCount = 0;
    },
    initCompiler: function() {
        if (!Squeak.Compiler)
            return console.warn("Squeak.Compiler not loaded, using interpreter only");
        try {
            // compiler might decide to not handle current image
            console.log("squeak: initializing JIT compiler");
            this.compiler = new Squeak.Compiler(this);
        } catch(e) {
            console.warn("Compiler " + e);
        }
    },
    hackImage: function() {
        // hack methods to make work for now
        var returnSelf  = 256,
            returnTrue  = 257,
            returnFalse = 258,
            returnNil   = 259;
        [
            // Etoys fallback for missing translation files is hugely inefficient.
            // This speeds up opening a viewer by 10x (!)
            // Remove when we added translation files.
            {method: "String>>translated", primitive: returnSelf},
            {method: "String>>translatedInAllDomains", primitive: returnSelf},
            // Squeak 4.5: disable syntax highlighting for speed
            {method: "PluggableTextMorphPlus>>useDefaultStyler", primitive: returnSelf},
            // BitBlt rule not available
            //{method: "BitBlt class>>subPixelRenderColorFonts", primitive: returnFalse},
            // Cuis needs JPEG plugin
            {method: "PasteUpMorph>>buildMagnifiedBackgroundImage", primitive: returnNil},
        ].forEach(function(each) {
            var m = this.findMethod(each.method);
            if (m) {
                m.pointers[0] |= each.primitive;
                console.warn("Hacking " + each.method);
            }
        }, this);
    },
},
'interpreting', {
    interpretOne: function(singleStep) {
        if (this.method.compiled) {
            if (singleStep) {
                if (!this.compiler.enableSingleStepping(this.method)) {
                    this.method.compiled = null;
                    return this.interpretOne(singleStep);
                }
                this.breakNow();
            }
            this.byteCodeCount += this.method.compiled(this);
            return;
        }
        var Squeak = this.Squeak; // avoid dynamic lookup of "Squeak" in Lively
        var b, b2;
        this.byteCodeCount++;
        b = this.nextByte();
        if (b < 128) // Chrome only optimized up to 128 cases
        switch (b) { /* The Main Bytecode Dispatch Loop */

            // load receiver variable
            case 0x00: case 0x01: case 0x02: case 0x03: case 0x04: case 0x05: case 0x06: case 0x07: 
            case 0x08: case 0x09: case 0x0A: case 0x0B: case 0x0C: case 0x0D: case 0x0E: case 0x0F: 
                this.push(this.receiver.pointers[b&0xF]); return;

            // load temporary variable
            case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x17: 
            case 0x18: case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: case 0x1F: 
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&0xF)]); return;

            // loadLiteral
            case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: case 0x25: case 0x26: case 0x27: 
            case 0x28: case 0x29: case 0x2A: case 0x2B: case 0x2C: case 0x2D: case 0x2E: case 0x2F: 
            case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: case 0x35: case 0x36: case 0x37: 
            case 0x38: case 0x39: case 0x3A: case 0x3B: case 0x3C: case 0x3D: case 0x3E: case 0x3F: 
                this.push(this.method.methodGetLiteral(b&0x1F)); return;

            // loadLiteralIndirect
            case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46: case 0x47: 
            case 0x48: case 0x49: case 0x4A: case 0x4B: case 0x4C: case 0x4D: case 0x4E: case 0x4F: 
            case 0x50: case 0x51: case 0x52: case 0x53: case 0x54: case 0x55: case 0x56: case 0x57: 
            case 0x58: case 0x59: case 0x5A: case 0x5B: case 0x5C: case 0x5D: case 0x5E: case 0x5F: 
                this.push((this.method.methodGetLiteral(b&0x1F)).pointers[Squeak.Assn_value]); return;

            // storeAndPop rcvr, temp
            case 0x60: case 0x61: case 0x62: case 0x63: case 0x64: case 0x65: case 0x66: case 0x67: 
                this.receiver.pointers[b&7] = this.pop(); return;
            case 0x68: case 0x69: case 0x6A: case 0x6B: case 0x6C: case 0x6D: case 0x6E: case 0x6F: 
                this.homeContext.pointers[Squeak.Context_tempFrameStart+(b&7)] = this.pop(); return;

            // Quick push
            case 0x70: this.push(this.receiver); return;
            case 0x71: this.push(this.trueObj); return;
            case 0x72: this.push(this.falseObj); return;
            case 0x73: this.push(this.nilObj); return;
            case 0x74: this.push(-1); return;
            case 0x75: this.push(0); return;
            case 0x76: this.push(1); return;
            case 0x77: this.push(2); return;

            // Quick return
            case 0x78: this.doReturn(this.receiver); return;
            case 0x79: this.doReturn(this.trueObj); return;
            case 0x7A: this.doReturn(this.falseObj); return;
            case 0x7B: this.doReturn(this.nilObj); return;
            case 0x7C: this.doReturn(this.pop()); return;
            case 0x7D: this.doReturn(this.pop(), this.activeContext.pointers[Squeak.BlockContext_caller]); return; // blockReturn
            case 0x7E: this.nono(); return;
            case 0x7F: this.nono(); return;
        } else switch (b) { // Chrome only optimized up to 128 cases
            // Sundry
            case 0x80: this.extendedPush(this.nextByte()); return;
            case 0x81: this.extendedStore(this.nextByte()); return;
            case 0x82: this.extendedStorePop(this.nextByte()); return;
            // singleExtendedSend
            case 0x83: b2 = this.nextByte(); this.send(this.method.methodGetSelector(b2&31), b2>>5, false); return;
            case 0x84: this.doubleExtendedDoAnything(this.nextByte()); return;
            // singleExtendedSendToSuper
            case 0x85: b2= this.nextByte(); this.send(this.method.methodGetSelector(b2&31), b2>>5, true); return;
            // secondExtendedSend
            case 0x86: b2= this.nextByte(); this.send(this.method.methodGetSelector(b2&63), b2>>6, false); return;
            case 0x87: this.pop(); return;	// pop
            case 0x88: this.push(this.top()); return;	// dup
            // thisContext
            case 0x89: this.push(this.activeContext); this.reclaimableContextCount = 0; return;

            // Closures
            case 0x8A: this.pushNewArray(this.nextByte());   // create new temp vector
                return;
            case 0x8B: this.nono(); return;
            case 0x8C: b2 = this.nextByte(); // remote push from temp vector
                this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2]);
                return;
            case 0x8D: b2 = this.nextByte(); // remote store into temp vector
                this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2] = this.top();
                return;
            case 0x8E: b2 = this.nextByte(); // remote store and pop into temp vector
                this.homeContext.pointers[Squeak.Context_tempFrameStart+this.nextByte()].pointers[b2] = this.pop();
                return;
            case 0x8F: this.pushClosureCopy(); return;

            // Short jmp
            case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97: 
                this.pc += (b&7)+1; return;
            // Short conditional jump on false
            case 0x98: case 0x99: case 0x9A: case 0x9B: case 0x9C: case 0x9D: case 0x9E: case 0x9F: 
                this.jumpIfFalse((b&7)+1); return;
            // Long jump, forward and back
            case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5: case 0xA6: case 0xA7: 
                b2 = this.nextByte();
                this.pc += (((b&7)-4)*256 + b2);
                if ((b&7)<4)        // check for process switch on backward jumps (loops)
                    if (this.interruptCheckCounter-- <= 0) this.checkForInterrupts();
                return;
            // Long conditional jump on true
            case 0xA8: case 0xA9: case 0xAA: case 0xAB:
                this.jumpIfTrue((b&3)*256 + this.nextByte()); return;
            // Long conditional jump on false
            case 0xAC: case 0xAD: case 0xAE: case 0xAF: 
                this.jumpIfFalse((b&3)*256 + this.nextByte()); return;

            // Arithmetic Ops... + - < > <= >= = ~=    * /  @ lshift: lxor: land: lor:
            case 0xB0: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) + this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;	// PLUS +
            case 0xB1: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) - this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;	// MINUS -
            case 0xB2: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) < this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // LESS <
            case 0xB3: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) > this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // GRTR >
            case 0xB4: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) <= this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // LEQ <=
            case 0xB5: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) >= this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // GEQ >=
            case 0xB6: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) === this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // EQU =
            case 0xB7: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackIntOrFloat(1) !== this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // NEQ ~=
            case 0xB8: this.success = true; this.resultIsFloat = false;
                if(!this.pop2AndPushNumResult(this.stackIntOrFloat(1) * this.stackIntOrFloat(0))) this.sendSpecial(b&0xF); return;  // TIMES *
            case 0xB9: this.success = true;
                if(!this.pop2AndPushIntResult(this.quickDivide(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // Divide /
            case 0xBA: this.success = true;
                if(!this.pop2AndPushIntResult(this.mod(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // MOD \
            case 0xBB: this.success = true;
                if(!this.primHandler.primitiveMakePoint(1, true)) this.sendSpecial(b&0xF); return;  // MakePt int@int
            case 0xBC: this.success = true;
                if(!this.pop2AndPushIntResult(this.safeShift(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return; // bitShift:
            case 0xBD: this.success = true;
                if(!this.pop2AndPushIntResult(this.div(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); return;  // Divide //
            case 0xBE: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) & this.stackInteger(0))) this.sendSpecial(b&0xF); return; // bitAnd:
            case 0xBF: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) | this.stackInteger(0))) this.sendSpecial(b&0xF); return; // bitOr:

            // at:, at:put:, size, next, nextPut:, ...
            case 0xC0: case 0xC1: case 0xC2: case 0xC3: case 0xC4: case 0xC5: case 0xC6: case 0xC7: 
            case 0xC8: case 0xC9: case 0xCA: case 0xCB: case 0xCC: case 0xCD: case 0xCE: case 0xCF: 
                if (!this.primHandler.quickSendOther(this.receiver, b&0xF))
                    this.sendSpecial((b&0xF)+16); return;

            // Send Literal Selector with 0, 1, and 2 args
            case 0xD0: case 0xD1: case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: case 0xD7: 
            case 0xD8: case 0xD9: case 0xDA: case 0xDB: case 0xDC: case 0xDD: case 0xDE: case 0xDF: 
                this.send(this.method.methodGetSelector(b&0xF), 0, false); return;
            case 0xE0: case 0xE1: case 0xE2: case 0xE3: case 0xE4: case 0xE5: case 0xE6: case 0xE7: 
            case 0xE8: case 0xE9: case 0xEA: case 0xEB: case 0xEC: case 0xED: case 0xEE: case 0xEF: 
                this.send(this.method.methodGetSelector(b&0xF), 1, false); return;
            case 0xF0: case 0xF1: case 0xF2: case 0xF3: case 0xF4: case 0xF5: case 0xF6: case 0xF7: 
            case 0xF8: case 0xF9: case 0xFA: case 0xFB: case 0xFC: case 0xFD: case 0xFE: case 0xFF:
                this.send(this.method.methodGetSelector(b&0xF), 2, false); return;
        }
        throw Error("not a bytecode: " + b);
    },
    interpret: function(forMilliseconds, thenDo) {
        // run for a couple milliseconds (but only until idle or break)
        // answer milliseconds to sleep (until next timer wakeup)
        // or 'break' if reached breakpoint
        // call thenDo with that result when done
        if (this.frozen) return 'frozen';
        this.isIdle = false;
        this.breakOutOfInterpreter = false;
        this.breakOutTick = this.primHandler.millisecondClockValue() + (forMilliseconds || 500);
        while (this.breakOutOfInterpreter === false)
            if (this.method.compiled) {
                this.byteCodeCount += this.method.compiled(this);
            } else {
                this.interpretOne();
            }
        // this is to allow 'freezing' the interpreter and restarting it asynchronously. See freeze()
        if (typeof this.breakOutOfInterpreter == "function")
            return this.breakOutOfInterpreter(thenDo);
        // normally, we answer regularly
        var result = this.breakOutOfInterpreter == 'break' ? 'break'
            : !this.isIdle ? 0
            : !this.nextWakeupTick ? 'sleep'        // all processes waiting
            : Math.max(1, this.nextWakeupTick - this.primHandler.millisecondClockValue());
        if (thenDo) thenDo(result);
        return result;
    },
    goIdle: function() {
        // make sure we tend to pending delays
        var hadTimer = this.nextWakeupTick !== 0;
        this.forceInterruptCheck();
        this.checkForInterrupts();
        var hasTimer = this.nextWakeupTick !== 0;
        // go idle unless a timer just expired
        this.isIdle = hasTimer || !hadTimer;
        this.breakOut();
    },
    freeze: function(externalContinueFunc) {
        // Stop the interpreter. Answer a function that can be
        // called to continue interpreting.
        var continueFunc = externalContinueFunc; // only needed if called from outside the interpreter
        this.primHandler.displayFlush(); // make sure display is up to date
        this.frozen = true;
        this.breakOutOfInterpreter = function(thenDo) {
            if (!thenDo) throw Error("need function to restart interpreter");
            continueFunc = thenDo;
            return "frozen";
        }.bind(this);
        return function unfreeze() {
            this.frozen = false;
            if (!continueFunc) throw Error("no continue function");
            continueFunc(0);    //continue without timeout
        }.bind(this);
    },
    breakOut: function() {
        this.breakOutOfInterpreter = this.breakOutOfInterpreter || true; // do not overwrite break string
    },
    nextByte: function() {
        return this.methodBytes[this.pc++];
    },
    nono: function() {
        throw Error("Oh No!");
    },
    forceInterruptCheck: function() {
        this.interruptCheckCounter = -1000;
    },
    checkForInterrupts: function() {
        //Check for interrupts at sends and backward jumps
        var now = this.primHandler.millisecondClockValue();
        if (now < this.lastTick) { // millisecond clock wrapped
            this.nextPollTick = now + (this.nextPollTick - this.lastTick);
            this.breakOutTick = now + (this.breakOutTick - this.lastTick);
            if (this.nextWakeupTick !== 0)
                this.nextWakeupTick = now + (this.nextWakeupTick - this.lastTick);
        }
        //Feedback logic attempts to keep interrupt response around 3ms...
        if (this.interruptCheckCounter > -100) { // only if not a forced check
            if ((now - this.lastTick) < this.interruptChecksEveryNms) { //wrapping is not a concern
                this.interruptCheckCounterFeedBackReset += 10;
            } else { // do a thousand sends even if we are too slow for 3ms
                if (this.interruptCheckCounterFeedBackReset <= 1000)
                    this.interruptCheckCounterFeedBackReset = 1000;
                else
                    this.interruptCheckCounterFeedBackReset -= 12;
            }
        }
    	this.interruptCheckCounter = this.interruptCheckCounterFeedBackReset; //reset the interrupt check counter
    	this.lastTick = now; //used to detect wraparound of millisecond clock
        //	if(signalLowSpace) {
        //            signalLowSpace= false; //reset flag
        //            sema= getSpecialObject(Squeak.splOb_TheLowSpaceSemaphore);
        //            if(sema != nilObj) synchronousSignal(sema); }
        //	if(now >= nextPollTick) {
        //            ioProcessEvents(); //sets interruptPending if interrupt key pressed
        //            nextPollTick= now + 500; } //msecs to wait before next call to ioProcessEvents"
        if (this.interruptPending) {
            this.interruptPending = false; //reset interrupt flag
            var sema = this.specialObjects[Squeak.splOb_TheInterruptSemaphore];
            if (!sema.isNil) this.primHandler.synchronousSignal(sema);
        }
        if ((this.nextWakeupTick !== 0) && (now >= this.nextWakeupTick)) {
            this.nextWakeupTick = 0; //reset timer interrupt
            var sema = this.specialObjects[Squeak.splOb_TheTimerSemaphore];
            if (!sema.isNil) this.primHandler.synchronousSignal(sema);
        }
        //	if (pendingFinalizationSignals > 0) { //signal any pending finalizations
        //            sema= getSpecialObject(Squeak.splOb_ThefinalizationSemaphore);
        //            pendingFinalizationSignals= 0;
        //            if(sema != nilObj) primHandler.synchronousSignal(sema); }
        if (this.primHandler.semaphoresToSignal.length > 0)
            this.primHandler.signalExternalSemaphores();  // signal pending semaphores, if any
        // if this is a long-running do-it, compile it
        if (!this.method.compiled && this.compiler)
            this.compiler.compile(this.method);
        // have to return to web browser once in a while
        if (now >= this.breakOutTick)
            this.breakOut();
    },
    extendedPush: function(nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.push(this.receiver.pointers[lobits]);break;
            case 1: this.push(this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits]); break;
            case 2: this.push(this.method.methodGetLiteral(lobits)); break;
            case 3: this.push(this.method.methodGetLiteral(lobits).pointers[Squeak.Assn_value]); break;
        }
    },
    extendedStore: function( nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.receiver.pointers[lobits] = this.top(); break;
            case 1: this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits] = this.top(); break;
            case 2: this.nono(); break;
            case 3: this.method.methodGetLiteral(lobits).pointers[Squeak.Assn_value] = this.top(); break;
        }
    },
    extendedStorePop: function(nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.receiver.pointers[lobits] = this.pop(); break;
            case 1: this.homeContext.pointers[Squeak.Context_tempFrameStart+lobits] = this.pop(); break;
            case 2: this.nono(); break;
            case 3: this.method.methodGetLiteral(lobits).pointers[Squeak.Assn_value] = this.pop(); break;
        }
    },
    doubleExtendedDoAnything: function(byte2) {
        var byte3 = this.nextByte();
        switch (byte2>>5) {
            case 0: this.send(this.method.methodGetSelector(byte3), byte2&31, false); break;
            case 1: this.send(this.method.methodGetSelector(byte3), byte2&31, true); break;
            case 2: this.push(this.receiver.pointers[byte3]); break;
            case 3: this.push(this.method.methodGetLiteral(byte3)); break;
            case 4: this.push(this.method.methodGetLiteral(byte3).pointers[Squeak.Assn_value]); break;
            case 5: this.receiver.pointers[byte3] = this.top(); break;
            case 6: this.receiver.pointers[byte3] = this.pop(); break;
            case 7: this.method.methodGetLiteral(byte3).pointers[Squeak.Assn_value] = this.top(); break;
        }
    },
    jumpIfTrue: function(delta) {
        var top = this.pop();
        if (top.isTrue) {this.pc += delta; return;}
        if (top.isFalse) return;
        this.push(top); //Uh-oh it's not even a boolean (that we know of ;-).  Restore stack...
        this.send(this.specialObjects[Squeak.splOb_SelectorMustBeBoolean], 1, false);
    },
    jumpIfFalse: function(delta) {
        var top = this.pop();
        if (top.isFalse) {this.pc += delta; return;}
        if (top.isTrue) return;
        this.push(top); //Uh-oh it's not even a boolean (that we know of ;-).  Restore stack...
        this.send(this.specialObjects[Squeak.splOb_SelectorMustBeBoolean], 1, false);
    },
    sendSpecial: function(lobits) {
        this.send(this.specialSelectors[lobits*2],
            this.specialSelectors[(lobits*2)+1],
            false);  //specialSelectors is  {...sel,nArgs,sel,nArgs,...)
    },
},
'closures', {
    pushNewArray: function(nextByte) {
        var popValues = nextByte > 127,
            count = nextByte & 127,
            array = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassArray], count);
        if (popValues) {
            for (var i = 0; i < count; i++)
                array.pointers[i] = this.stackValue(count - i - 1);
            this.popN(count);
        }
        this.push(array);
    },
    pushClosureCopy: function() {
        // The compiler has pushed the values to be copied, if any.  Find numArgs and numCopied in the byte following.
        // Create a Closure with space for the copiedValues and pop numCopied values off the stack into the closure.
        // Set numArgs as specified, and set startpc to the pc following the block size and jump over that code.
        var numArgsNumCopied = this.nextByte(),
            numArgs = numArgsNumCopied & 0xF,
            numCopied = numArgsNumCopied >> 4,
            blockSizeHigh = this.nextByte(),
            blockSize = blockSizeHigh * 256 + this.nextByte(),
            initialPC = this.encodeSqueakPC(this.pc, this.method),
            closure = this.newClosure(numArgs, initialPC, numCopied);
        closure.pointers[Squeak.Closure_outerContext] = this.activeContext;
        this.reclaimableContextCount = 0; // The closure refers to thisContext so it can't be reclaimed
        if (numCopied > 0) {
            for (var i = 0; i < numCopied; i++)
                closure.pointers[Squeak.Closure_firstCopiedValue + i] = this.stackValue(numCopied - i - 1);
            this.popN(numCopied);
        }
        this.pc += blockSize;
        this.push(closure);
	},
	newClosure: function(numArgs, initialPC, numCopied) {
        var size = Squeak.Closure_firstCopiedValue + numCopied,
            closure = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassBlockClosure], size);
        closure.pointers[Squeak.Closure_startpc] = initialPC;
        closure.pointers[Squeak.Closure_numArgs] = numArgs;
        return closure;
	},
},
'sending', {
    send: function(selector, argCount, doSuper) {
        var newRcvr = this.stackValue(argCount);
        var lookupClass = this.getClass(newRcvr);
        if (doSuper) {
            lookupClass = this.method.methodClassForSuper();
            lookupClass = lookupClass.pointers[Squeak.Class_superclass];
        }
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        if (entry.primIndex) {
            //note details for verification of at/atput primitives
            this.verifyAtSelector = selector;
            this.verifyAtClass = lookupClass;
        }
        this.executeNewMethod(newRcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
    },
    findSelectorInClass: function(selector, argCount, startingClass) {
        var cacheEntry = this.findMethodCacheEntry(selector, startingClass);
        if (cacheEntry.method) return cacheEntry; // Found it in the method cache
        var currentClass = startingClass;
        var mDict;
        while (!currentClass.isNil) {
            mDict = currentClass.pointers[Squeak.Class_mdict];
            if (mDict.isNil) {
//                ["MethodDict pointer is nil (hopefully due a swapped out stub)
//                        -- raise exception #cannotInterpret:."
//                self createActualMessageTo: class.
//                messageSelector _ self splObj: SelectorCannotInterpret.
//                ^ self lookupMethodInClass: (self superclassOf: currentClass)]
                throw Error("cannotInterpret");
            }
            var newMethod = this.lookupSelectorInDict(mDict, selector);
            if (!newMethod.isNil) {
                //load cache entry here and return
                cacheEntry.method = newMethod;
                cacheEntry.primIndex = newMethod.methodPrimitiveIndex();
                cacheEntry.argCount = argCount;
                cacheEntry.mClass = currentClass;
                return cacheEntry;
            }  
            currentClass = currentClass.pointers[Squeak.Class_superclass];
        }
        //Cound not find a normal message -- send #doesNotUnderstand:
        var dnuSel = this.specialObjects[Squeak.splOb_SelectorDoesNotUnderstand];
        if (selector === dnuSel) // Cannot find #doesNotUnderstand: -- unrecoverable error.
            throw Error("Recursive not understood error encountered");
        var dnuMsg = this.createActualMessage(selector, argCount, startingClass); //The argument to doesNotUnderstand:
        this.popNandPush(argCount, dnuMsg);
        return this.findSelectorInClass(dnuSel, 1, startingClass);
    },
    lookupSelectorInDict: function(mDict, messageSelector) {
        //Returns a method or nilObject
        var dictSize = mDict.pointersSize();
        var mask = (dictSize - Squeak.MethodDict_selectorStart) - 1;
        var index = (mask & messageSelector.hash) + Squeak.MethodDict_selectorStart;
        // If there are no nils (should always be), then stop looping on second wrap.
        var hasWrapped = false;
        while (true) {
            var nextSelector = mDict.pointers[index];
            if (nextSelector === messageSelector) {
                var methArray = mDict.pointers[Squeak.MethodDict_array];
                return methArray.pointers[index - Squeak.MethodDict_selectorStart];
            }
            if (nextSelector.isNil) return this.nilObj;
            if (++index === dictSize) {
                if (hasWrapped) return this.nilObj;
                index = Squeak.MethodDict_selectorStart;
                hasWrapped = true;
            }
        }
    },
    executeNewMethod: function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
        this.sendCount++;
        if (newMethod === this.breakOnMethod) this.breakNow("executing method " + this.printMethod(newMethod, optClass, optSel));
        if (this.logSends) console.log(this.sendCount + ' ' + this.printMethod(newMethod, optClass, optSel));
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
        if (primitiveIndex > 0)
            if (this.tryPrimitive(primitiveIndex, argumentCount, newMethod))
                return;  //Primitive succeeded -- end of story
        var newContext = this.allocateOrRecycleContext(newMethod.methodNeedsLargeFrame());
        var tempCount = newMethod.methodTempCount();
        var newPC = 0; // direct zero-based index into byte codes
        var newSP = Squeak.Context_tempFrameStart + tempCount - 1; // direct zero-based index into context pointers
        newContext.pointers[Squeak.Context_method] = newMethod;
        //Following store is in case we alloc without init; all other fields get stored
        newContext.pointers[Squeak.BlockContext_initialIP] = this.nilObj;
        newContext.pointers[Squeak.Context_sender] = this.activeContext;
        //Copy receiver and args to new context
        //Note this statement relies on the receiver slot being contiguous with args...
        this.arrayCopy(this.activeContext.pointers, this.sp-argumentCount, newContext.pointers, Squeak.Context_tempFrameStart-1, argumentCount+1);
        //...and fill the remaining temps with nil
        this.arrayFill(newContext.pointers, Squeak.Context_tempFrameStart+argumentCount, Squeak.Context_tempFrameStart+tempCount, this.nilObj);
        this.popN(argumentCount+1);
        this.reclaimableContextCount++;
        this.storeContextRegisters();
        /////// Woosh //////
        this.activeContext = newContext; //We're off and running...
        //Following are more efficient than fetchContextRegisters() in newActiveContext()
        this.homeContext = newContext;
        this.method = newMethod;
        this.methodBytes = newMethod.bytes;
        this.pc = newPC;
        this.sp = newSP;
        this.storeContextRegisters(); // not really necessary, I claim
        this.receiver = newContext.pointers[Squeak.Context_receiver];
        if (this.receiver !== newRcvr)
            throw Error("receivers don't match");
        if (!newMethod.compiled && this.compiler)
            this.compiler.compile(newMethod, optClass, optSel);
        // check for process switch on full method activation
        if (this.interruptCheckCounter-- <= 0) this.checkForInterrupts();
    },
    doReturn: function(returnValue, targetContext) {
        // get sender from block home or closure's outerContext
        if (!targetContext) {
            var ctx = this.homeContext;
            if (this.hasClosures) {
                var closure;
                while (!(closure = ctx.pointers[Squeak.Context_closure]).isNil)
                    ctx = closure.pointers[Squeak.Closure_outerContext];
            }
            targetContext = ctx.pointers[Squeak.Context_sender];
        }
        if (targetContext.isNil || targetContext.pointers[Squeak.Context_instructionPointer].isNil)
            return this.cannotReturn(returnValue);
        // search up stack for unwind
        var thisContext = this.activeContext.pointers[Squeak.Context_sender];
        while (thisContext !== targetContext) {
            if (thisContext.isNil)
                return this.cannotReturn(returnValue);
            if (this.isUnwindMarked(thisContext))
                return this.aboutToReturnThrough(returnValue, thisContext);
            thisContext = thisContext.pointers[Squeak.Context_sender];
        }
        // no unwind to worry about, just peel back the stack (usually just to sender)
        var nextContext;
        thisContext = this.activeContext;
        while (thisContext !== targetContext) {
            if (this.breakOnContextReturned === thisContext) {
                this.breakOnContextReturned = null;
                this.breakNow();
            }
            nextContext = thisContext.pointers[Squeak.Context_sender];
            thisContext.pointers[Squeak.Context_sender] = this.nilObj;
            thisContext.pointers[Squeak.Context_instructionPointer] = this.nilObj;
            if (this.reclaimableContextCount > 0) {
                this.reclaimableContextCount--;
                this.recycleIfPossible(thisContext);
            }
            thisContext = nextContext;
        }
        this.activeContext = thisContext;
        this.fetchContextRegisters(this.activeContext);
        this.push(returnValue);
        if (this.breakOnContextChanged) {
            this.breakOnContextChanged = false;
            this.breakNow();
        }
    },
    aboutToReturnThrough: function(resultObj, aContext) {
    	this.push(this.activeContext);
    	this.push(resultObj);
    	this.push(aContext);
    	var aboutToReturnSel = this.specialObjects[Squeak.splOb_SelectorAboutToReturn];
    	this.send(aboutToReturnSel, 2);
    },
    cannotReturn: function(resultObj) {
    	this.push(this.activeContext);
    	this.push(resultObj);
    	var cannotReturnSel = this.specialObjects[Squeak.splOb_SelectorCannotReturn];
    	this.send(cannotReturnSel, 1);
    },
    tryPrimitive: function(primIndex, argCount, newMethod) {
        if ((primIndex > 255) && (primIndex < 520)) {
            if (primIndex >= 264) {//return instvars
                this.popNandPush(1, this.top().pointers[primIndex - 264]);
                return true;
            }
            switch (primIndex) {
                case 256: //return self
                    return true;
                case 257: this.popNandPush(1, this.trueObj); //return true
                    return true;
                case 258: this.popNandPush(1, this.falseObj); //return false
                    return true;
                case 259: this.popNandPush(1, this.nilObj); //return nil
                    return true;
            }
            this.popNandPush(1, primIndex - 261); //return -1...2
            return true;
        }
        var success = this.primHandler.doPrimitive(primIndex, argCount, newMethod);
        return success;
    },
    createActualMessage: function(selector, argCount, cls) {
        //Bundle up receiver, args and selector as a messageObject
        var message = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMessage], 0);
        var argArray = this.instantiateClass(this.specialObjects[Squeak.splOb_ClassArray], argCount);
        this.arrayCopy(this.activeContext.pointers, this.sp-argCount+1, argArray.pointers, 0, argCount); //copy args from stack
        message.pointers[Squeak.Message_selector] = selector;
        message.pointers[Squeak.Message_arguments] = argArray;
        if (message.pointers.length > Squeak.Message_lookupClass) //Early versions don't have lookupClass
            message.pointers[Squeak.Message_lookupClass] = cls;
        return message;
    },
    primitivePerform: function(argCount) {
        var selector = this.stackValue(argCount-1);
        var rcvr = this.stackValue(argCount);
        // NOTE: findNewMethodInClass may fail and be converted to #doesNotUnderstand:,
        //       (Whoah) so we must slide args down on the stack now, so that would work
        var trueArgCount = argCount - 1;
        var selectorIndex = this.sp - trueArgCount;
        var stack = this.activeContext.pointers; // slide eveything down...
        this.arrayCopy(stack, selectorIndex+1, stack, selectorIndex, trueArgCount);
        this.sp--; // adjust sp accordingly
        var entry = this.findSelectorInClass(selector, trueArgCount, this.getClass(rcvr));
        this.executeNewMethod(rcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
        return true;
    },
    primitivePerformWithArgs: function(argCount, supered) {
        var rcvr = this.stackValue(argCount);
        var selector = this.stackValue(argCount - 1);
        var args = this.stackValue(argCount - 2);
        if (args.sqClass !== this.specialObjects[Squeak.splOb_ClassArray])
            return false;
        var lookupClass = supered ? this.stackValue(argCount - 3) : this.getClass(rcvr);
        if (supered) { // verify that lookupClass is in fact in superclass chain of receiver;
            var cls = this.getClass(rcvr);
            while (cls !== lookupClass) {
                cls = cls.pointers[Squeak.Class_superclass];
                if (cls.isNil) return false;
            }
        }
        var trueArgCount = args.pointersSize();
        var stack = this.activeContext.pointers;
        this.arrayCopy(args.pointers, 0, stack, this.sp - 1, trueArgCount);
        this.sp += trueArgCount - argCount; //pop selector and array then push args
        var entry = this.findSelectorInClass(selector, trueArgCount, lookupClass);
        this.executeNewMethod(rcvr, entry.method, entry.argCount, entry.primIndex, entry.mClass, selector);
        return true;
    },
    findMethodCacheEntry: function(selector, lkupClass) {
        //Probe the cache, and return the matching entry if found
        //Otherwise return one that can be used (selector and class set) with method == null.
        //Initial probe is class xor selector, reprobe delta is selector
        //We do not try to optimize probe time -- all are equally 'fast' compared to lookup
        //Instead we randomize the reprobe so two or three very active conflicting entries
        //will not keep dislodging each other
        var entry;
        this.methodCacheRandomish = (this.methodCacheRandomish + 1) & 3;
        var firstProbe = (selector.hash ^ lkupClass.hash) & this.methodCacheMask;
        var probe = firstProbe;
        for (var i = 0; i < 4; i++) { // 4 reprobes for now
            entry = this.methodCache[probe];
            if (entry.selector === selector && entry.lkupClass === lkupClass) return entry;
            if (i === this.methodCacheRandomish) firstProbe = probe;
            probe = (probe + selector.hash) & this.methodCacheMask;
        }
        entry = this.methodCache[firstProbe];
        entry.lkupClass = lkupClass;
        entry.selector = selector;
        entry.method = null;
        return entry;
    },
    flushMethodCache: function() { //clear all cache entries (prim 89)
        for (var i = 0; i < this.methodCacheSize; i++) {
            this.methodCache[i].selector = null;   // mark it free
            this.methodCache[i].method = null;  // release the method
        }
        return true;
    },
    flushMethodCacheForSelector: function(selector) { //clear cache entries for selector (prim 119)
        for (var i = 0; i < this.methodCacheSize; i++)
            if (this.methodCache[i].selector === selector) {
                this.methodCache[i].selector = null;   // mark it free
                this.methodCache[i].method = null;  // release the method
            }
        return true;
    },
    flushMethodCacheForMethod: function(method) { //clear cache entries for method (prim 116)
        for (var i = 0; i < this.methodCacheSize; i++)
            if (this.methodCache[i].method === method) {
                this.methodCache[i].selector = null;   // mark it free
                this.methodCache[i].method = null;  // release the method
            }
        return true;
    },
    flushMethodCacheAfterBecome: function(mutations) {
        // could be selective by checking lkupClass, selector,
        // and method against mutations dict
        this.flushMethodCache();
    },
},
'contexts', {
    isUnwindMarked: function(ctx) {
        if (!this.isMethodContext(ctx)) return false;
        var method = ctx.pointers[Squeak.Context_method];
        return method.methodPrimitiveIndex() == 198;
    },
    newActiveContext: function(newContext) {
        // Note: this is inlined in executeNewMethod() and doReturn()
        this.storeContextRegisters();
        this.activeContext = newContext; //We're off and running...
        this.fetchContextRegisters(newContext);
    },
    fetchContextRegisters: function(ctxt) {
        var meth = ctxt.pointers[Squeak.Context_method];
        if (this.isSmallInt(meth)) { //if the Method field is an integer, activeCntx is a block context
            this.homeContext = ctxt.pointers[Squeak.BlockContext_home];
            meth = this.homeContext.pointers[Squeak.Context_method];
        } else { //otherwise home==ctxt
            this.homeContext = ctxt;
        }
        this.receiver = this.homeContext.pointers[Squeak.Context_receiver];
        this.method = meth;
        this.methodBytes = meth.bytes;
        this.pc = this.decodeSqueakPC(ctxt.pointers[Squeak.Context_instructionPointer], meth);
        this.sp = this.decodeSqueakSP(ctxt.pointers[Squeak.Context_stackPointer]);
    },
    storeContextRegisters: function() {
        //Save pc, sp into activeContext object, prior to change of context
        //   see fetchContextRegisters for symmetry
        //   expects activeContext, pc, sp, and method state vars to still be valid
        this.activeContext.pointers[Squeak.Context_instructionPointer] = this.encodeSqueakPC(this.pc, this.method);
        this.activeContext.pointers[Squeak.Context_stackPointer] = this.encodeSqueakSP(this.sp);
    },
    encodeSqueakPC: function(intPC, method) {
        // Squeak pc is offset by header and literals
        // and 1 for z-rel addressing
        return intPC + method.pointers.length * 4 + 1;
    },
    decodeSqueakPC: function(squeakPC, method) {
        return squeakPC - method.pointers.length * 4 - 1;
    },
    encodeSqueakSP: function(intSP) {
        // sp is offset by tempFrameStart, -1 for z-rel addressing
        return intSP - (Squeak.Context_tempFrameStart - 1);
    },
    decodeSqueakSP: function(squeakSP) {
        return squeakSP + (Squeak.Context_tempFrameStart - 1);
    },
    recycleIfPossible: function(ctxt) {
        if (!this.isMethodContext(ctxt)) return;
        if (ctxt.pointersSize() === (Squeak.Context_tempFrameStart+Squeak.Context_smallFrameSize)) {
            // Recycle small contexts
            ctxt.pointers[0] = this.freeContexts;
            this.freeContexts = ctxt;
        } else { // Recycle large contexts
            if (ctxt.pointersSize() !== (Squeak.Context_tempFrameStart+Squeak.Context_largeFrameSize))
                return;
            ctxt.pointers[0] = this.freeLargeContexts;
            this.freeLargeContexts = ctxt;
        }
    },
    allocateOrRecycleContext: function(needsLarge) {
        //Return a recycled context or a newly allocated one if none is available for recycling."
        var freebie;
        if (needsLarge) {
            if (!this.freeLargeContexts.isNil) {
                freebie = this.freeLargeContexts;
                this.freeLargeContexts = freebie.pointers[0];
                this.nRecycledContexts++;
                return freebie;
            }
            this.nAllocatedContexts++;
            return this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMethodContext], Squeak.Context_largeFrameSize);
        } else {
            if (!this.freeContexts.isNil) {
                freebie = this.freeContexts;
                this.freeContexts = freebie.pointers[0];
                this.nRecycledContexts++;
                return freebie;
            }
            this.nAllocatedContexts++;
            return this.instantiateClass(this.specialObjects[Squeak.splOb_ClassMethodContext], Squeak.Context_smallFrameSize);
        }
    },
},
'stack access', {
    pop: function() {
        //Note leaves garbage above SP.  Cleaned out by fullGC.
        return this.activeContext.pointers[this.sp--];  
    },
    popN: function(nToPop) {
        this.sp -= nToPop;
    },
    push: function(object) {
        this.activeContext.pointers[++this.sp] = object;
    },
    popNandPush: function(nToPop, object) {
        this.activeContext.pointers[this.sp -= nToPop - 1] = object;
    },
    top: function() {
        return this.activeContext.pointers[this.sp];
    },
    stackValue: function(depthIntoStack) {
        return this.activeContext.pointers[this.sp - depthIntoStack];
    },
    stackInteger: function(depthIntoStack) {
        return this.checkSmallInt(this.stackValue(depthIntoStack));
    },
    stackIntOrFloat: function(depthIntoStack) {
        var num = this.stackValue(depthIntoStack);
        // is it a SmallInt?
        if (typeof num === "number") return num;
        // is it a Float?
        if (num.isFloat) {
            this.resultIsFloat = true;   // need to return result as Float
            return num.float;
        }
        // maybe a 32-bit LargeInt?
        var bytes = num.bytes;
        if (bytes && bytes.length == 4) {
            var value = 0;
            for (var i = 3; i >= 0; i--)
                value = value * 256 + bytes[i];
            if (num.sqClass === this.specialObjects[Squeak.splOb_ClassLargePositiveInteger]) 
                return value;
            if (num.sqClass === this.specialObjects[Squeak.splOb_ClassLargeNegativeInteger]) 
                return -value;
        }
        // none of the above
        this.success = false;
        return 0;
    },
    pop2AndPushIntResult: function(intResult) {// returns success boolean
        if (this.success && this.canBeSmallInt(intResult)) {
            this.popNandPush(2, intResult);
            return true;
        }
        return false;
    },
    pop2AndPushNumResult: function(numResult) {// returns success boolean
        if (this.success) {
            if (this.resultIsFloat) {
                this.popNandPush(2, this.primHandler.makeFloat(numResult));
                return true;
            }
            if (numResult >= Squeak.MinSmallInt && numResult <= Squeak.MaxSmallInt) {
                this.popNandPush(2, numResult);
                return true;
            }
            if (numResult >= -0xFFFFFFFF && numResult <= 0xFFFFFFFF) {
                var negative = numResult < 0,
                    unsigned = negative ? -numResult : numResult,
                    lgIntClass = negative ? Squeak.splOb_ClassLargeNegativeInteger : Squeak.splOb_ClassLargePositiveInteger,
                    lgIntObj = this.instantiateClass(this.specialObjects[lgIntClass], 4),
                    bytes = lgIntObj.bytes;
                bytes[0] = unsigned     & 255;
                bytes[1] = unsigned>>8  & 255;
                bytes[2] = unsigned>>16 & 255;
                bytes[3] = unsigned>>24 & 255;
                this.popNandPush(2, lgIntObj);
                return true;
            }
        }
        return false;
    },
    pop2AndPushBoolResult: function(boolResult) {
        if (!this.success) return false;
        this.popNandPush(2, boolResult ? this.trueObj : this.falseObj);
        return true;
    },
},
'numbers', {
    getClass: function(obj) {
        if (this.isSmallInt(obj))
            return this.specialObjects[Squeak.splOb_ClassInteger];
        return obj.sqClass;
    },
    canBeSmallInt: function(anInt) {
        return (anInt >= Squeak.MinSmallInt) && (anInt <= Squeak.MaxSmallInt);
    },
    isSmallInt: function(object) {
        return typeof object === "number";
    },
    checkSmallInt: function(maybeSmallInt) { // returns an int and sets success
        if (typeof maybeSmallInt === "number")
            return maybeSmallInt;
        this.success = false;
        return 1;
    },
    quickDivide: function(rcvr, arg) { // must only handle exact case
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        var result = rcvr / arg | 0;
        if (result * arg === rcvr) return result;
        return Squeak.NonSmallInt;     // fail if result is not exact
    },
    div: function(rcvr, arg) {
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        return Math.floor(rcvr/arg);
    },
    mod: function(rcvr, arg) {
        if (arg === 0) return Squeak.NonSmallInt;  // fail if divide by zero
        return rcvr - Math.floor(rcvr/arg) * arg;
    },
    safeShift: function(smallInt, shiftCount) {
         // JS shifts only up to 31 bits
        if (shiftCount < 0) {
            if (shiftCount < -31) return smallInt < 0 ? -1 : 0;
            return smallInt >> -shiftCount; // OK to lose bits shifting right
        }
        if (shiftCount > 31) return smallInt == 0 ? 0 : Squeak.NonSmallInt;
        // check for lost bits by seeing if computation is reversible
        var shifted = smallInt << shiftCount;
        if  ((shifted>>shiftCount) === smallInt) return shifted;
        return Squeak.NonSmallInt;  //non-small result will cause failure
    },
},
'utils',
{
    isContext: function(obj) {//either block or methodContext
        if (obj.sqClass === this.specialObjects[Squeak.splOb_ClassMethodContext]) return true;
        if (obj.sqClass === this.specialObjects[Squeak.splOb_ClassBlockContext]) return true;
        return false;
    },
    isMethodContext: function(obj) {
        return obj.sqClass === this.specialObjects[Squeak.splOb_ClassMethodContext];
    },
    isMethod: function(obj, index) {
        return  obj.sqClass === this.specialObjects[Squeak.splOb_ClassCompiledMethod];
    },
    instantiateClass: function(aClass, indexableSize) {
        return this.image.instantiateClass(aClass, indexableSize, this.nilObj);
    },
    arrayFill: function(array, fromIndex, toIndex, value) {
        // assign value to range from fromIndex (inclusive) to toIndex (exclusive)
        for (var i = fromIndex; i < toIndex; i++)
            array[i] = value;
    },
    arrayCopy: function(src, srcPos, dest, destPos, length) {
        // copy length elements from src at srcPos to dest at destPos
        if (src === dest && srcPos < destPos)
            for (var i = length - 1; i >= 0; i--)
                dest[destPos + i] = src[srcPos + i];
        else
            for (var i = 0; i < length; i++)
                dest[destPos + i] = src[srcPos + i];
    },
},
'debugging', {
    addMessage: function(message) {
        return this.messages[message] ? ++this.messages[message] : this.messages[message] = 1;
    },
    warnOnce: function(message) {
        if (this.addMessage(message) == 1)
            console.warn(message);
    },
    printMethod: function(aMethod, optContext, optSel) {
        // return a 'class>>selector' description for the method
        if (optSel) return optContext.className() + '>>' + optSel.bytesAsString();
        // this is expensive, we have to search all classes
        if (!aMethod) aMethod = this.activeContext.contextMethod();
        var found;
        this.allMethodsDo(function(classObj, methodObj, selectorObj) {
            if (methodObj === aMethod)
                return found = classObj.className() + '>>' + selectorObj.bytesAsString();
        });
        if (found) return found;
        if (optContext) {
            var rcvr = optContext.pointers[Squeak.Context_receiver];
            return "(" + rcvr + ")>>?";
        }
        return "?>>?";
    },
    allMethodsDo: function(callback) {
        // callback(classObj, methodObj, selectorObj) should return true to break out of iteration
        var smalltalk = this.specialObjects[Squeak.splOb_SmalltalkDictionary].pointers,
            systemDict = smalltalk.length == 1 ? smalltalk[0].pointers[2].pointers : // very new: an environment
                typeof smalltalk[0] == "number" ? smalltalk : // regular: just the system dict
                smalltalk[1].pointers, // very old: an association
            globals = systemDict[1].pointers;
        for (var i = 0; i < globals.length; i++) {
            var assn = globals[i];
            if (!assn.isNil) {
                var assnVal = assn.pointers[1];
                if (assnVal.pointers && assnVal.pointers.length >= 9) {
                    var clsAndMeta = [assnVal, assnVal.sqClass];
                    for (var c = 0; c < clsAndMeta.length; c++) {
                        var cls = clsAndMeta[c];
                        var mdict = cls.pointers[1];
                        if (!mdict.pointers || !mdict.pointers[1]) continue;
                        var methods = mdict.pointers[1].pointers;
                        if (!methods) continue;
                        var selectors = mdict.pointers;
                        for (var j = 0; j < methods.length; j++) {
                            if (callback.call(this, cls, methods[j], selectors[2+j]))
                                return;
                        }
                    }
                }
            }
        }
    },
    printStack: function(ctx, limit) {
        // both args are optional
        if (typeof ctx == "number") {limit = ctx; ctx = null;}
        if (!ctx) ctx = this.activeContext;
        if (!limit) limit = 100;
        var contexts = [],
            hardLimit = Math.max(limit, 1000000);
        while (!ctx.isNil && hardLimit-- > 0) {
            contexts.push(ctx);
            ctx = ctx.pointers[Squeak.Context_sender];
        }
        var extra = 200;
        if (contexts.length > limit + extra) {
            if (!ctx.isNil) contexts.push('...'); // over hard limit
            contexts = contexts.slice(0, limit).concat(['...']).concat(contexts.slice(-extra));
        }
        var stack = [],
            i = contexts.length;
        while (i-- > 0) {
            var ctx = contexts[i];
            if (!ctx.pointers) {
                stack.push('...\n');
            } else {
                var block = '',
                    method = ctx.pointers[Squeak.Context_method];
                if (typeof method === 'number') { // it's a block context, fetch home
                    method = ctx.pointers[Squeak.BlockContext_home].pointers[Squeak.Context_method];
                    block = '[] in ';
                } else if (!ctx.pointers[Squeak.Context_closure].isNil) {
                    block = '[] in '; // it's a closure activation
                }
                stack.push(block + this.printMethod(method, ctx) + '\n');
            }
        }
        return stack.join('');
    },
    findMethod: function(classAndMethodString) {
        // classAndMethodString is 'Class>>method'
        var found,
            className = classAndMethodString.split('>>')[0],
            methodName = classAndMethodString.split('>>')[1];
        this.allMethodsDo(function(classObj, methodObj, selectorObj) {
            if (methodName.length == selectorObj.bytesSize()
                && methodName == selectorObj.bytesAsString() 
                && className == classObj.className())
                    return found = methodObj;
        });
        return found;
    },
    breakNow: function(msg) {
        if (msg) console.log("Break: " + msg);
        this.breakOutOfInterpreter = 'break';
    },
    breakOn: function(classAndMethodString) {
        // classAndMethodString is 'Class>>method'
        return this.breakOnMethod = classAndMethodString && this.findMethod(classAndMethodString);
    },
    breakOnReturnFromThisContext: function() {
        this.breakOnContextChanged = false;
        this.breakOnContextReturned = this.activeContext;
    },
    breakOnSendOrReturn: function() {
        this.breakOnContextChanged = true;
        this.breakOnContextReturned = null;
    },
    printActiveContext: function() {
        // temps and stack in current context
        var ctx = this.activeContext;
        var isBlock = typeof ctx.pointers[Squeak.BlockContext_argumentCount] === 'number';
        var closure = ctx.pointers[Squeak.Context_closure];
        var isClosure = !isBlock && !closure.isNil;
        var homeCtx = isBlock ? ctx.pointers[Squeak.BlockContext_home] : ctx;
        var tempCount = isClosure
            ? closure.pointers[Squeak.Closure_numArgs]
            : homeCtx.pointers[Squeak.Context_method].methodTempCount();
        var stackBottom = this.decodeSqueakSP(0);
        var stackTop = homeCtx.contextSizeWithStack(this) - 1;
        var firstTemp = stackBottom + 1;
        var lastTemp = firstTemp + tempCount - 1;
        var stack = '';
        for (var i = stackBottom; i <= stackTop; i++) {
            var obj = homeCtx.pointers[i];
            var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
            var label = '';
            if (i == stackBottom) label = '=rcvr'; else
            if (i <= lastTemp) label = '=tmp' + (i - firstTemp);
            stack += '\nctx[' + i + ']' + label +': ' + value;
        }
        if (isBlock) {
            stack += '\n';
            var nArgs = ctx.pointers[3];
            var firstArg = this.decodeSqueakSP(1);
            var lastArg = firstArg + nArgs;
            for (var i = firstArg; i <= this.sp; i++) {
                var obj = ctx.pointers[i];
                var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
                var label = '';
                if (i <= lastArg) label = '=arg' + (i - firstArg);
                stack += '\nblk[' + i + ']' + label +': ' + value;
            }
        }
        return stack;
    },
    printAllProcesses: function() {
        var schedAssn = this.specialObjects[Squeak.splOb_SchedulerAssociation],
            sched = schedAssn.pointers[Squeak.Assn_value];
        // print active process
        var activeProc = sched.pointers[Squeak.ProcSched_activeProcess],
            result = "Active: " + this.printProcess(activeProc, true);
        // print other runnable processes
        var lists = sched.pointers[Squeak.ProcSched_processLists].pointers;
        for (var priority = lists.length - 1; priority >= 0; priority--) {
            var process = lists[priority].pointers[Squeak.LinkedList_firstLink];
            while (!process.isNil) {
                result += "\nRunnable: " + this.printProcess(process);
                process = process.pointers[Squeak.Link_nextLink];
            }
        }
        // print all processes waiting on a semaphore
        var semaClass = this.specialObjects[Squeak.splOb_ClassSemaphore],
            sema = this.image.someInstanceOf(semaClass);
        while (sema) {
            var process = sema.pointers[Squeak.LinkedList_firstLink];
            while (!process.isNil) {
                result += "\nWaiting: " + this.printProcess(process);
                process = process.pointers[Squeak.Link_nextLink];
            }
            sema = this.image.nextInstanceAfter(sema);
        }
        return result;
    },
    printProcess: function(process, active) {
        var context = process.pointers[Squeak.Proc_suspendedContext],
            priority = process.pointers[Squeak.Proc_priority],
            stack = this.printStack(active ? null : context);
        return process.toString() +" at priority " + priority + "\n" + stack;
    },
    printByteCodes: function(aMethod, optionalIndent, optionalHighlight, optionalPC) {
        if (!aMethod) aMethod = this.method;
        var printer = new Squeak.InstructionPrinter(aMethod, this);
        return printer.printInstructions(optionalIndent, optionalHighlight, optionalPC);
    },
    willSendOrReturn: function() {
        // Answer whether the next bytecode corresponds to a Smalltalk
        // message send or return
        var byte = this.method.bytes[this.pc];
        if (byte >= 120 && byte <= 125) return true; // return
        /* 
        if (byte < 96) return false;    // 96-103 storeAndPopReceiverVariableBytecode
        if (byte <= 111) return true;   // 104-111 storeAndPopTemporaryVariableBytecode
        if (byte == 129        // 129 extendedStoreBytecode
            || byte == 130     // 130 extendedStoreAndPopBytecode
            || byte == 141	   // 141 storeRemoteTempLongBytecode
            || byte == 142	   // 142 storeAndPopRemoteTempLongBytecode
            || (byte == 132 && 
                this.method.bytes[this.pc + 1] >= 160)) // 132 doubleExtendedDoAnythingBytecode
                    return true;
        */
        if (byte < 131 || byte == 200) return false;
        if (byte >= 176) return true; // special send or short send
        if (byte <= 134) {         // long sends
			// long form support demands we check the selector
			var litIndex;
			if (byte === 132) {
                if ((this.method.bytes[this.pc + 1] >> 5) > 1) return false;
                litIndex = this.method.bytes[this.pc + 2];
			} else
                litIndex = this.method.bytes[this.pc + 1] & (byte === 134 ? 63 : 31);
            var selectorObj = this.method.pointers[litIndex + 1];
            if (selectorObj.bytesAsString() != 'blockCopy:') return true;
        }
        return false;
    },
});

Object.subclass('Squeak.Primitives',
'initialization', {
    initialize: function(vm, display) {
        this.vm = vm;
        this.display = display;
        this.display.vm = this.vm;
        this.oldPrims = !this.vm.image.hasClosures;
        this.deferDisplayUpdates = false;
        this.semaphoresToSignal = [];
        this.initDisplay();
        this.initAtCache();
        this.initModules();
    },
    initModules: function() {
        this.loadedModules = {};
        this.builtinModules = {
            FilePlugin:            this.findPluginFunctions("",         "primitive(File|Directory)"),
            SoundPlugin:           this.findPluginFunctions("snd_",     "", true),
            B2DPlugin:             this.findPluginFunctions("ge",       ""),
        };
        this.patchModules = {
            ScratchPlugin:         this.findPluginFunctions("scratch_", ""),
        };
        this.interpreterProxy = new Squeak.InterpreterProxy(this.vm);
    },
    findPluginFunctions: function(prefix, match, bindLate) {
        match = match || "(initialise|shutdown|primitive)";
        var plugin = {},
            regex = new RegExp("^" + prefix + match, "i");
        for (var funcName in this)
            if (regex.test(funcName) && typeof this[funcName] == "function") {
                var primName = funcName;
                if (prefix) primName = funcName[prefix.length].toLowerCase() + funcName.slice(prefix.length + 1);
                plugin[primName] = bindLate ? funcName : this[funcName].bind(this);
            }
        return plugin;
    },
    initDisplay: function() {
        this.indexedColors = [
            0xFFFFFFFF, 0xFF000001, 0xFFFFFFFF, 0xFF808080, 0xFFFF0000, 0xFF00FF00, 0xFF0000FF, 0xFF00FFFF,
            0xFFFFFF00, 0xFFFF00FF, 0xFF202020, 0xFF404040, 0xFF606060, 0xFF9F9F9F, 0xFFBFBFBF, 0xFFDFDFDF,
            0xFF080808, 0xFF101010, 0xFF181818, 0xFF282828, 0xFF303030, 0xFF383838, 0xFF484848, 0xFF505050,
            0xFF585858, 0xFF686868, 0xFF707070, 0xFF787878, 0xFF878787, 0xFF8F8F8F, 0xFF979797, 0xFFA7A7A7,
            0xFFAFAFAF, 0xFFB7B7B7, 0xFFC7C7C7, 0xFFCFCFCF, 0xFFD7D7D7, 0xFFE7E7E7, 0xFFEFEFEF, 0xFFF7F7F7,
            0xFF000001, 0xFF003300, 0xFF006600, 0xFF009900, 0xFF00CC00, 0xFF00FF00, 0xFF000033, 0xFF003333,
            0xFF006633, 0xFF009933, 0xFF00CC33, 0xFF00FF33, 0xFF000066, 0xFF003366, 0xFF006666, 0xFF009966,
            0xFF00CC66, 0xFF00FF66, 0xFF000099, 0xFF003399, 0xFF006699, 0xFF009999, 0xFF00CC99, 0xFF00FF99, 
            0xFF0000CC, 0xFF0033CC, 0xFF0066CC, 0xFF0099CC, 0xFF00CCCC, 0xFF00FFCC, 0xFF0000FF, 0xFF0033FF, 
            0xFF0066FF, 0xFF0099FF, 0xFF00CCFF, 0xFF00FFFF, 0xFF330000, 0xFF333300, 0xFF336600, 0xFF339900, 
            0xFF33CC00, 0xFF33FF00, 0xFF330033, 0xFF333333, 0xFF336633, 0xFF339933, 0xFF33CC33, 0xFF33FF33, 
            0xFF330066, 0xFF333366, 0xFF336666, 0xFF339966, 0xFF33CC66, 0xFF33FF66, 0xFF330099, 0xFF333399, 
            0xFF336699, 0xFF339999, 0xFF33CC99, 0xFF33FF99, 0xFF3300CC, 0xFF3333CC, 0xFF3366CC, 0xFF3399CC,
            0xFF33CCCC, 0xFF33FFCC, 0xFF3300FF, 0xFF3333FF, 0xFF3366FF, 0xFF3399FF, 0xFF33CCFF, 0xFF33FFFF,
            0xFF660000, 0xFF663300, 0xFF666600, 0xFF669900, 0xFF66CC00, 0xFF66FF00, 0xFF660033, 0xFF663333,
            0xFF666633, 0xFF669933, 0xFF66CC33, 0xFF66FF33, 0xFF660066, 0xFF663366, 0xFF666666, 0xFF669966, 
            0xFF66CC66, 0xFF66FF66, 0xFF660099, 0xFF663399, 0xFF666699, 0xFF669999, 0xFF66CC99, 0xFF66FF99, 
            0xFF6600CC, 0xFF6633CC, 0xFF6666CC, 0xFF6699CC, 0xFF66CCCC, 0xFF66FFCC, 0xFF6600FF, 0xFF6633FF, 
            0xFF6666FF, 0xFF6699FF, 0xFF66CCFF, 0xFF66FFFF, 0xFF990000, 0xFF993300, 0xFF996600, 0xFF999900, 
            0xFF99CC00, 0xFF99FF00, 0xFF990033, 0xFF993333, 0xFF996633, 0xFF999933, 0xFF99CC33, 0xFF99FF33, 
            0xFF990066, 0xFF993366, 0xFF996666, 0xFF999966, 0xFF99CC66, 0xFF99FF66, 0xFF990099, 0xFF993399, 
            0xFF996699, 0xFF999999, 0xFF99CC99, 0xFF99FF99, 0xFF9900CC, 0xFF9933CC, 0xFF9966CC, 0xFF9999CC, 
            0xFF99CCCC, 0xFF99FFCC, 0xFF9900FF, 0xFF9933FF, 0xFF9966FF, 0xFF9999FF, 0xFF99CCFF, 0xFF99FFFF, 
            0xFFCC0000, 0xFFCC3300, 0xFFCC6600, 0xFFCC9900, 0xFFCCCC00, 0xFFCCFF00, 0xFFCC0033, 0xFFCC3333, 
            0xFFCC6633, 0xFFCC9933, 0xFFCCCC33, 0xFFCCFF33, 0xFFCC0066, 0xFFCC3366, 0xFFCC6666, 0xFFCC9966,
            0xFFCCCC66, 0xFFCCFF66, 0xFFCC0099, 0xFFCC3399, 0xFFCC6699, 0xFFCC9999, 0xFFCCCC99, 0xFFCCFF99,
            0xFFCC00CC, 0xFFCC33CC, 0xFFCC66CC, 0xFFCC99CC, 0xFFCCCCCC, 0xFFCCFFCC, 0xFFCC00FF, 0xFFCC33FF, 
            0xFFCC66FF, 0xFFCC99FF, 0xFFCCCCFF, 0xFFCCFFFF, 0xFFFF0000, 0xFFFF3300, 0xFFFF6600, 0xFFFF9900, 
            0xFFFFCC00, 0xFFFFFF00, 0xFFFF0033, 0xFFFF3333, 0xFFFF6633, 0xFFFF9933, 0xFFFFCC33, 0xFFFFFF33,
            0xFFFF0066, 0xFFFF3366, 0xFFFF6666, 0xFFFF9966, 0xFFFFCC66, 0xFFFFFF66, 0xFFFF0099, 0xFFFF3399, 
            0xFFFF6699, 0xFFFF9999, 0xFFFFCC99, 0xFFFFFF99, 0xFFFF00CC, 0xFFFF33CC, 0xFFFF66CC, 0xFFFF99CC, 
            0xFFFFCCCC, 0xFFFFFFCC, 0xFFFF00FF, 0xFFFF33FF, 0xFFFF66FF, 0xFFFF99FF, 0xFFFFCCFF, 0xFFFFFFFF];
    },
},
'dispatch', {
    quickSendOther: function(rcvr, lobits) {
        // returns true if it succeeds
        this.success = true;
        switch (lobits) {
            case 0x0: return this.popNandPushIfOK(2, this.objectAt(true,true,false)); // at:
            case 0x1: return this.popNandPushIfOK(3, this.objectAtPut(true,true,false)); // at:put:
            case 0x2: return this.popNandPushIfOK(1, this.objectSize(true)); // size
            //case 0x3: return false; // next
            //case 0x4: return false; // nextPut:
            //case 0x5: return false; // atEnd
            case 0x6: return this.pop2andPushBoolIfOK(this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 0x7: return this.popNandPushIfOK(1,this.vm.getClass(this.vm.top())); // class
            case 0x8: return this.popNandPushIfOK(2,this.doBlockCopy()); // blockCopy:
            case 0x9: return this.primitiveBlockValue(0); // value
            case 0xA: return this.primitiveBlockValue(1); // value:
            //case 0xB: return false; // do:
            //case 0xC: return false; // new
            //case 0xD: return false; // new:
            //case 0xE: return false; // x
            //case 0xF: return false; // y
        }
        return false;
    },
    doPrimitive: function(index, argCount, primMethod) {
        this.success = true;
        if (index < 128) // Chrome only optimized up to 128 cases
        switch (index) {
            // Integer Primitives (0-19)
            case 1: return this.popNandPushIntIfOK(2,this.stackInteger(1) + this.stackInteger(0));  // Integer.add
            case 2: return this.popNandPushIntIfOK(2,this.stackInteger(1) - this.stackInteger(0));  // Integer.subtract
            case 3: return this.pop2andPushBoolIfOK(this.stackInteger(1) < this.stackInteger(0));   // Integer.less
            case 4: return this.pop2andPushBoolIfOK(this.stackInteger(1) > this.stackInteger(0));   // Integer.greater
            case 5: return this.pop2andPushBoolIfOK(this.stackInteger(1) <= this.stackInteger(0));  // Integer.leq
            case 6: return this.pop2andPushBoolIfOK(this.stackInteger(1) >= this.stackInteger(0));  // Integer.geq
            case 7: return this.pop2andPushBoolIfOK(this.stackInteger(1) === this.stackInteger(0)); // Integer.equal
            case 8: return this.pop2andPushBoolIfOK(this.stackInteger(1) !== this.stackInteger(0)); // Integer.notequal
            case 9: return this.popNandPushIntIfOK(2,this.stackInteger(1) * this.stackInteger(0));  // Integer.multiply *
            case 10: return this.popNandPushIntIfOK(2,this.vm.quickDivide(this.stackInteger(1),this.stackInteger(0)));  // Integer.divide /  (fails unless exact)
            case 11: return this.popNandPushIntIfOK(2,this.vm.mod(this.stackInteger(1),this.stackInteger(0)));  // Integer.mod \\
            case 12: return this.popNandPushIntIfOK(2,this.vm.div(this.stackInteger(1),this.stackInteger(0)));  // Integer.div //
            case 13: return this.popNandPushIntIfOK(2,this.stackInteger(1) / this.stackInteger(0) | 0);  // Integer.quo
            case 14: return this.popNandPushIfOK(2,this.doBitAnd());  // SmallInt.bitAnd
            case 15: return this.popNandPushIfOK(2,this.doBitOr());  // SmallInt.bitOr
            case 16: return this.popNandPushIfOK(2,this.doBitXor());  // SmallInt.bitXor
            case 17: return this.popNandPushIfOK(2,this.doBitShift());  // SmallInt.bitShift
            case 18: return this.primitiveMakePoint(argCount, false);
            case 19: return false;                                 // Guard primitive for simulation -- *must* fail
            // LargeInteger Primitives (20-39)
            // 32-bit logic is aliased to Integer prims above
            case 20: return false; // primitiveRemLargeIntegers
            case 21: return false; // primitiveAddLargeIntegers
            case 22: return false; // primitiveSubtractLargeIntegers
            case 23: return false; // primitiveLessThanLargeIntegers
            case 24: return false; // primitiveGreaterThanLargeIntegers
            case 25: return false; // primitiveLessOrEqualLargeIntegers
            case 26: return false; // primitiveGreaterOrEqualLargeIntegers
            case 27: return false; // primitiveEqualLargeIntegers
            case 28: return false; // primitiveNotEqualLargeIntegers
            case 29: return false; // primitiveMultiplyLargeIntegers
            case 30: return false; // primitiveDivideLargeIntegers
            case 31: return false; // primitiveModLargeIntegers
            case 32: return false; // primitiveDivLargeIntegers
            case 33: return false; // primitiveQuoLargeIntegers
            case 34: return false; // primitiveBitAndLargeIntegers
            case 35: return false; // primitiveBitOrLargeIntegers
            case 36: return false; // primitiveBitXorLargeIntegers
            case 37: return false; // primitiveBitShiftLargeIntegers
            case 38: return this.popNandPushIfOK(2, this.objectAt(false,false,false)); // Float basicAt
            case 39: return this.popNandPushIfOK(3, this.objectAtPut(false,false,false)); // Float basicAtPut
            // Float Primitives (40-59)
            case 40: return this.popNandPushFloatIfOK(1,this.stackInteger(0)); // primitiveAsFloat
            case 41: return this.popNandPushFloatIfOK(2,this.stackFloat(1)+this.stackFloat(0));  // Float +
            case 42: return this.popNandPushFloatIfOK(2,this.stackFloat(1)-this.stackFloat(0));  // Float -	
            case 43: return this.pop2andPushBoolIfOK(this.stackFloat(1)<this.stackFloat(0));  // Float <
            case 44: return this.pop2andPushBoolIfOK(this.stackFloat(1)>this.stackFloat(0));  // Float >
            case 45: return this.pop2andPushBoolIfOK(this.stackFloat(1)<=this.stackFloat(0));  // Float <=
            case 46: return this.pop2andPushBoolIfOK(this.stackFloat(1)>=this.stackFloat(0));  // Float >=
            case 47: return this.pop2andPushBoolIfOK(this.stackFloat(1)===this.stackFloat(0));  // Float =
            case 48: return this.pop2andPushBoolIfOK(this.stackFloat(1)!==this.stackFloat(0));  // Float !=
            case 49: return this.popNandPushFloatIfOK(2,this.stackFloat(1)*this.stackFloat(0));  // Float.mul
            case 50: return this.popNandPushFloatIfOK(2,this.safeFDiv(this.stackFloat(1),this.stackFloat(0)));  // Float.div
            case 51: return this.popNandPushIfOK(1,this.floatAsSmallInt(this.stackFloat(0)));  // Float.asInteger
            case 52: return false; // Float.fractionPart (modf)
            case 53: return this.popNandPushIntIfOK(1, this.frexp_exponent(this.stackFloat(0)) - 1); // Float.exponent
            case 54: return this.popNandPushFloatIfOK(2, this.ldexp(this.stackFloat(1), this.stackFloat(0))); // Float.timesTwoPower
            case 55: return this.popNandPushFloatIfOK(1, Math.sqrt(this.stackFloat(0))); // SquareRoot
            case 56: return this.popNandPushFloatIfOK(1, Math.sin(this.stackFloat(0))); // Sine
            case 57: return this.popNandPushFloatIfOK(1, Math.atan(this.stackFloat(0))); // Arctan
            case 58: return this.popNandPushFloatIfOK(1, Math.log(this.stackFloat(0))); // LogN
            case 59: return this.popNandPushFloatIfOK(1, Math.exp(this.stackFloat(0))); // Exp
            // Subscript and Stream Primitives (60-67)
            case 60: return this.popNandPushIfOK(2, this.objectAt(false,false,false)); // basicAt:
            case 61: return this.popNandPushIfOK(3, this.objectAtPut(false,false,false)); // basicAt:put:
            case 62: return this.popNandPushIfOK(1, this.objectSize(false)); // size
            case 63: return this.popNandPushIfOK(2, this.objectAt(false,true,false)); // String.basicAt:
            case 64: return this.popNandPushIfOK(3, this.objectAtPut(false,true,false)); // String.basicAt:put:
            case 65: return false; // primitiveNext
            case 66: return false; // primitiveNextPut
            case 67: return false; // primitiveAtEnd
            // StorageManagement Primitives (68-79)
            case 68: return this.popNandPushIfOK(2, this.objectAt(false,false,true)); // Method.objectAt:
            case 69: return this.popNandPushIfOK(3, this.objectAtPut(false,false,true)); // Method.objectAt:put:
            case 70: return this.popNandPushIfOK(1, this.instantiateClass(this.stackNonInteger(0), 0)); // Class.new
            case 71: return this.popNandPushIfOK(2, this.instantiateClass(this.stackNonInteger(1), this.stackPos32BitInt(0))); // Class.new:
            case 72: return this.primitiveArrayBecome(argCount, false); // one way
            case 73: return this.popNandPushIfOK(2, this.objectAt(false,false,true)); // instVarAt:
            case 74: return this.popNandPushIfOK(3, this.objectAtPut(false,false,true)); // instVarAt:put:
            case 75: return this.popNandPushIfOK(1, this.stackNonInteger(0).hash); // Object.identityHash
            case 76: return this.primitiveStoreStackp(argCount);  // (Blue Book: primitiveAsObject)
            case 77: return this.popNandPushIfOK(1, this.someInstanceOf(this.stackNonInteger(0))); // Class.someInstance
            case 78: return this.popNandPushIfOK(1, this.nextInstanceAfter(this.stackNonInteger(0))); // Object.nextInstance
            case 79: return this.primitiveNewMethod(argCount); // Compiledmethod.new
            // Control Primitives (80-89)
            case 80: return this.popNandPushIfOK(2,this.doBlockCopy()); // blockCopy:
            case 81: return this.primitiveBlockValue(argCount); // BlockContext.value
            case 82: return this.primitiveBlockValueWithArgs(argCount); // BlockContext.valueWithArguments:
            case 83: return this.vm.primitivePerform(argCount); // Object.perform:(with:)*
            case 84: return this.vm.primitivePerformWithArgs(argCount, false); //  Object.perform:withArguments:
            case 85: return this.primitiveSignal(); // Semaphore.wait
            case 86: return this.primitiveWait(); // Semaphore.wait
            case 87: return this.primitiveResume(); // Process.resume
            case 88: return this.primitiveSuspend(); // Process.suspend
            case 89: return this.vm.flushMethodCache(); //primitiveFlushCache
            // Input/Output Primitives (90-109)
            case 90: return this.primitiveMousePoint(argCount); // mousePoint
            case 91: return this.primitiveTestDisplayDepth(argCount); // cursorLocPut in old images
            // case 92: return false; // primitiveSetDisplayMode
            case 93: return this.primitiveInputSemaphore(argCount); 
            case 94: return this.primitiveGetNextEvent(argCount);
            case 95: return this.primitiveInputWord(argCount);
            case 96: return this.namedPrimitive('BitBltPlugin', 'primitiveCopyBits', argCount);
            case 97: return this.primitiveSnapshot(argCount);
            //case 98: return false; // primitiveStoreImageSegment
            //case 99: return false; // primitiveLoadImageSegment
            case 100: return this.vm.primitivePerformWithArgs(argCount, true); // Object.perform:withArguments:inSuperclass: (Blue Book: primitiveSignalAtTick)
            case 101: return this.primitiveBeCursor(argCount); // Cursor.beCursor
            case 102: return this.primitiveBeDisplay(argCount); // DisplayScreen.beDisplay
            case 103: return false; // primitiveScanCharacters
            case 104: return false; // primitiveDrawLoop
            case 105: return this.popNandPushIfOK(5, this.doStringReplace()); // string and array replace
            case 106: return this.primitiveScreenSize(argCount); // actualScreenSize
            case 107: return this.primitiveMouseButtons(argCount); // Sensor mouseButtons
            case 108: return this.primitiveKeyboardNext(argCount); // Sensor kbdNext
            case 109: return this.primitiveKeyboardPeek(argCount); // Sensor kbdPeek
            // System Primitives (110-119)
            case 110: return this.pop2andPushBoolIfOK(this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 111: return this.popNandPushIfOK(1, this.vm.getClass(this.vm.top())); // Object.class
            case 112: return this.popNandPushIfOK(1, this.vm.image.bytesLeft()); //primitiveBytesLeft
            case 113: return this.primitiveQuit(argCount);
            case 114: return this.primitiveExitToDebugger(argCount);
            case 115: return this.primitiveChangeClass(argCount);
            case 116: return this.vm.flushMethodCacheForMethod(this.vm.top());  // after Squeak 2.2 uses 119
            case 117: return this.doNamedPrimitive(primMethod, argCount); // named prims
            case 118: return this.primitiveDoPrimitiveWithArgs(argCount);
            case 119: return this.vm.flushMethodCacheForSelector(this.vm.top()); // before Squeak 2.3 uses 116
            // Miscellaneous Primitives (120-149)
            case 120: return false; //primitiveCalloutToFFI
            case 121: return this.primitiveImageName(argCount); //get+set imageName
            case 122: return this.primitiveReverseDisplay(argCount); // Blue Book: primitiveImageVolume
            //case 123: return false; //TODO primitiveValueUninterruptably
            case 124: return this.popNandPushIfOK(2, this.registerSemaphore(Squeak.splOb_TheLowSpaceSemaphore));
            case 125: return this.popNandPushIfOK(2, this.setLowSpaceThreshold());
            case 126: return this.primitiveDeferDisplayUpdates(argCount);
    		case 127: return this.primitiveShowDisplayRect(argCount);
    	} else if (index < 256) switch (index) { // Chrome only optimized up to 128 cases
            case 128: return this.primitiveArrayBecome(argCount, true); // both ways
            case 129: return this.popNandPushIfOK(1, this.vm.image.specialObjectsArray); //specialObjectsOop
            case 130: return this.primitiveFullGC(argCount);
            case 131: return this.popNandPushIfOK(1, this.vm.image.partialGC()); // GCmost
            case 132: return this.pop2andPushBoolIfOK(this.pointsTo(this.stackNonInteger(1), this.vm.top())); //Object.pointsTo
            case 133: return true; //TODO primitiveSetInterruptKey
            case 134: return this.popNandPushIfOK(2, this.registerSemaphore(Squeak.splOb_TheInterruptSemaphore));
            case 135: return this.popNandPushIfOK(1, this.millisecondClockValue());
            case 136: return this.primitiveSignalAtMilliseconds(argCount); //Delay signal:atMs:());
            case 137: return this.popNandPushIfOK(1, this.secondClock()); // seconds since Jan 1, 1901
            case 138: return this.popNandPushIfOK(1, this.someObject()); // Object.someObject
            case 139: return this.popNandPushIfOK(1, this.nextObject(this.vm.top())); // Object.nextObject
            case 140: return this.primitiveBeep(argCount);
            case 141: return this.primitiveClipboardText(argCount);
            case 142: return this.popNandPushIfOK(1, this.makeStString(this.filenameToSqueak(Squeak.vmPath)));
            case 143: // short at and shortAtPut
            case 144: return this.primitiveShortAtAndPut(argCount);
            case 145: return this.primitiveConstantFill(argCount);
            case 146: return this.namedPrimitive('JoystickTabletPlugin', 'primitiveReadJoystick', argCount);
            case 147: return this.namedPrimitive('BitBltPlugin', 'primitiveWarpBits', argCount);
            case 148: return this.popNandPushIfOK(1, this.vm.image.clone(this.vm.top())); //shallowCopy
            case 149: return this.primitiveGetAttribute(argCount);
            // File Primitives (150-169)
            case 150: if (this.oldPrims) return this.primitiveFileAtEnd(argCount);
            case 151: if (this.oldPrims) return this.primitiveFileClose(argCount);
            case 152: if (this.oldPrims) return this.primitiveFileGetPosition(argCount);
            case 153: if (this.oldPrims) return this.primitiveFileOpen(argCount);
            case 154: if (this.oldPrims) return this.primitiveFileRead(argCount);
            case 155: if (this.oldPrims) return this.primitiveFileSetPosition(argCount);
            case 156: if (this.oldPrims) return this.primitiveFileDelete(argCount);
            case 157: if (this.oldPrims) return this.primitiveFileSize(argCount);
            case 158: if (this.oldPrims) return this.primitiveFileWrite(argCount);
            case 159: if (this.oldPrims) return this.primitiveFileRename(argCount);
            case 160: if (this.oldPrims) return this.primitiveDirectoryCreate(argCount); // new: primitiveAdoptInstance
            case 161: if (this.oldPrims) return this.primitiveDirectoryDelimitor(argCount); // new: primitiveSetIdentityHash
            case 162: if (this.oldPrims) return this.primitiveDirectoryLookup(argCount);
            case 163: if (this.oldPrims) return this.primitiveDirectoryDelete(argCount);
            // 164: unused
            case 165:
            case 166: return this.primitiveIntegerAtAndPut(argCount);
            case 167: return false; // Processor.yield
            case 168: return this.primitiveCopyObject(argCount); 
            case 169: if (this.oldPrims) return this.primitiveDirectorySetMacTypeAndCreator(argCount);
                else return this.primitiveNotIdentical(argCount);
            // Sound Primitives (170-199)
            case 170: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStart', argCount);
            case 171: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStartWithSemaphore', argCount);
            case 172: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStop', argCount);
            case 173: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundAvailableSpace', argCount);
            case 174: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundPlaySamples', argCount);
            case 175: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundPlaySilence', argCount);
            case 176: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primWaveTableSoundmixSampleCountintostartingAtpan', argCount);
            case 177: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primFMSoundmixSampleCountintostartingAtpan', argCount);
            case 178: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primPluckedSoundmixSampleCountintostartingAtpan', argCount);
            case 179: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primSampledSoundmixSampleCountintostartingAtpan', argCount);
            case 180: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixFMSound', argCount);
            case 181: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixPluckedSound', argCount);
            case 182: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'oldprimSampledSoundmixSampleCountintostartingAtleftVolrightVol', argCount);
            case 183: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveApplyReverb', argCount);
            case 184: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixLoopedSampledSound', argCount);
            case 185: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixSampledSound', argCount);
            // 186-188: was unused
            case 188: if (!this.oldPrims) return this.primitiveExecuteMethodArgsArray(argCount);
            case 189: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundInsertSamples', argCount);
            case 190: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStartRecording', argCount);
            case 191: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStopRecording', argCount);
            case 192: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundGetRecordingSampleRate', argCount);
            case 193: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundRecordSamples', argCount);
            case 194: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundSetRecordLevel', argCount);
            case 195: return false; // Context.findNextUnwindContextUpTo:
            case 196: return false; // Context.terminateTo:
            case 197: return false; // Context.findNextHandlerContextStarting
            case 198: return false; // MarkUnwindMethod (must fail)
            case 199: return false; // MarkHandlerMethod (must fail)
            // Networking Primitives (200-229)
            case 200: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveInitializeNetwork', argCount);
                else return this.primitiveClosureCopyWithCopiedValues(argCount);
            case 201: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStartNameLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 202: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverNameLookupResult', argCount);
                else return this.primitiveClosureValue(argCount);
            case 203: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStartAddressLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 204: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverAddressLookupResult', argCount);
                else return this.primitiveClosureValue(argCount);
            case 205: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverAbortLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 206: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverLocalAddress', argCount);
                else return  this.primitiveClosureValueWithArgs(argCount);
            case 207: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStatus', argCount);
            case 208: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverError', argCount);
            case 209: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketCreate', argCount);
            case 210: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketDestroy', argCount);
                else return this.popNandPushIfOK(2, this.objectAt(false,false,false)); // contextAt:
            case 211: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketConnectionStatus', argCount);
                else return this.popNandPushIfOK(3, this.objectAtPut(false,false,false)); // contextAt:put:
            case 212: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketError', argCount);
            case 213: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketLocalAddress', argCount);
            case 214: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketLocalPort', argCount);
            case 215: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketRemoteAddress', argCount);
            case 216: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketRemotePort', argCount);
            case 217: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketConnectToPort', argCount);
            case 218: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketListenOnPort', argCount);
            case 219: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketCloseConnection', argCount);
            case 220: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketAbortConnection', argCount);
            case 221: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketReceiveDataBufCount', argCount);
                else return this.primitiveClosureValueNoContextSwitch(argCount);
            case 222: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketReceiveDataAvailable', argCount);
                else return this.primitiveClosureValueNoContextSwitch(argCount);
            case 223: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketSendDataBufCount', argCount);
            case 224: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketSendDone', argCount);
            // 225-229: unused
            // Other Primitives (230-249)
            case 230: return this.primitiveRelinquishProcessorForMicroseconds(argCount);
            case 231: return this.primitiveForceDisplayUpdate(argCount);
            // case 232:  return this.primitiveFormPrint(argCount);
            case 233: return this.primitiveSetFullScreen(argCount);
            case 234: return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveDecompressFromByteArray', argCount);
            case 235: return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveCompareString', argCount);
            case 236: return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveConvert8BitSigned', argCount);
            case 237: return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveCompressToByteArray', argCount);
            case 238: return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortOpen', argCount);
            case 239: return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortClose', argCount);
            case 240: return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortWrite', argCount);
            case 241: return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortRead', argCount);
            // 242: unused
            case 243: return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveTranslateStringWithTable', argCount);
            case 244: return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveFindFirstInString' , argCount);
            case 245: return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveIndexOfAsciiInString', argCount);
            case 246: return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveFindSubstring', argCount);
            // 247, 248: unused
            case 249: return this.primitiveArrayBecome(argCount, false); // one way, opt. copy hash
            case 254: return this.primitiveVMParameter(argCount);
    	} else switch (index) { // Chrome only optimized up to 128 cases
            //MIDI Primitives (520-539)
            case 521: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIClosePort', argCount);
            case 522: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetClock', argCount);
            case 523: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortCount', argCount);
            case 524: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortDirectionality', argCount);
            case 525: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortName', argCount);
            case 526: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIOpenPort', argCount);
            case 527: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIParameterGetOrSet', argCount);
            case 528: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIRead', argCount);
            case 529: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIWrite', argCount);
            // 530-539: reserved for extended MIDI primitives     
            // Sound Codec Primitives
            case 550: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveDecodeMono', argCount);
            case 551: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveDecodeStereo', argCount);
            case 552: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveEncodeMono', argCount);
            case 553: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveEncodeStereo', argCount);
            // External primitive support primitives (570-574)
            // case 570: return this.primitiveFlushExternalPrimitives(argCount);
            case 571: return this.primitiveUnloadModule(argCount);
            case 572: return this.primitiveListBuiltinModule(argCount);
            case 573: return this.primitiveListLoadedModule(argCount);
        }
        console.error("primitive " + index + " not implemented yet");
        return false;
    },
    namedPrimitive: function(modName, functionName, argCount) {
        var mod = modName === "" ? this : this.loadedModules[modName];
        if (mod === undefined) { // null if earlier load failed
            mod = this.loadModule(modName);
            this.loadedModules[modName] = mod;
        }
        var result = false;
        if (mod) {
            this.interpreterProxy.argCount = argCount;
            var primitive = mod[functionName];
            if (typeof primitive === "function") {
                result = mod[functionName](argCount);
            } else if (typeof primitive === "string") {
                // allow late binding for built-ins
                result = this[primitive](argCount);
            } else {
                this.vm.warnOnce("missing primitive: " + modName + "." + functionName);
            }
        } else {
            this.vm.warnOnce("missing module: " + modName + " (" + functionName + ")");
        }
        if (result === true || result === false) return result;
        return this.success;
    },
    doNamedPrimitive: function(primMethod, argCount) {
        if (primMethod.pointersSize() < 2) return false;
        var firstLiteral = primMethod.pointers[1]; // skip method header
        if (firstLiteral.pointersSize() !== 4) return false;
        var moduleName = firstLiteral.pointers[0].bytesAsString();
        var functionName = firstLiteral.pointers[1].bytesAsString();
        return this.namedPrimitive(moduleName, functionName, argCount);
    },
    fakePrimitive: function(prim, retVal, argCount) {
        // fake a named primitive
        // prim and retVal need to be curried when used:
        //  this.fakePrimitive.bind(this, "Module.primitive", 42)
        this.vm.warnOnce("faking primitive: " + prim);
        if (retVal === undefined) this.vm.popN(argCount);
        else this.vm.popNandPush(argCount+1, this.makeStObject(retVal));
        return true;
    },
},
'modules', {
    loadModule: function(modName) {
        var mod = Squeak.externalModules[modName] || this.builtinModules[modName];
        if (!mod) return null;
        if (this.patchModules[modName])
            this.patchModule(mod, modName);
        if (mod.setInterpreter) {
            if (!mod.setInterpreter(this.interpreterProxy)) {
                console.log("Wrong interpreter proxy version: " + modName);
                return null;
            }
        }
        var success = true,
            initFunc = mod.initialiseModule;
        if (typeof initFunc === 'function') {
            success = mod.initialiseModule();
        } else if (typeof initFunc === 'string') {
            // allow late binding for built-ins
            success = this[initFunc]();
        }
        if (!success) {
            console.log("Module initialization failed: " + modName);
            return null;
        }
        console.log("Loaded module: " + modName);
        return mod;
    },
    patchModule: function(mod, modName) {
        var patch = this.patchModules[modName];
        for (var key in patch)
            mod[key] = patch[key];
    },
    unloadModule: function(modName) {
        var mod = this.loadedModules[modName];
        if (!modName || !mod|| mod === this) return null;
        delete this.loadedModules[modName];
        var unloadFunc = mod.unloadModule;
        if (typeof unloadFunc === 'function') {
            mod.unloadModule(this);
        } else if (typeof unloadFunc === 'string') {
            // allow late binding for built-ins
            this[unloadFunc](this);
        }
        console.log("Unloaded module: " + modName);
        return mod;
    },
    primitiveUnloadModule: function(argCount) {
        var	moduleName = this.stackNonInteger(0).bytesAsString();
        if (!moduleName) return false;
        this.unloadModule(moduleName);
    	return this.popNIfOK(argCount);
	},
    primitiveListBuiltinModule: function(argCount) {
        var	index = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var moduleNames = Object.keys(this.builtinModules);
    	return this.popNandPushIfOK(argCount, this.makeStObject(moduleNames[index]));
    },
    primitiveListLoadedModule: function(argCount) {
        var	index = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var moduleNames = [];
        for (var key in this.loadedModules) {
            var module = this.loadedModules[key];
            if (module) {
                var moduleName = module.getModuleName ? module.getModuleName() : key;
                moduleNames.push(moduleName);
            }
        }
    	return this.popNandPushIfOK(argCount, this.makeStObject(moduleNames[index]));
    },
},
'stack access', {
    popNIfOK: function(nToPop) {
        if (!this.success) return false;
        this.vm.popN(nToPop);
        return true;
    },
    pop2andPushBoolIfOK: function(bool) {
        this.vm.success = this.success;
        return this.vm.pop2AndPushBoolResult(bool);
    },
    popNandPushIfOK: function(nToPop, returnValue) {
        if (!this.success || returnValue == null) return false;
        this.vm.popNandPush(nToPop, returnValue);
        return true;
    },
    popNandPushIntIfOK: function(nToPop, returnValue) {
        if (!this.success || !this.vm.canBeSmallInt(returnValue)) return false; 
        return this.popNandPushIfOK(nToPop, returnValue);
    },
    popNandPushFloatIfOK: function(nToPop, returnValue) {
        if (!this.success) return false;
        return this.popNandPushIfOK(nToPop, this.makeFloat(returnValue));
    },
    stackNonInteger: function(nDeep) {
        return this.checkNonInteger(this.vm.stackValue(nDeep));
    },
    stackInteger: function(nDeep) {
        return this.checkSmallInt(this.vm.stackValue(nDeep));
    },
    stackPos32BitInt: function(nDeep) {
        return this.positive32BitValueOf(this.vm.stackValue(nDeep));
    },
    pos32BitIntFor: function(signed32) {
        // Return the 32-bit quantity as an unsigned 32-bit integer
        if (signed32 >= 0 && signed32 <= Squeak.MaxSmallInt) return signed32;
        var lgIntClass = this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger],
            lgIntObj = this.vm.instantiateClass(lgIntClass, 4),
            bytes = lgIntObj.bytes;
        for (var i=0; i<4; i++)
            bytes[i] = (signed32>>>(8*i)) & 255;
        return lgIntObj;
    },
    stackSigned32BitInt: function(nDeep) {
        var stackVal = this.vm.stackValue(nDeep);
        if (typeof stackVal === "number") {   // SmallInteger
            return stackVal;
        }
        if (stackVal.bytesSize() !== 4) {
            this.success = false;
            return 0;
        }
        var bytes = stackVal.bytes,
            value = 0;
        for (var i=0; i<4; i++)
            value += (bytes[i]&255) * (1 << 8*i);
        if (this.isA(stackVal, Squeak.splOb_ClassLargePositiveInteger)) 
            return value;
        if (this.isA(stackVal, Squeak.splOb_ClassLargeNegativeInteger)) 
            return -value;
        this.success = false;
        return 0;
    },
    signed32BitIntegerFor: function(signed32) {
        // Return the 32-bit quantity as a signed 32-bit integer
        if (signed32 >= Squeak.MinSmallInt && signed32 <= Squeak.MaxSmallInt) return signed32;
        var negative = signed32 < 0,
            unsigned = negative ? -signed32 : signed32,
            lgIntClass = negative ? Squeak.splOb_ClassLargeNegativeInteger : Squeak.splOb_ClassLargePositiveInteger,
            lgIntObj = this.vm.instantiateClass(this.vm.specialObjects[lgIntClass], 4),
            bytes = lgIntObj.bytes;
        for (var i=0; i<4; i++)
            bytes[i] = (unsigned>>>(8*i)) & 255;
        return lgIntObj;
    },
    stackFloat: function(nDeep) {
        return this.checkFloat(this.vm.stackValue(nDeep));
    },
    stackBoolean: function(nDeep) {
        return this.checkBoolean(this.vm.stackValue(nDeep));
    },
},
'numbers', {
    doBitAnd: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr & arg);
    },
    doBitOr: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr | arg);
    },
    doBitXor: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr ^ arg);
    },
    doBitShift: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackInteger(0);
        if (!this.success) return 0;
        var result = this.vm.safeShift(rcvr, arg); // returns negative result if failed
        if (result > 0)
            return this.pos32BitIntFor(this.vm.safeShift(rcvr, arg));
        this.success = false;
        return 0;
    },
    safeFDiv: function(dividend, divisor) {
        if (divisor === 0.0) {
            this.success = false;
            return 1.0;
        }
        return dividend / divisor;
    },
    floatAsSmallInt: function(float) {
        var truncated = float >= 0 ? Math.floor(float) : Math.ceil(float);
        return this.ensureSmallInt(truncated);
    },
    frexp_exponent: function(value) {
        // frexp separates a float into its mantissa and exponent
        if (value == 0.0) return 0;     // zero is special
        var data = new DataView(new ArrayBuffer(8));
        data.setFloat64(0, value);      // for accessing IEEE-754 exponent bits
        var bits = (data.getUint32(0) >>> 20) & 0x7FF;
        if (bits === 0) { // we have a subnormal float (actual zero was handled above)
            // make it normal by multiplying a large number
            data.setFloat64(0, value * Math.pow(2, 64));
            // access its exponent bits, and subtract the large number's exponent
            bits = ((data.getUint32(0) >>> 20) & 0x7FF) - 64;
        }
        var exponent = bits - 1022;                 // apply bias
        // mantissa = this.ldexp(value, -exponent)  // not needed for Squeak
        return exponent;
    },
    ldexp: function(mantissa, exponent) {
        // construct a float from mantissa and exponent
        return exponent > 1023 // avoid multiplying by infinity
            ? mantissa * Math.pow(2, 1023) * Math.pow(2, exponent - 1023)
            : exponent < -1074 // avoid multiplying by zero
            ? mantissa * Math.pow(2, -1074) * Math.pow(2, exponent + 1074)
            : mantissa * Math.pow(2, exponent);
    },
},
'utils', {
    floatOrInt: function(obj) {
        if (obj.isFloat) return obj.float;
        if (typeof obj === "number") return obj;  // SmallInteger
        return 0;
    },
    positive32BitValueOf: function(obj) {
        if (typeof obj === "number") { // SmallInteger
            if (obj >= 0)
                return obj;
            this.success = false;
            return 0;
        }
        if (!this.isA(obj, Squeak.splOb_ClassLargePositiveInteger) || obj.bytesSize() !== 4) {
            this.success = false;
            return 0;
        }
        var bytes = obj.bytes;
        var value = 0;
        for (var i=0; i<4; i++)
            value += (bytes[i]&255) * (1 << 8*i);
        return value;
    },
    checkFloat: function(maybeFloat) { // returns a number and sets success
        if (maybeFloat.isFloat)
            return maybeFloat.float;
        if (typeof maybeFloat === "number")  // SmallInteger
            return maybeFloat;
        this.success = false;
        return 0.0;
    },
    checkSmallInt: function(maybeSmall) { // returns an int and sets success
        if (typeof maybeSmall === "number")
            return maybeSmall;
        this.success = false;
        return 0;
    },
    checkNonInteger: function(obj) { // returns a SqObj and sets success
        if (typeof obj !== "number")
            return obj;
        this.success = false;
        return this.vm.nilObj;
    },
    checkBoolean: function(obj) { // returns true/false and sets success
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        return this.success = false;
    },
    indexableSize: function(obj) {
        if (typeof obj === "number") return -1; // -1 means not indexable
        var fmt = obj.format;
        if (fmt<2) return -1; //not indexable
        if (fmt===3 && this.vm.isContext(obj))
            return obj.pointers[Squeak.Context_stackPointer]; // no access beyond top of stack
        if (fmt<6) return obj.pointersSize() - obj.instSize(); // pointers
        if (fmt<8) return obj.wordsSize(); // words
        if (fmt<12) return obj.bytesSize(); // bytes
        return obj.bytesSize() + (4 * obj.pointersSize()); // methods
    },
    isA: function(obj, knownClass) {
        return obj.sqClass === this.vm.specialObjects[knownClass];
    },
    isKindOf: function(obj, knownClass) {
        var classOrSuper = obj.sqClass;
        var theClass = this.vm.specialObjects[knownClass];
        while (!classOrSuper.isNil) {
            if (classOrSuper === theClass) return true;
            classOrSuper = classOrSuper.pointers[Squeak.Class_superclass];
        }
        return false;
    },
    ensureSmallInt: function(number) {
        if (number === (number|0) && this.vm.canBeSmallInt(number))
            return number;
        this.success = false;
        return 0;
    },
    charFromInt: function(ascii) {
        var charTable = this.vm.specialObjects[Squeak.splOb_CharacterTable];
        return charTable.pointers[ascii];
    },
    makeFloat: function(value) {
        var floatClass = this.vm.specialObjects[Squeak.splOb_ClassFloat];
        var newFloat = this.vm.instantiateClass(floatClass, 2);
        newFloat.float = value;
        return newFloat;
	},
    makeLargeIfNeeded: function(integer) {
        return this.vm.canBeSmallInt(integer) ? integer : this.makeLargeInt(integer);
    },
    makeLargeInt: function(integer) {
        if (integer < 0) throw Error("negative large ints not implemented yet");
        if (integer > 0xFFFFFFFF) throw Error("large large ints not implemented yet");
        return this.pos32BitIntFor(integer);
    },
    makePointWithXandY: function(x, y) {
        var pointClass = this.vm.specialObjects[Squeak.splOb_ClassPoint];
        var newPoint = this.vm.instantiateClass(pointClass, 0);
        newPoint.pointers[Squeak.Point_x] = x;
        newPoint.pointers[Squeak.Point_y] = y;
        return newPoint;
    },
    makeStArray: function(jsArray) {
        var array = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], jsArray.length);
        for (var i = 0; i < jsArray.length; i++)
            array.pointers[i] = this.makeStObject(jsArray[i]);
        return array;
    },
    makeStString: function(jsString) {
        var bytes = [];
        for (var i = 0; i < jsString.length; ++i)
            bytes.push(jsString.charCodeAt(i) & 0xFF);
        var stString = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassString], bytes.length);
        stString.bytes = bytes;
        return stString;
    },
    makeStObject: function(obj) {
        if (obj === undefined || obj === null) return this.vm.nilObj;
        if (obj === true) return this.vm.trueObj;
        if (obj === false) return this.vm.falseObj;
        if (obj.stClass) return obj;
        if (typeof obj === "string" || obj.constructor === Uint8Array) return this.makeStString(obj);
        if (obj.constructor === Array) return this.makeStArray(obj);
        if (typeof obj === "number")
            if (obj === (obj|0)) return this.makeLargeIfNeeded(obj);
            else return this.makeFloat(obj)
        throw Error("cannot make smalltalk object");
    },
    pointsTo: function(rcvr, arg) {
        if (!rcvr.pointers) return false;
        return rcvr.pointers.indexOf(arg) >= 0;
    },
    asUint8Array: function(buffer) {
        if (buffer.constructor === Uint8Array) return buffer;
        if (buffer.constructor === ArrayBuffer) return new Uint8Array(buffer);
        if (typeof buffer === "string") {
            var array = new Uint8Array(buffer.length);
            for (var i = 0; i < buffer.length; i++)
                array[i] = buffer.charCodeAt(i);
            return array;
        }
        throw Error("unknown buffer type");
    },
    filenameToSqueak: function(unixpath) {
        var slash = unixpath[0] !== "/" ? "/" : "",
            filepath = "/SqueakJS" + slash + unixpath;                      // add SqueakJS
        if (this.emulateMac) 
            filepath = ("Macintosh HD" + filepath)                          // add Mac volume
                .replace(/\//g, "€").replace(/:/g, "/").replace(/€/g, ":"); // substitute : for /
        return filepath;
    },
    filenameFromSqueak: function(filepath) {
        var unixpath = !this.emulateMac ? filepath :
            filepath.replace(/^[^:]*:/, ":")                            // remove volume
            .replace(/\//g, "€").replace(/:/g, "/").replace(/€/g, ":"); // substitute : for /
        unixpath = unixpath.replace(/^\/*SqueakJS\/?/, "/");            // strip SqueakJS
        return unixpath;
    },
},
'indexing', {
    objectAt: function(cameFromBytecode, convertChars, includeInstVars) {
        //Returns result of at: or sets success false
        var array = this.stackNonInteger(1);
        var index = this.stackPos32BitInt(0); //note non-int returns zero
        if (!this.success) return array;
        var info;
        if (cameFromBytecode) {// fast entry checks cache
            info = this.atCache[array.hash & this.atCacheMask];
            if (info.array !== array) {this.success = false; return array;}
        } else {// slow entry installs in cache if appropriate
            if (array.isFloat) { // present float as word array
                var floatData = array.floatData();
                if (index==1) return this.pos32BitIntFor(floatData.getUint32(0, false));
                if (index==2) return this.pos32BitIntFor(floatData.getUint32(4, false));
                this.success = false; return array;
            }
            info = this.makeAtCacheInfo(this.atCache, this.vm.specialSelectors[32], array, convertChars, includeInstVars);
        }
        if (index < 1 || index > info.size) {this.success = false; return array;}
        if (includeInstVars)  //pointers...   instVarAt and objectAt
            return array.pointers[index-1];
        if (array.format<6)   //pointers...   normal at:
            return array.pointers[index-1+info.ivarOffset];
        if (array.format<8) // words...
            return this.pos32BitIntFor(array.words[index-1]);
        if (array.format<12) // bytes...
            if (info.convertChars) return this.charFromInt(array.bytes[index-1] & 0xFF);
            else return array.bytes[index-1] & 0xFF;
        // methods (format>=12) must simulate Squeak's method indexing
        var offset = array.pointersSize() * 4;
        if (index-1-offset < 0) {this.success = false; return array;} //reading lits as bytes
        return array.bytes[index-1-offset] & 0xFF;
    },
    objectAtPut: function(cameFromBytecode, convertChars, includeInstVars) {
        //Returns result of at:put: or sets success false
        var array = this.stackNonInteger(2);
        var index = this.stackPos32BitInt(1); //note non-int returns zero
        if (!this.success) return array;
        var info;
        if (cameFromBytecode) {// fast entry checks cache
            info = this.atPutCache[array.hash & this.atCacheMask];
            if (info.array !== array) {this.success = false; return array;}
        } else {// slow entry installs in cache if appropriate
            if (array.isFloat) { // present float as word array
                var wordToPut = this.stackPos32BitInt(0);
                if (this.success && (index == 1 || index == 2)) {
                    var floatData = array.floatData();
                    floatData.setUint32(index == 1 ? 0 : 4, wordToPut, false);
                    array.float = floatData.getFloat64(0);
                } else this.success = false;
                return this.vm.stackValue(0);
            }
            info = this.makeAtCacheInfo(this.atPutCache, this.vm.specialSelectors[34], array, convertChars, includeInstVars);
        }
        if (index<1 || index>info.size) {this.success = false; return array;}
        var objToPut = this.vm.stackValue(0);
        if (includeInstVars)  // pointers...   instVarAtPut and objectAtPut
            return array.pointers[index-1] = objToPut; //eg, objectAt:
        if (array.format<6)  // pointers...   normal atPut
            return array.pointers[index-1+info.ivarOffset] = objToPut;
        var intToPut;
        if (array.format<8) {  // words...
            intToPut = this.stackPos32BitInt(0);
            if (this.success) array.words[index-1] = intToPut;
            return objToPut;
        }
        // bytes...
        if (convertChars) {
            // put a character...
            if (objToPut.sqClass !== this.vm.specialObjects[Squeak.splOb_ClassCharacter])
                {this.success = false; return objToPut;}
            intToPut = objToPut.pointers[0];
            if (typeof intToPut !== "number") {this.success = false; return objToPut;}
        } else { // put a byte...
            if (typeof objToPut !== "number") {this.success = false; return objToPut;}
            intToPut = objToPut;
        }
        if (intToPut<0 || intToPut>255) {this.success = false; return objToPut;}
        if (array.format<8)  // bytes...
            return array.bytes[index-1] = intToPut;
        // methods (format>=12) must simulate Squeak's method indexing
        var offset = array.pointersSize() * 4;
        if (index-1-offset < 0) {this.success = false; return array;} //writing lits as bytes
        array.bytes[index-1-offset] = intToPut;
        return objToPut;
    },
    objectSize: function(cameFromBytecode) {
        var rcvr = this.vm.stackValue(0),
            size = -1;
        if (cameFromBytecode) {
            // must only handle classes with size == basicSize, fail otherwise
            if (rcvr.sqClass === this.vm.specialObjects[Squeak.splOb_ClassArray]) {
                size = rcvr.pointersSize();
            } else if (rcvr.sqClass === this.vm.specialObjects[Squeak.splOb_ClassString]) {
                size = rcvr.bytesSize();
            }
        } else { // basicSize
            size = this.indexableSize(rcvr);
        }
        if (size === -1) {this.success = false; return -1}; //not indexable
        return this.pos32BitIntFor(size);
    },
    initAtCache: function() {
        // The purpose of the at-cache is to allow fast (bytecode) access to at/atput code
        // without having to check whether this object has overridden at, etc.
        this.atCacheSize = 32; // must be power of 2
        this.atCacheMask = this.atCacheSize - 1; //...so this is a mask
        this.atCache = [];
        this.atPutCache = [];
        this.nonCachedInfo = {};
        for (var i= 0; i < this.atCacheSize; i++) {
            this.atCache.push({});
            this.atPutCache.push({});
        }
    },
    clearAtCache: function() { //clear at-cache pointers (prior to GC)
        this.nonCachedInfo.array = null;
        for (var i= 0; i < this.atCacheSize; i++) {
            this.atCache[i].array = null;
            this.atPutCache[i].array = null;
        }
    },
    makeAtCacheInfo: function(atOrPutCache, atOrPutSelector, array, convertChars, includeInstVars) {
        //Make up an info object and store it in the atCache or the atPutCache.
        //If it's not cacheable (not a non-super send of at: or at:put:)
        //then return the info in nonCachedInfo.
        //Note that info for objectAt (includeInstVars) will have
        //a zero ivarOffset, and a size that includes the extra instVars
        var info;
        var cacheable =
            (this.vm.verifyAtSelector === atOrPutSelector)         //is at or atPut
            && (this.vm.verifyAtClass === array.sqClass)           //not a super send
            && !(array.format === 3 && this.vm.isContext(array));  //not a context (size can change)
        info = cacheable ? atOrPutCache[array.hash & this.atCacheMask] : this.nonCachedInfo;
        info.array = array;
        info.convertChars = convertChars;
        if (includeInstVars) {
            info.size = array.instSize() + Math.max(0, this.indexableSize(array));
            info.ivarOffset = 0;
        } else {
            info.size = this.indexableSize(array);
            info.ivarOffset = (array.format < 6) ? array.instSize() : 0;
        }
        return info;
    },
},
'basic',{
    instantiateClass: function(clsObj, indexableSize) {
        if (indexableSize * 4 > this.vm.image.bytesLeft()) {
            // we're not really out of memory, we have no idea how much memory is available
            // but we need to stop runaway allocations
            console.warn("squeak: out of memory");
            this.success = false;
            return null;
        } else {
            return this.vm.instantiateClass(clsObj, indexableSize);
        }
    },
    someObject: function() {
        return this.vm.image.firstOldObject;
    },
    nextObject: function(obj) {
        return this.vm.image.objectAfter(obj) || 0;
    },
    someInstanceOf: function(clsObj) {
        var someInstance = this.vm.image.someInstanceOf(clsObj);
        if (someInstance) return someInstance;
        this.success = false;
        return 0;
    },
    nextInstanceAfter: function(obj) {
        var nextInstance = this.vm.image.nextInstanceAfter(obj);
        if (nextInstance) return nextInstance;
        this.success = false;
        return 0;
    },
    primitiveFullGC: function(argCount) {
        this.vm.image.fullGC("primitive");
        var bytes = this.vm.image.bytesLeft();
        return this.popNandPushIfOK(1, this.makeLargeIfNeeded(bytes));
    },
    primitiveMakePoint: function(argCount, checkNumbers) {
        var x = this.vm.stackValue(1);
        var y = this.vm.stackValue(0);
        if (checkNumbers) {
            this.checkFloat(x);
            this.checkFloat(y);
            if (!this.success) return false;
        }
        this.vm.popNandPush(1+argCount, this.makePointWithXandY(x, y));
        return true;
    },
    primitiveStoreStackp: function(argCount) {
        var ctxt = this.stackNonInteger(1),
            newStackp = this.stackInteger(0);       
        if (!this.success || newStackp < 0 || this.vm.decodeSqueakSP(newStackp) >= ctxt.pointers.length)
            return false;
        var stackp = ctxt.pointers[Squeak.Context_stackPointer];
        while (stackp < newStackp)
            ctxt.pointers[this.vm.decodeSqueakSP(++stackp)] = this.vm.nilObj;
        ctxt.pointers[Squeak.Context_stackPointer] = newStackp;
        this.vm.popN(argCount);
        return true;
    },
    primitiveChangeClass: function(argCount) {
        if (argCount !== 1) return false;
        var rcvr = this.stackNonInteger(1),
            arg = this.stackNonInteger(0);
        if (!this.success) return false;
        if (rcvr.format !== arg.format ||
            rcvr.sqClass.isCompact !== arg.sqClass.isCompact ||
            rcvr.sqClass.classInstSize() !== arg.sqClass.classInstSize())
                return false;
        rcvr.sqClass = arg.sqClass;
        return this.popNIfOK(1);
    },
    primitiveDoPrimitiveWithArgs: function(argCount) {
        var argumentArray = this.stackNonInteger(0),
            primIdx = this.stackInteger(1);
        if (!this.success) return false;
        var arraySize = argumentArray.pointersSize(),
            cntxSize = this.vm.activeContext.pointersSize();
        if (this.vm.sp + arraySize >= cntxSize) return false;
        // Pop primIndex and argArray, then push args in place...
        this.vm.popN(2);
        for (var i = 0; i < arraySize; i++)
            this.vm.push(argumentArray[i]);
        // Run the primitive
        if (this.doPrimitive(primIdx, arraySize))
            return true;
        // Primitive failed, restore state for failure code
        this.vm.popN(arraySize);
        this.vm.push(primIdx);
        this.vm.push(argumentArray);
        return false;
    },
    primitiveShortAtAndPut: function(argCount) {
        var rcvr = this.stackNonInteger(argCount),
            index = this.stackInteger(argCount-1) - 1, // make zero-based
            array = rcvr.wordsAsInt16Array();
        if (!this.success || !array || index < 0 || index >= array.length)
            return false;
        var value;
        if (argCount < 2) { // shortAt:
            value = array[index];
        } else { // shortAt:put:
            value = this.stackInteger(0);
            if (value < -32768 || value > 32767)
                return false;
            array[index] = value;
        }
        this.popNandPushIfOK(argCount+1, value);
        return true;
    },
    primitiveIntegerAtAndPut:  function(argCount) {
        var rcvr = this.stackNonInteger(argCount),
            index = this.stackInteger(argCount-1) - 1, // make zero-based
            array = rcvr.wordsAsInt32Array();
        if (!this.success || !array || index < 0 || index >= array.length)
            return false;
        var value;
        if (argCount < 2) { // integerAt:
            value = this.signed32BitIntegerFor(array[index]);
        } else { // integerAt:put:
            value = this.stackSigned32BitInt(0);
            if (!this.success)
                return false;
            array[index] = value;
        }
        this.popNandPushIfOK(argCount+1, value);
        return true;
    },
    primitiveConstantFill:  function(argCount) {
        var rcvr = this.stackNonInteger(1),
            value = this.stackPos32BitInt(0);
        if (!this.success || !rcvr.isWordsOrBytes())
            return false;
        var array = rcvr.words || rcvr.bytes;
        if (array) {
            if (array === rcvr.bytes && value > 255)
                return false;
            for (var i = 0; i < array.length; i++)
                array[i] = value;
        }
        this.vm.popN(argCount);
        return true;
    },
    primitiveNewMethod: function(argCount) {
        var header = this.stackInteger(0);
        var bytecodeCount = this.stackInteger(1);
        if (!this.success) return 0;
        var litCount = (header>>9) & 0xFF;
        var method = this.vm.instantiateClass(this.vm.stackValue(2), bytecodeCount);
        method.pointers = [header];
        for (var i = 0; i < litCount; i++)
            method.pointers.push(this.vm.nilObj);
        this.vm.popNandPush(1+argCount, method);
        if (this.vm.breakOnNewMethod)               // break on doit
            this.vm.breakOnMethod = method;
        return true;
    },
    primitiveExecuteMethodArgsArray: function(argCount) {
        // receiver, argsArray, then method are on top of stack.  Execute method with
        // receiver and args.
        var methodObj = this.stackNonInteger(0),
            argsArray = this.stackNonInteger(1),
            receiver = this.vm.stackValue(2);
        // Allow for up to two extra arguments (e.g. for mirror primitives).
        if (!this.success || !this.vm.isMethod(methodObj) || argCount > 4) return false;
        var numArgs = methodObj.methodNumArgs();
        if (numArgs !== argsArray.pointersSize()) return false;
        // drop all args, push receiver, and new arguments
        this.vm.popNandPush(argCount+1, receiver);
        for (var i = 0; i < numArgs; i++) 
            this.vm.push(argsArray.pointers[i]);
        this.vm.executeNewMethod(receiver, methodObj, numArgs, methodObj.methodPrimitiveIndex(), null, null);
        return true;
    },
    primitiveArrayBecome: function(argCount, doBothWays) {
        var rcvr = this.stackNonInteger(argCount),
            arg = this.stackNonInteger(argCount-1),
            copyHash = argCount > 1 ? this.stackBoolean(argCount-2) : true;
        if (!this.success) return false;
        this.success = this.vm.image.bulkBecome(rcvr.pointers, arg.pointers, doBothWays, copyHash);
        return this.popNIfOK(argCount);
    },
    doStringReplace: function() {
        var dst = this.stackNonInteger(4);
        var dstPos = this.stackInteger(3) - 1;
        var count = this.stackInteger(2) - dstPos;
        var src = this.stackNonInteger(1);
        var srcPos = this.stackInteger(0) - 1;
        if (!this.success) return dst; //some integer not right
        var srcFmt = src.format;
        var dstFmt = dst.format;
        if (dstFmt < 8)
            if (dstFmt != srcFmt) {this.success = false; return dst;} //incompatible formats
        else
            if ((dstFmt&0xC) != (srcFmt&0xC)) {this.success = false; return dst;} //incompatible formats
        if (srcFmt<4) {//pointer type objects
            var totalLength = src.pointersSize();
            var srcInstSize = src.instSize();
            srcPos += srcInstSize;
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.pointersSize();
            var dstInstSize= dst.instSize();
            dstPos += dstInstSize;
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success= false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.pointers[dstPos + i] = src.pointers[srcPos + i];
            return dst;
        } else if (srcFmt < 8) { //words type objects
            var totalLength = src.wordsSize();
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.wordsSize();
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.words[dstPos + i] = src.words[srcPos + i];
            return dst;
        } else { //bytes type objects
            var totalLength = src.bytesSize();
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.bytesSize();
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.bytes[dstPos + i] = src.bytes[srcPos + i];
            return dst;
        }
    },
    primitiveCopyObject: function(argCount) {
        var rcvr = this.stackNonInteger(1),
            arg = this.stackNonInteger(0),
            length = rcvr.pointersSize();
        if (!this.success ||
            rcvr.isWordsOrBytes() ||
            rcvr.sqClass !== arg.sqClass ||
            length !== arg.pointersSize()) return false;
        for (var i = 0; i < length; i++)
            arg.pointers[i] = rcvr.pointers[i];
        this.vm.pop(argCount);
        return true;
    },
},
'blocks/closures', {
    doBlockCopy: function() {
        var rcvr = this.vm.stackValue(1);
        var sqArgCount = this.stackInteger(0);
        var homeCtxt = rcvr;
        if(!this.vm.isContext(homeCtxt)) this.success = false;
        if(!this.success) return rcvr;
        if (typeof homeCtxt.pointers[Squeak.Context_method] === "number")
            // ctxt is itself a block; get the context for its enclosing method
            homeCtxt = homeCtxt.pointers[Squeak.BlockContext_home];
        var blockSize = homeCtxt.pointersSize() - homeCtxt.instSize(); // could use a const for instSize
        var newBlock = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassBlockContext], blockSize);
        var initialPC = this.vm.encodeSqueakPC(this.vm.pc + 2, this.vm.method); //*** check this...
        newBlock.pointers[Squeak.BlockContext_initialIP] = initialPC;
        newBlock.pointers[Squeak.Context_instructionPointer] = initialPC; // claim not needed; value will set it
        newBlock.pointers[Squeak.Context_stackPointer] = 0;
        newBlock.pointers[Squeak.BlockContext_argumentCount] = sqArgCount;
        newBlock.pointers[Squeak.BlockContext_home] = homeCtxt;
        newBlock.pointers[Squeak.Context_sender] = this.vm.nilObj; // claim not needed; just initialized
        return newBlock;
    },
    primitiveBlockValue: function(argCount) {
        var rcvr = this.vm.stackValue(argCount);
        if (!this.isA(rcvr, Squeak.splOb_ClassBlockContext)) return false;
        var block = rcvr;
        var blockArgCount = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof blockArgCount !== "number") return false;
        if (blockArgCount != argCount) return false;
        if (!block.pointers[Squeak.BlockContext_caller].isNil) return false;
        this.vm.arrayCopy(this.vm.activeContext.pointers, this.vm.sp-argCount+1, block.pointers, Squeak.Context_tempFrameStart, argCount);
        var initialIP = block.pointers[Squeak.BlockContext_initialIP];
        block.pointers[Squeak.Context_instructionPointer] = initialIP;
        block.pointers[Squeak.Context_stackPointer] = argCount;
        block.pointers[Squeak.BlockContext_caller] = this.vm.activeContext;
        this.vm.popN(argCount+1);
        this.vm.newActiveContext(block);
        return true;
    },
    primitiveBlockValueWithArgs: function(argCount) {
        var block = this.vm.stackValue(1);
        var array = this.vm.stackValue(0);
        if (!this.isA(block, Squeak.splOb_ClassBlockContext)) return false;
        if (!this.isA(array, Squeak.splOb_ClassArray)) return false;
        var blockArgCount = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof blockArgCount !== "number") return false;
        if (blockArgCount != array.pointersSize()) return false;
        if (!block.pointers[Squeak.BlockContext_caller].isNil) return false;
        this.vm.arrayCopy(array.pointers, 0, block.pointers, Squeak.Context_tempFrameStart, blockArgCount);
        var initialIP = block.pointers[Squeak.BlockContext_initialIP];
        block.pointers[Squeak.Context_instructionPointer] = initialIP;
        block.pointers[Squeak.Context_stackPointer] = blockArgCount;
        block.pointers[Squeak.BlockContext_caller] = this.vm.activeContext;
        this.vm.popN(argCount+1);
        this.vm.newActiveContext(block);
        return true;
    },
    primitiveClosureCopyWithCopiedValues: function(argCount) {
        this.vm.breakNow("primitiveClosureCopyWithCopiedValues");
        debugger;
        return false;
    },
    primitiveClosureValue: function(argCount) {
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        return this.activateNewClosureMethod(blockClosure, argCount);
	},
    primitiveClosureValueWithArgs: function(argCount) {
        var array = this.vm.top(),
            arraySize = array.pointersSize(),
            blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (arraySize !== blockArgCount) return false;
        this.vm.pop();
        for (var i = 0; i < arraySize; i++)
            this.vm.push(array.pointers[i]);
        return this.activateNewClosureMethod(blockClosure, arraySize);
	},
    primitiveClosureValueNoContextSwitch: function(argCount) {
        return this.primitiveClosureValue(argCount);
    },
    activateNewClosureMethod: function(blockClosure, argCount) {
        var outerContext = blockClosure.pointers[Squeak.Closure_outerContext],
            method = outerContext.pointers[Squeak.Context_method],
            newContext = this.vm.allocateOrRecycleContext(method.methodNeedsLargeFrame()),
            numCopied = blockClosure.pointers.length - Squeak.Closure_firstCopiedValue;
        newContext.pointers[Squeak.Context_sender] = this.vm.activeContext;
        newContext.pointers[Squeak.Context_instructionPointer] = blockClosure.pointers[Squeak.Closure_startpc];
        newContext.pointers[Squeak.Context_stackPointer] = argCount + numCopied;
        newContext.pointers[Squeak.Context_method] = outerContext.pointers[Squeak.Context_method];
        newContext.pointers[Squeak.Context_closure] = blockClosure;
        newContext.pointers[Squeak.Context_receiver] = outerContext.pointers[Squeak.Context_receiver];
        // Copy the arguments and copied values ...
        var where = Squeak.Context_tempFrameStart;
        for (var i = 0; i < argCount; i++)
            newContext.pointers[where++] = this.vm.stackValue(argCount - i - 1);
        for (var i = 0; i < numCopied; i++)
            newContext.pointers[where++] = blockClosure.pointers[Squeak.Closure_firstCopiedValue + i];
        // The initial instructions in the block nil-out remaining temps.
        this.vm.popN(argCount + 1);
        this.vm.newActiveContext(newContext);
        return true;
	},
},
'scheduling',
{
    primitiveResume: function() {
        this.resume(this.vm.top());
        return true;
	},
    primitiveSuspend: function() {
        var activeProc = this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
        if (this.vm.top() !== activeProc) return false;
        this.vm.popNandPush(1, this.vm.nilObj);
        this.transferTo(this.pickTopProcess());
        return true;
    },
    getScheduler: function() {
        var assn = this.vm.specialObjects[Squeak.splOb_SchedulerAssociation];
        return assn.pointers[Squeak.Assn_value];
    },
    resume: function(newProc) {
        var activeProc = this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
        var activePriority = activeProc.pointers[Squeak.Proc_priority];
        var newPriority = newProc.pointers[Squeak.Proc_priority];
        if (newPriority > activePriority) {
            this.putToSleep(activeProc);
            this.transferTo(newProc);
        } else {
            this.putToSleep(newProc);
        }
    },
    putToSleep: function(aProcess) {
        //Save the given process on the scheduler process list for its priority.
        var priority = aProcess.pointers[Squeak.Proc_priority];
        var processLists = this.getScheduler().pointers[Squeak.ProcSched_processLists];
        var processList = processLists.pointers[priority - 1];
        this.linkProcessToList(aProcess, processList);
    },
    transferTo: function(newProc) {
        //Record a process to be awakened on the next interpreter cycle.
        var sched = this.getScheduler();
        var oldProc = sched.pointers[Squeak.ProcSched_activeProcess];
        sched.pointers[Squeak.ProcSched_activeProcess] = newProc;
        oldProc.pointers[Squeak.Proc_suspendedContext] = this.vm.activeContext;
        this.vm.newActiveContext(newProc.pointers[Squeak.Proc_suspendedContext]);
        newProc.pointers[Squeak.Proc_suspendedContext] = this.vm.nilObj;
        this.vm.reclaimableContextCount = 0;
        if (this.vm.breakOnContextChanged) {
            this.vm.breakOnContextChanged = false;
            this.vm.breakNow();
        }
    },
    pickTopProcess: function() { // aka wakeHighestPriority
        //Return the highest priority process that is ready to run.
        //Note: It is a fatal VM error if there is no runnable process.
        var schedLists = this.getScheduler().pointers[Squeak.ProcSched_processLists];
        var p = schedLists.pointersSize() - 1;  // index of last indexable field
        var processList;
        do {
            if (p < 0) throw Error("scheduler could not find a runnable process");
            processList = schedLists.pointers[p--];
        } while (this.isEmptyList(processList));
        return this.removeFirstLinkOfList(processList);
	},    
    linkProcessToList: function(proc, aList) {
        // Add the given process to the given linked list and set the backpointer
        // of process to its new list.
        if (this.isEmptyList(aList))
            aList.pointers[Squeak.LinkedList_firstLink] = proc;
        else {
            var lastLink = aList.pointers[Squeak.LinkedList_lastLink];
            lastLink.pointers[Squeak.Link_nextLink] = proc;
        }
        aList.pointers[Squeak.LinkedList_lastLink] = proc;
        proc.pointers[Squeak.Proc_myList] = aList;
    },
    isEmptyList: function(aLinkedList) {
        return aLinkedList.pointers[Squeak.LinkedList_firstLink].isNil;
    },
    removeFirstLinkOfList: function(aList) {
        //Remove the first process from the given linked list.
        var first = aList.pointers[Squeak.LinkedList_firstLink];
        var last = aList.pointers[Squeak.LinkedList_lastLink];
        if (first === last) {
            aList.pointers[Squeak.LinkedList_firstLink] = this.vm.nilObj;
            aList.pointers[Squeak.LinkedList_lastLink] = this.vm.nilObj;
        } else {
            var next = first.pointers[Squeak.Link_nextLink];
            aList.pointers[Squeak.LinkedList_firstLink] = next;
        }
        first.pointers[Squeak.Link_nextLink] = this.vm.nilObj;
        return first;
    },
    registerSemaphore: function(specialObjIndex) {
        var sema = this.vm.top();
        if (this.isA(sema, Squeak.splOb_ClassSemaphore))
            this.vm.specialObjects[specialObjIndex] = sema;
        else
            this.vm.specialObjects[specialObjIndex] = this.vm.nilObj;
        return this.vm.stackValue(1);
    },
    primitiveWait: function() {
    	var sema = this.vm.top();
        if (!this.isA(sema, Squeak.splOb_ClassSemaphore)) return false;
        var excessSignals = sema.pointers[Squeak.Semaphore_excessSignals];
        if (excessSignals > 0)
            sema.pointers[Squeak.Semaphore_excessSignals] = excessSignals - 1;
        else {
            var activeProc = this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
            this.linkProcessToList(activeProc, sema);
            this.transferTo(this.pickTopProcess());
        }
        return true;
    },
    primitiveSignal: function() {
	    var sema = this.vm.top();
        if (!this.isA(sema, Squeak.splOb_ClassSemaphore)) return false;
        this.synchronousSignal(sema);
        return true;
    },
    synchronousSignal: function(sema) {
    	if (this.isEmptyList(sema)) {
            // no process is waiting on this semaphore
            sema.pointers[Squeak.Semaphore_excessSignals]++;
        } else
            this.resume(this.removeFirstLinkOfList(sema));
        return;
    },
    primitiveSignalAtMilliseconds: function(argCount) { //Delay signal:atMs:
        var msTime = this.stackInteger(0);
        var sema = this.stackNonInteger(1);
        var rcvr = this.stackNonInteger(2);
        if (!this.success) return false;
        if (this.isA(sema, Squeak.splOb_ClassSemaphore)) {
            this.vm.specialObjects[Squeak.splOb_TheTimerSemaphore] = sema;
            this.vm.nextWakeupTick = msTime;
        } else {
            this.vm.specialObjects[Squeak.splOb_TheTimerSemaphore] = this.vm.nilObj;
            this.vm.nextWakeupTick = 0;
        }
        this.vm.popN(argCount); // return self
        return true;
	},
	signalSemaphoreWithIndex: function(semaIndex) {
	    // asynch signal: will actually be signaled in checkForInterrupts()
    	this.semaphoresToSignal.push(semaIndex);
	},
    signalExternalSemaphores: function() {
        var semaphores = this.vm.specialObjects[Squeak.splOb_ExternalObjectsArray].pointers,
            semaClass = this.vm.specialObjects[Squeak.splOb_ClassSemaphore];
        while (this.semaphoresToSignal.length) {
            var semaIndex = this.semaphoresToSignal.shift(),
                sema = semaphores[semaIndex - 1];
            if (sema.sqClass == semaClass)
                this.synchronousSignal(sema);
        }
    },
},
'vm functions', {
    primitiveGetAttribute: function(argCount) {
        var attr = this.stackInteger(0);
        if (!this.success) return false;
        var value;
        switch (attr) {
            case 0: value = this.filenameToSqueak(Squeak.vmPath + Squeak.vmFile); break;
            case 1: value = null; break; // 1.x images want document here
            case 2: value = null; break; // later images want document here
            case 1001: value = Squeak.platformName; break;
            case 1002: value = Squeak.osVersion; break;
            case 1003: value = Squeak.platformSubtype; break;
            case 1004: value = Squeak.vmVersion; break;
            case 1005: value = Squeak.windowSystem; break;
            case 1006: value = Squeak.vmBuild; break;
            default: return false;
        }
        this.vm.popNandPush(argCount+1, this.makeStObject(value));
        return true;
	},
    setLowSpaceThreshold: function() {
        var nBytes = this.stackInteger(0);
        if (this.success) this.vm.lowSpaceThreshold = nBytes;
        return this.vm.stackValue(1);
    },
    primitiveVMParameter: function(argCount) {
        /* Behaviour depends on argument count:
		0 args:	return an Array of VM parameter values;
		1 arg:	return the indicated VM parameter;
		2 args:	set the VM indicated parameter. */
		var paramsArraySize = 41;
		switch (argCount) {
            case 0:
                var arrayObj = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], paramsArraySize);
                for (var i = 0; i < paramsArraySize; i++)
                    arrayObj.pointers[i] = this.makeStObject(this.vmParameterAt(i+1));
                return this.popNandPushIfOK(1, arrayObj);
            case 1:
                var parm = this.stackInteger(0);
                return this.popNandPushIfOK(2, this.makeStObject(this.vmParameterAt(parm)));
            case 2:
                return this.popNandPushIfOK(3, 0);
		};
		return false;
    },
    vmParameterAt: function(index) {
        switch (index) {
            case 1: return this.vm.image.oldSpaceBytes;     // end of old-space (0-based, read-only)
            case 2: return this.vm.image.oldSpaceBytes;     // end of young-space (read-only)
            case 3: return this.vm.image.totalMemory;       // end of memory (read-only)
            case 4: return this.vm.image.allocationCount + this.vm.image.newSpaceCount; // allocationCount (read-only; nil in Cog VMs)
            // 5    allocations between GCs (read-write; nil in Cog VMs)
            // 6    survivor count tenuring threshold (read-write)
            case 7: return this.vm.image.gcCount;           // full GCs since startup (read-only)
            case 8: return this.vm.image.gcMilliseconds;    // total milliseconds in full GCs since startup (read-only)
            case 9: return 1;   /* image expects > 0 */     // incremental GCs since startup (read-only)
            case 10: return 0;                              // total milliseconds in incremental GCs since startup (read-only)
            case 11: return this.vm.image.gcTenured;        // tenures of surving objects since startup (read-only)
            // 12-20 specific to the translating VM
            // 21	root table size (read-only)
            // 22	root table overflows since startup (read-only)
            // 23	bytes of extra memory to reserve for VM buffers, plugins, etc.
            // 24	memory threshold above which to shrink object memory (read-write)
            // 25	memory headroom when growing object memory (read-write)
            // 26	interruptChecksEveryNms - force an ioProcessEvents every N milliseconds (read-write)
            // 27	number of times mark loop iterated for current IGC/FGC (read-only) includes ALL marking
            // 28	number of times sweep loop iterated for current IGC/FGC (read-only)
            // 29	number of times make forward loop iterated for current IGC/FGC (read-only)
            // 30	number of times compact move loop iterated for current IGC/FGC (read-only)
            // 31	number of grow memory requests (read-only)
            // 32	number of shrink memory requests (read-only)
            // 33	number of root table entries used for current IGC/FGC (read-only)
            // 34	number of allocations done before current IGC/FGC (read-only)
            // 35	number of survivor objects after current IGC/FGC (read-only)
            // 36	millisecond clock when current IGC/FGC completed (read-only)
            // 37	number of marked objects for Roots of the world, not including Root Table entries for current IGC/FGC (read-only)
            // 38	milliseconds taken by current IGC (read-only)
            // 39	Number of finalization signals for Weak Objects pending when current IGC/FGC completed (read-only)
            case 40: return 4; // BytesPerWord for this image
            case 41: return this.vm.image.formatVersion();
        }
        return null;
    },
    primitiveImageName: function(argCount) {
        if (argCount == 0)
            return this.popNandPushIfOK(1, this.makeStString(this.filenameToSqueak(this.vm.image.name)));
        this.vm.image.name = this.filenameFromSqueak(this.vm.top().bytesAsString());
        window.localStorage['squeakImageName'] = this.vm.image.name;
        return true;
    },
    primitiveSnapshot: function(argCount) {
        this.vm.popNandPush(1, this.vm.trueObj);        // put true on stack for saved snapshot
        this.vm.storeContextRegisters();                // store current state for snapshot
        var proc = this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
        proc.pointers[Squeak.Proc_suspendedContext] = this.vm.activeContext; // store initial context
        this.vm.image.fullGC("snapshot");               // before cleanup so traversal works
        var buffer = this.vm.image.writeToBuffer();
        Squeak.flushAllFiles();                         // so there are no more writes pending
        Squeak.filePut(this.vm.image.name, buffer);
        this.vm.popNandPush(1, this.vm.falseObj);       // put false on stack for continuing
        return true;
    },
    primitiveQuit: function(argCount) {
        Squeak.flushAllFiles();
        this.display.quitFlag = true;
        this.vm.breakNow("quit"); 
        return true;
    },
    primitiveExitToDebugger: function(argCount) {
        this.vm.breakNow("debugger primitive");
        debugger;
        return true;
    },
},
'display', {
    primitiveBeCursor: function(argCount) {
        this.vm.popN(argCount); // return self
        return true;
    },
    primitiveBeDisplay: function(argCount) {
        var displayObj = this.vm.stackValue(0);
        this.vm.specialObjects[Squeak.splOb_TheDisplay] = displayObj;
        this.vm.popN(argCount); // return self
        return true;
	},
    primitiveReverseDisplay: function(argCount) {
        this.reverseDisplay = !this.reverseDisplay;
        this.redrawDisplay();
        return true;
    },
    primitiveShowDisplayRect: function(argCount) {
        // Force the given rectangular section of the Display to be copied to the screen.
        var rect = {
            left: this.stackInteger(3),
            right: this.stackInteger(2),
            top: this.stackInteger(1),
            bottom: this.stackInteger(0),
        };
        if (!this.success) return false;
        this.redrawDisplay(rect);
        this.vm.popN(argCount);
        return true;
    },
    redrawDisplay: function(rect) {
        var theDisplay = this.theDisplay(),
            bounds = {left: 0, top: 0, right: theDisplay.width, bottom: theDisplay.height};
        if (rect) {
            if (rect.left > bounds.left) bounds.left = rect.left;
            if (rect.right < bounds.right) bounds.right = rect.right;
            if (rect.top > bounds.top) bounds.top = rect.top;
            if (rect.bottom < bounds.bottom) bounds.bottom = rect.bottom;
        }
        if (bounds.left < bounds.right && bounds.top < bounds.bottom)
            this.displayUpdate(theDisplay, bounds);
    },
    showForm: function(ctx, form, rect) {
        if (!rect) return;
        var srcX = rect.left,
            srcY = rect.top,
            srcW = rect.right - srcX,
            srcH = rect.bottom - srcY,
            pixels = ctx.createImageData(srcW, srcH),
            pixelData = pixels.data;
        if (!pixelData.buffer) { // mobile IE uses a different data-structure
            pixelData = new Uint8Array(srcW * srcH * 4);
        }
        var dest = new Uint32Array(pixelData.buffer);
        switch (form.depth) {
            case 1:
            case 2:
            case 4:
            case 8:
                var colors = this.swappedColors;
                if (!colors) {
                    colors = [];
                    for (var i = 0; i < 256; i++) {
                        var argb = this.indexedColors[i],
                            abgr = (argb & 0xFF00FF00)     // green and alpha
                            + ((argb & 0x00FF0000) >> 16)  // shift red down
                            + ((argb & 0x000000FF) << 16); // shift blue up
                        colors[i] = abgr;
                    }
                    this.swappedColors = colors;
                }
                if (this.reverseDisplay) {
                    if (!this.reversedColors)
                        this.reversedColors = colors.map(function(c){return c ^ 0x00FFFFFF});
                    colors = this.reversedColors;
                }
                var mask = (1 << form.depth) - 1;
                var leftSrcShift = 32 - (srcX % form.pixPerWord + 1) * form.depth;
                for (var y = 0; y < srcH; y++) {
                    var srcIndex = form.pitch * srcY + (srcX / form.pixPerWord | 0);
                    var srcShift = leftSrcShift;
                    var src = form.bits[srcIndex];
                    var dstIndex = pixels.width * y;
                    for (var x = 0; x < srcW; x++) {
                        dest[dstIndex++] = colors[(src >>> srcShift) & mask]; 
                        if ((srcShift -= form.depth) < 0) {
                            srcShift = 32 - form.depth;
                            src = form.bits[++srcIndex];
                        }
                    }
                    srcY++;
                };
                break;
            case 16:
                var leftSrcShift = srcX % 2 ? 0 : 16;
                for (var y = 0; y < srcH; y++) {
                    var srcIndex = form.pitch * srcY + (srcX / 2 | 0);
                    var srcShift = leftSrcShift;
                    var src = form.bits[srcIndex];
                    var dstIndex = pixels.width * y;
                    for (var x = 0; x < srcW; x++) {
                        var rgb = src >>> srcShift;
                        dest[dstIndex++] =
                            ((rgb & 0x7C00) >> 7)     // shift red   down 2*5, up 0*8 + 3
                            + ((rgb & 0x03E0) << 6)   // shift green down 1*5, up 1*8 + 3
                            + ((rgb & 0x001F) << 19)  // shift blue  down 0*5, up 2*8 + 3
                            + 0xFF000000;             // set alpha to opaque 
                        if ((srcShift -= 16) < 0) {
                            srcShift = 16;
                            src = form.bits[++srcIndex];
                        }
                    }
                    srcY++;
                };
                break;
            case 32:
                for (var y = 0; y < srcH; y++) {
                    var srcIndex = form.pitch * srcY + srcX;
                    var dstIndex = pixels.width * y;
                    for (var x = 0; x < srcW; x++) {
                        var argb = form.bits[srcIndex++];  // convert ARGB -> ABGR
                        var abgr = (argb & 0x0000FF00)     // green is okay
                            + ((argb & 0x00FF0000) >> 16)  // shift red down
                            + ((argb & 0x000000FF) << 16)  // shift blue up
                            + 0xFF000000;                  // set alpha to opaque
                        dest[dstIndex++] = abgr;
                    }
                    srcY++;
                };
                break;
            default: throw Error("depth not implemented");
        };
        if (pixels.data !== pixelData) {
            pixels.data.set(pixelData);
        }
        ctx.putImageData(pixels, rect.left + (rect.offsetX || 0), rect.top + (rect.offsetY || 0));
    },
    primitiveDeferDisplayUpdates: function(argCount) {
        var flag = this.stackBoolean(0);
        if (!this.success) return false;
        this.deferDisplayUpdates = flag;
        this.vm.popN(argCount);
        return true;
    },
    primitiveForceDisplayUpdate: function(argCount) {
        this.vm.breakOut();   // show on screen
        this.vm.popN(argCount);
        return true;
    },
    primitiveScreenSize: function(argCount) {
        var display = this.display,
            w = display.width || display.context.canvas.width,
            h = display.height || display.context.canvas.height;
        return this.popNandPushIfOK(argCount+1, this.makePointWithXandY(w, h));
    },
    primitiveSetFullScreen: function(argCount) {
        var flag = this.stackBoolean(0);
        if (!this.success) return false;
        if (this.display.fullscreen != flag) {
            if (this.display.fullscreenRequest) {
                // freeze until we get the right display size
                var unfreeze = this.vm.freeze();
                this.display.fullscreenRequest(flag, function thenDo() {
                    unfreeze();
                });
            } else {
                this.display.fullscreen = flag;
                this.vm.breakOut(); // let VM go into fullscreen mode
            }
        }
        this.vm.popN(argCount);
        return true;
    },
    primitiveTestDisplayDepth: function(argCount) {
        var supportedDepths =  [1, 2, 4, 8, 16, 32]; // match showOnDisplay()
        return this.pop2andPushBoolIfOK(supportedDepths.indexOf(this.stackInteger(0)) >= 0);
    },
    loadForm: function(formObj) {
        if (formObj.isNil) return null;
        var form = {
            obj: formObj,
            bits: formObj.pointers[Squeak.Form_bits].wordsOrBytes(),
            depth: formObj.pointers[Squeak.Form_depth],
            width: formObj.pointers[Squeak.Form_width],
            height: formObj.pointers[Squeak.Form_height],
        }
        if (form.width === 0 || form.height === 0) return form;
        if (!(form.width > 0 && form.height > 0)) return null;
        form.msb = form.depth > 0;
        if (!form.msb) form.depth = -form.depth;
        if (!(form.depth > 0)) return null; // happens if not int
        form.pixPerWord = 32 / form.depth;
        form.pitch = (form.width + (form.pixPerWord - 1)) / form.pixPerWord | 0;
        if (form.bits.length !== (form.pitch * form.height)) return null;
        return form;
    },
    theDisplay: function() {
        return this.loadForm(this.vm.specialObjects[Squeak.splOb_TheDisplay]);
    },
    displayDirty: function(form, rect) {
        if (!this.deferDisplayUpdates
            && form == this.vm.specialObjects[Squeak.splOb_TheDisplay])
                this.displayUpdate(this.theDisplay(), rect);
    },
    displayFlush: function() {
        // not needed
    },
    displayUpdate: function(form, rect, noCursor) {
        this.display.lastTick = this.vm.lastTick;
        this.display.idle = 0;
        rect.offsetX = this.display.offsetX;
        rect.offsetY = this.display.offsetY;
        this.showForm(this.display.context, form, rect);
        if (noCursor) return;
        // show cursor if it was just overwritten
        if (this.cursorX + this.cursorW > rect.left && this.cursorX < rect.right &&
            this.cursorY + this.cursorH > rect.top && this.cursorY < rect.bottom) 
                this.cursorDraw();
    },
    cursorUpdate: function() {
        var x = this.display.mouseX - this.cursorOffsetX,
            y = this.display.mouseY - this.cursorOffsetY;
        if (x === this.cursorX && y === this.cursorY && !force) return;
        var oldBounds = {left: this.cursorX, top: this.cursorY, right: this.cursorX + this.cursorW, bottom: this.cursorY + this.cursorH };
        this.cursorX = x;
        this.cursorY = y;
        // restore display at old cursor pos
        this.displayUpdate(this.theDisplay(), oldBounds, true);
        // draw cursor at new pos
        this.cursorDraw();
    },
    cursorDraw: function() {
        // TODO: create cursorCanvas in setCursor primitive
        // this.display.context.drawImage(this.cursorCanvas, this.cursorX, this.cursorY);
    },
    primitiveBeep: function(argCount) {
        var ctx = Squeak.startAudio();
        if (ctx) {
            var beep = ctx.createOscillator();
            beep.connect(ctx.destination);
            beep.frequency.value = 880;
            beep.noteOn(0);
            beep.noteOff(ctx.currentTime + 0.2);
        } else {
            this.vm.warnOnce("could not initialize audio");
        }
        return this.popNIfOK(argCount);
    },
},
'input', {
	primitiveClipboardText: function(argCount) {
        if (argCount === 0) { // read from clipboard
            if (typeof(this.display.clipboardString) !== 'string') return false;
            this.vm.popNandPush(1, this.makeStString(this.display.clipboardString));
        } else if (argCount === 1) { // write to clipboard
            var stringObj = this.vm.top();
            if (stringObj.bytes) {
                this.display.clipboardString = stringObj.bytesAsString();
                this.display.clipboardStringChanged = true;
            }
            this.vm.pop();
        }
        return true;
	},
    primitiveKeyboardNext: function(argCount) {
        return this.popNandPushIfOK(argCount+1, this.ensureSmallInt(this.display.keys.shift()));
    },
    primitiveKeyboardPeek: function(argCount) {
        var length = this.display.keys.length;
        return this.popNandPushIfOK(argCount+1, length ? this.ensureSmallInt(this.display.keys[0] || 0) : this.vm.nilObj);
    },
    primitiveMouseButtons: function(argCount) {
        // only used in non-event based (old MVC) images
        this.popNandPushIfOK(argCount+1, this.ensureSmallInt(this.display.buttons));
        // if the image calls this primitive it means it's done displaying
        // we break out of the VM so the browser shows it quickly
        this.vm.breakOut();
        // if nothing was drawn but the image looks at the buttons rapidly,
        // it must be idle.
        if (this.display.idle++ > 20)
            this.vm.goIdle(); // might switch process, so must be after pop
        return true;
    },
    primitiveMousePoint: function(argCount) {
        var x = this.ensureSmallInt(this.display.mouseX),
            y = this.ensureSmallInt(this.display.mouseY);
        return this.popNandPushIfOK(argCount+1, this.makePointWithXandY(x, y));
    },
    primitiveInputSemaphore: function(argCount) {
        var semaIndex = this.stackInteger(0);
        if (!this.success) return false;
        this.inputEventSemaIndex = semaIndex;
        this.display.signalInputEvent = function() {
            this.signalSemaphoreWithIndex(this.inputEventSemaIndex);
        }.bind(this);
        return true;
    },
    primitiveInputWord: function(argCount) {
        // Return an integer indicating the reason for the most recent input interrupt
        return this.popNandPushIfOK(1, 0);      // noop for now
    },
    primitiveGetNextEvent: function(argCount) {
        this.display.idle++;
        var evtBuf = this.stackNonInteger(0);
        if (!this.display.getNextEvent) return false;
        this.display.getNextEvent(evtBuf.pointers, this.vm.startupTime);
        return true;
    },
},
'time', {
    primitiveRelinquishProcessorForMicroseconds: function(argCount) {
        // we ignore the optional arg
        this.vm.pop(argCount);
        this.vm.goIdle();        // might switch process, so must be after pop
        return true;
    },
	millisecondClockValue: function() {
        //Return the value of the millisecond clock as an integer.
        //Note that the millisecond clock wraps around periodically.
        //The range is limited to SmallInteger maxVal / 2 to allow
        //delays of up to that length without overflowing a SmallInteger.
        return (Date.now() - this.vm.startupTime) & Squeak.MillisecondClockMask;
	},
	millisecondClockValueSet: function(clock) {
        // set millisecondClock to the (previously saved) clock value 
        // to allow "stopping" the VM clock while debugging
        this.vm.startupTime = Date.now() - clock;
	},
	secondClock: function() {
        return this.pos32BitIntFor(Squeak.totalSeconds()); // will overflow 32 bits in 2037
    },
},
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
        this.vm.warnOnce("Not yet implemented: primitiveDirectoryEntry");
        return false; // image falls back on primitiveDirectoryLookup
    },
    primitiveDirectoryLookup: function(argCount) {
        var index = this.stackInteger(0),
            dirNameObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var sqDirName = dirNameObj.bytesAsString();
        var dirName = this.filenameFromSqueak(sqDirName);
        var entries = Squeak.dirList(dirName);
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
        this.fileClose(handle.file);
        this.vm.breakOut();     // return to JS asap so async file handler can run
        handle.file = null;
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
        Squeak.flushFile(handle.file);
        this.vm.breakOut();     // return to JS asap so async file handler can run
        return this.popNIfOK(argCount);
    },
    primitiveFileGetPosition: function(argCount) {
        var handle = this.stackNonInteger(0);
        if (!this.success || !handle.file) return false;
        this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(handle.filePos));
        return true;
    },
    primitiveFileOpen: function(argCount) {
        var writeFlag = this.stackBoolean(0),
            fileNameObj = this.stackNonInteger(1);
        if (!this.success) return false;
        var fileName = this.filenameFromSqueak(fileNameObj.bytesAsString()),
            file = this.fileOpen(fileName, writeFlag);
        if (!file) return false;
        var handle = this.makeStArray([file.name]); // array contents irrelevant
        handle.file = file;             // shared between handles
        handle.fileWrite = writeFlag;   // specific to this handle
        handle.filePos = 0;             // specific to this handle
        this.popNandPushIfOK(argCount+1, handle);
        return true;
    },
    primitiveFileRead: function(argCount) {
        var count = this.stackInteger(0),
            startIndex = this.stackInteger(1) - 1, // make zero based
            arrayObj = this.stackNonInteger(2),
            handle = this.stackNonInteger(3);
        if (!this.success || !handle.file) return false;
        if (!count) return this.popNandPushIfOK(argCount+1, 0);
        if (!arrayObj.bytes) {
            console.log("File reading into non-bytes object not implemented yet");
            return false;
        }
        if (startIndex < 0 || startIndex + count > arrayObj.bytes.length)
            return false;
        return this.fileContentsDo(handle.file, function(file) {
            if (!file.contents)
                return this.popNandPushIfOK(argCount+1, 0);
            var srcArray = file.contents,
                dstArray = arrayObj.bytes;
            count = Math.min(count, file.size - handle.filePos);
            for (var i = 0; i < count; i++)
                dstArray[startIndex + i] = srcArray[handle.filePos++];
            this.popNandPushIfOK(argCount+1, count);
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
        this.vm.warnOnce("Not yet implemented: primitiveFileStdioHandles");
        return false;
    },
    primitiveFileTruncate: function(argCount) {
        console.warn("Not yet implemented: primitiveFileTruncate");
        return false;
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
        var directory = Squeak.dirList(path.dirname);
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
            var unfreeze = this.vm.freeze();
            Squeak.fileGet(file.name,
                function success(contents){
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
        }
        return true;
    },
},
'SoundPlugin', {
    snd_primitiveSoundStart: function(argCount) {
        return this.snd_primitiveSoundStartWithSemaphore(argCount);
    },
    snd_primitiveSoundStartWithSemaphore: function(argCount) {
        var bufFrames = this.stackInteger(argCount-1),
            samplesPerSec = this.stackInteger(argCount-2),
            stereoFlag = this.stackBoolean(argCount-3),
            semaIndex = argCount > 3 ? this.stackInteger(argCount-4) : 0;
        if (!this.success) return false;
        this.audioContext = Squeak.startAudio();
        if (!this.audioContext) {
            this.vm.warnOnce("could not initialize audio");
            return false;
        }
        this.audioContext.sampleRate = samplesPerSec;
        this.audioSema = semaIndex; // signal when ready to accept another buffer of samples
        this.audioBuffers = [];
        this.audioBuffersUnused = [
            this.audioContext.createBuffer(stereoFlag ? 2 : 1, bufFrames, samplesPerSec),
            this.audioContext.createBuffer(stereoFlag ? 2 : 1, bufFrames, samplesPerSec),
        ];
        return this.popNIfOK(argCount);
    },
    snd_playNextBuffer: function() {
        if (!this.audioContext) return;
        if (!this.audioBuffers.length) {
            // console.log("audio buffer underrun " + this.audioBuffersUnused.length);
            // if (this.audioBuffersUnused.length < 5) {
            //     var buf = this.audioBuffersUnused[0];
            //     this.audioContext.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate),
            //     this.audioBuffersUnused.push(buf);
            // }
            return;
        }
        var source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffers[0];
        source.connect(this.audioContext.destination);
        source.onended = function() {
            if (!this.audioContext) return;
            this.audioBuffersUnused.push(this.audioBuffers.shift());
            if (this.audioSema) this.signalSemaphoreWithIndex(this.audioSema);
            this.vm.forceInterruptCheck();
            this.snd_playNextBuffer();
        }.bind(this);
        source.start(0);
        this.audioSource = source;
    },
    snd_primitiveSoundAvailableSpace: function(argCount) {
        if (!this.audioContext) return false;
        var available = 0;
        if (this.audioBuffersUnused.length > 0) {
            var buf = this.audioBuffersUnused[0];
            available = buf.length * buf.numberOfChannels * 2;
        }
        return this.popNandPushIfOK(argCount + 1, available);
    },
    snd_primitiveSoundPlaySamples: function(argCount) {
        if (!this.audioContext || !this.audioBuffersUnused.length) return false;
        var count = this.stackInteger(2),
            int16Array = this.stackNonInteger(1).wordsAsInt16Array(),
            startIndex = this.stackInteger(0) - 1;
        if (!this.success || !int16Array) return false;
        var buffer = this.audioBuffersUnused.shift(),
            channels = buffer.numberOfChannels;
        for (var channel = 0; channel < channels; channel++) {
            var float32Array = buffer.getChannelData(channel),
                index = startIndex + channel;
            for (var i = 0; i < count; i++) {
                float32Array[i] = int16Array[index] / 32768;
                index += channels;
            }
        }
        this.audioBuffers.push(buffer);
        if (this.audioBuffers.length === 1)
            this.snd_playNextBuffer();
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundStop: function(argCount) {
        if (this.audioContext) {
            if (this.audioSource)
                this.audioSource.stop(this.audioContext.currentTime + 0.1);
            this.audioContext = null;
            this.audioBuffers = null;
            this.audioBuffersUnused = null;
            this.audioSource = null;
            this.audioSema = 0;
        }
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundStopRecording: function(argCount) {
        return this.fakePrimitive('SoundPlugin.primitiveSoundStopRecording', undefined, argCount);
    },
},
'B2DPlugin', {
    geInitialiseModule: function() {
        this.b2d_debug = false;
        this.b2d_state = {
            form: null,
        };
        return true;
    },
    geReset: function(bitbltObj) {
        if (this.b2d_debug) console.log("-- reset");
        var state = this.b2d_state,
            formObj = bitbltObj.pointers[Squeak.BitBlt_dest];
        if (!state.form || state.form.obj !== formObj)
            state.form = this.loadForm(formObj);
        this.geSetupCanvas();
        state.needsFlush = false;
        state.hasFill = false;
        state.hasStroke = false;
        state.fills = [];
        state.minX = 0;
        state.minY = 0;
        state.maxX = state.form.width;
        state.maxY = state.form.height;
    },
    geSetupCanvas: function() {
        var state = this.b2d_state;
        // create canvas and drawing context
        if (!state.context) {
            var canvas = document.getElementById("SqueakB2DCanvas");
            if (!canvas) {
                canvas = document.createElement("canvas");
                canvas.id = "SqueakB2DCanvas";
                canvas.setAttribute("style", "position:fixed;top:20px;left:950px;background:rgba(255,255,255,0.5)");
                document.body.appendChild(canvas);
            }
            state.context = canvas.getContext("2d");
            if (!state.context) alert("B2D: cannot create context");
        };
        // set canvas size, which also clears it
        var form = state.form,
            canvas = state.context.canvas;
        canvas.width = form.width;
        canvas.height = form.height;
        canvas.style.visibility = this.b2d_debug ? "visible" : "hidden";
    },
    geRender: function() {
        if (this.b2d_debug) console.log("-- render");
        var state = this.b2d_state;
        if (state.flushNeeded) {
            // fill and stroke path
            if (state.hasFill) {
                state.context.closePath();
                state.context.fill();
                if (this.b2d_debug) console.log("==> filling");
            }
            if (state.hasStroke) {
                state.context.stroke();
                if (this.b2d_debug) console.log("==> stroking");
            }
            state.context.beginPath();
            state.flushNeeded = false;
            this.geBlendOverForm();
            // if (this.b2d_debug) this.vm.breakNow("b2d_debug");
        }
        return 0; // answer stop reason
    },
    geBlendOverForm: function() {
        var state = this.b2d_state,
            form = state.form;
        if (this.b2d_debug) console.log("==> read into " + form.width + "x" + form.height + "@" + form.depth);
        if (!form.width || !form.height || state.maxX <= state.minX || state.maxY <= state.minY) return;
        if (!form.msb) return this.vm.warnOnce("B2D: drawing to little-endian forms not implemented yet");
        if (form.depth == 32) {
            this.geBlendOverForm32();
        } else if (form.depth == 16) {
            this.geBlendOverForm16();
        } else if (form.depth == 8) {
            this.geBlendOverForm8();
        } else if (form.depth == 1) {
            this.geBlendOverForm1();
        } else {
            this.vm.warnOnce("B2D: drawing to " + form.depth + " bit forms not supported yet");
        }
        this.displayDirty(form.obj, state.minX, state.minY, state.maxX - state.minX, state.maxY - state.minY);
    },
    geBlendOverForm1: function() {
        // since we have 32 pixels per word, round to 32 pixels
        var state = this.b2d_state,
            form = state.form,
            minX = state.minX & ~31,
            minY = state.minY,
            maxX = (state.maxX + 31) & ~31,
            maxY = state.maxY,
            width = maxX - minX,
            height = maxY - minY,
            canvasBytes = state.context.getImageData(minX, minY, width, height).data,
            srcIndex = 0;
        if (this.b2d_debug) console.log("==> clipped to " + width + "x" + height);
        for (var y = minY; y < maxY; y++) {
            var dstIndex = y * form.pitch + (minX / 32);
            for (var x = minX; x < maxX; x += 32*4) {
                var dstPixels = form.bits[dstIndex],  // 32 one-bit pixels
                    dstShift = 31,
                    result = 0;
                for (var i = 0; i < 32; i++) {
                    var alpha = canvasBytes[srcIndex+3],
                        pix = alpha > 0.5 ? 0 : dstPixels;  // assume we're drawing in black 
                    result = result | (pix & (1 << dstShift));
                    dstShift--;
                    srcIndex += 4;
                }
                form.bits[dstIndex] = result;
                dstIndex++;
            }
        }
    },
    geBlendOverForm8: function() {
        // since we have four pixels per word, round to 4 pixels
        var state = this.b2d_state,
            form = state.form,
            minX = state.minX & ~3,
            minY = state.minY,
            maxX = (state.maxX + 3) & ~3,
            maxY = state.maxY,
            width = maxX - minX,
            height = maxY - minY,
            canvasBytes = state.context.getImageData(minX, minY, width, height).data,
            srcIndex = 0;
        if (this.b2d_debug) console.log("==> clipped to " + width + "x" + height);
        for (var y = minY; y < maxY; y++) {
            var dstIndex = y * form.pitch + (minX / 4);
            for (var x = minX; x < maxX; x += 4) {
                if (!(canvasBytes[srcIndex+3] | canvasBytes[srcIndex+7] | canvasBytes[srcIndex+11] | canvasBytes[srcIndex+15])) {
                    srcIndex += 16; dstIndex++; // skip pixels if fully transparent
                    continue;
                }
                var dstPixels = form.bits[dstIndex],  // four 8-bit pixels
                    dstShift = 24,
                    result = 0;
                for (var i = 0; i < 4; i++) {
                    var alpha = canvasBytes[srcIndex+3] / 255;
                    if (alpha < 0.1) {
                        result = result | (dstPixels & (0xFF << dstShift)); // keep dst
                    } else {
                        var oneMinusAlpha = 1 - alpha,
                            pix = this.indexedColors[(dstPixels >> dstShift) & 0xFF],
                            r = alpha * canvasBytes[srcIndex  ] + oneMinusAlpha * ((pix >> 16) & 0xFF),
                            g = alpha * canvasBytes[srcIndex+1] + oneMinusAlpha * ((pix >>  8) & 0xFF),
                            b = alpha * canvasBytes[srcIndex+2] + oneMinusAlpha * ( pix        & 0xFF),
                            res = 40 + (r / 255 * 5.5|0) * 36 + (b / 255 * 5.5|0) * 6 + (g / 255 * 5.5|0);  // 6x6x6 RGB cube
                        result = result | (res << dstShift);
                    }
                    dstShift -= 8;
                    srcIndex += 4;
                }
                form.bits[dstIndex] = result;
                dstIndex++;
            }
        }
    },
    geBlendOverForm16: function() {
        // since we have two pixels per word, grab from even positions
        var state = this.b2d_state,
            form = state.form,
            minX = state.minX & ~1,
            minY = state.minY,
            maxX = (state.maxX + 1) & ~1,
            maxY = state.maxY,
            width = maxX - minX,
            height = maxY - minY,
            canvasBytes = state.context.getImageData(minX, minY, width, height).data,
            srcIndex = 0;
        if (this.b2d_debug) console.log("==> clipped to " + width + "x" + height);
        for (var y = minY; y < maxY; y++) {
            var dstIndex = y * form.pitch + (minX / 2);
            for (var x = minX; x < maxX; x += 2) {
                if (!(canvasBytes[srcIndex+3] | canvasBytes[srcIndex+7])) {
                    srcIndex += 8; dstIndex++; // skip pixels if fully transparent
                    continue;
                }
                var dstPixels = form.bits[dstIndex],  // two 16-bit pixels
                    dstShift = 16,
                    result = 0;
                for (var i = 0; i < 2; i++) {
                    var alpha = canvasBytes[srcIndex+3] / 255,
                        oneMinusAlpha = 1 - alpha,
                        pix = dstPixels >> dstShift,
                        r = alpha * canvasBytes[srcIndex  ] + oneMinusAlpha * ((pix >> 7) & 0xF8),
                        g = alpha * canvasBytes[srcIndex+1] + oneMinusAlpha * ((pix >> 2) & 0xF8),
                        b = alpha * canvasBytes[srcIndex+2] + oneMinusAlpha * ((pix << 3) & 0xF8),
                        res = (r & 0xF8) << 7 | (g & 0xF8) << 2 | (b & 0xF8) >> 3;  
                    result = result | (res << dstShift);
                    dstShift -= 16;
                    srcIndex += 4;
                }
                form.bits[dstIndex] = result;
                dstIndex++;
            }
        }
    },
    geBlendOverForm32: function() {
        var state = this.b2d_state,
            minX = state.minX,
            minY = state.minY,
            maxX = state.maxX,
            maxY = state.maxY,
            width = maxX - minX,
            height = maxY - minY,
            canvasBytes = state.context.getImageData(minX, minY, width, height).data,
            form = state.form,
            srcIndex = 0;
        if (this.b2d_debug) console.log("==> reading " + width + "x" + height + " pixels");
        for (var y = minY; y < maxY; y++) {
            var dstIndex = y * form.pitch + minX;
            for (var x = minX; x < maxX; x++) {
                var srcAlpha = canvasBytes[srcIndex+3];
                if (srcAlpha !== 0) { // skip pixel if fully transparent
                    var alpha = srcAlpha / 255,
                        oneMinusAlpha = 1 - alpha,
                        pix = form.bits[dstIndex],
                        a =                        srcAlpha + oneMinusAlpha * ((pix >> 24) & 0xFF),
                        r = alpha * canvasBytes[srcIndex  ] + oneMinusAlpha * ((pix >> 16) & 0xFF),
                        g = alpha * canvasBytes[srcIndex+1] + oneMinusAlpha * ((pix >>  8) & 0xFF),
                        b = alpha * canvasBytes[srcIndex+2] + oneMinusAlpha * ( pix        & 0xFF);
                    form.bits[dstIndex] = (a << 24) | (r << 16) | (g << 8) | b;
                }
                srcIndex+= 4;
                dstIndex++;
            }
        }
    },
    gePointsFrom: function(arrayObj, nPoints) {
        var words = arrayObj.words;
        if (words) {
            if (words.length == nPoints) return arrayObj.wordsAsInt16Array();       // ShortPointArray
            if (words.length == nPoints * 2) return arrayObj.wordsAsInt32Array();   // PointArray
            return null;
        }
        // Array of Points
        var points = arrayObj.pointers;
        if (!points || points.length != nPoints)
            return null;
        var array = [];
        for (var i = 0; i < nPoints; i++) {
            var p = points[i].pointers;         // Point
            array.push(this.floatOrInt(p[0]));  // x
            array.push(this.floatOrInt(p[1]));  // y
        }
        return array;
    },
    geSetClip: function(minX, minY, maxX, maxY) {
        if (this.b2d_debug) console.log("==> clip " + minX + "," + minY + "," + maxX + "," + maxY);
        var state = this.b2d_state;
        if (state.minX < minX) state.minX = minX;
        if (state.minY < minY) state.minY = minY;
        if (state.maxX > maxX) state.maxX = maxX;
        if (state.maxY > maxY) state.maxY = maxY;
    },
    geSetOffset: function(x, y) {
        // TODO: make offset work together with transform
        this.b2d_state.context.setTransform(1, 0, 0, 1, x, y);
        if (this.b2d_debug) console.log("==> translate " + x +"," + y);
    },
    geSetTransform: function(t) {
        /* Transform is a matrix:
                ⎛a₁₁ a₁₂ a₁₃⎞
                ⎝a₂₁ a₂₂ a₂₃⎠
            Squeak Matrix2x3Transform stores as
                [a₁₁, a₁₂, a₁₃, a₂₁, a₂₂, a₂₃]
            but canvas expects
                [a₁₁, a₂₁, a₁₂, a₂₂, a₁₃, a₂₃]
        */
        this.b2d_state.context.setTransform(t[0], t[3], t[1], t[4], t[2], t[5]);
        if (this.b2d_debug) console.log("==> transform: " + [t[0], t[3], t[1], t[4], t[2], t[5]].join(','));
    },
    geSetStyle: function(fillIndex, borderIndex, borderWidth) {
        var hasFill = fillIndex !== 0,
            hasStroke = borderIndex !== 0 && borderWidth > 0,
            state = this.b2d_state;
        state.hasFill = hasFill;
        state.hasStroke = hasStroke;
        if (hasFill) {
            state.context.fillStyle = this.geStyleFrom(fillIndex);
            if (this.b2d_debug) console.log("==> fill style: " + state.context.fillStyle);
        }
        if (hasStroke) {
            state.context.strokeStyle = this.geStyleFrom(borderIndex);
            state.context.lineWidth = borderWidth;
            if (this.b2d_debug) console.log("==> stroke style: " + state.context.strokeStyle + '@' + borderWidth);
        }
        return hasFill || hasStroke;
    },
    geColorFrom: function(word) {
        var b = word & 0xFF,
            g = (word & 0xFF00) >>> 8,
            r = (word & 0xFF0000) >>> 16,
            a = ((word & 0xFF000000) >>> 24) / 255;
        if (a > 0) { // undo pre-multiplication of alpha
            b = b / a & 0xFF;
            g = g / a & 0xFF;
            r = r / a & 0xFF;
        }        
        return "rgba(" + [r, g, b, a].join(",") + ")";
    },
    geStyleFrom: function(index) {
        if (index === 0) return null;
        var fills = this.b2d_state.fills;
        if (index <= fills.length) return fills[index - 1];
        return this.geColorFrom(index);
    },
    gePrimitiveSetEdgeTransform: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveSetEdgeTransform");
        var transform = this.stackNonInteger(0);
        if (!this.success) return false;
        if (transform.words) this.geSetTransform(transform.wordsAsFloat32Array());
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveSetClipRect: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveSetClipRect");
        var rect = this.stackNonInteger(0);
        if (!this.success) return false;
        var origin = rect.pointers[0].pointers,
            corner = rect.pointers[1].pointers;
        this.geSetClip(origin[0], origin[1], corner[0], corner[1]);
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveRenderImage: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveRenderImage");
        var stopReason = this.geRender();
        this.vm.popNandPush(argCount + 1, stopReason);
        return true;
    },
    gePrimitiveRenderScanline: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveRenderScanline");
        var stopReason = this.geRender();
        this.vm.popNandPush(argCount + 1, stopReason);
        return true;
    },
    gePrimitiveFinishedProcessing: function(argCount) {
        var finished = !this.b2d_state.flushNeeded;
        if (this.b2d_debug) console.log("b2d: gePrimitiveFinishedProcessing => " + finished);
        this.vm.popNandPush(argCount+1, this.makeStObject(finished));
        return true;
    },
    gePrimitiveNeedsFlushPut: function(argCount) {
        var needsFlush = this.stackBoolean(0);
        if (!this.success) return false;
        this.b2d_state.needsFlush = needsFlush;
        if (this.b2d_debug) console.log("b2d: gePrimitiveNeedsFlushPut: " + needsFlush);
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveInitializeBuffer: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveInitializeBuffer");
        var engine = this.stackNonInteger(argCount),
            bitblt = engine.pointers[2]; // BEBitBltIndex
        this.geReset(bitblt);
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddOval: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddOval");
        var origin      = this.stackNonInteger(4).pointers,
            corner      = this.stackNonInteger(3).pointers,
            fillIndex   = this.stackPos32BitInt(2),
            borderWidth = this.stackInteger(1),
            borderIndex = this.stackPos32BitInt(0);
        if (!this.success) return false;
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var ctx = this.b2d_state.context,
                x = this.floatOrInt(origin[0]),
                y = this.floatOrInt(origin[1]),
                w = this.floatOrInt(corner[0]) - x,
                h = this.floatOrInt(corner[1]) - y;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(w, h);
            ctx.arc(0.5, 0.5, 0.5, 0, Math.PI * 2);
            ctx.restore();
            if (this.b2d_debug) console.log("==> oval " + [x, y, w, h].join(','));
            this.b2d_state.flushNeeded = true;
        }
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddBezierShape: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddBezierShape");
        var points      = this.stackNonInteger(4),
            nSegments   = this.stackInteger(3),
            fillIndex   = this.stackPos32BitInt(2),
            borderWidth = this.stackInteger(1),
            borderIndex = this.stackPos32BitInt(0);
        if (!this.success) return false;
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var p = this.gePointsFrom(points, nSegments * 3);
            if (!p) return false;
            var ctx = this.b2d_state.context;
            ctx.moveTo(p[0], p[1]);
            for (var i = 0; i < p.length; i += 6)
                ctx.quadraticCurveTo(p[i+2], p[i+3], p[i+4], p[i+5]);
            if (this.b2d_debug) console.log("==> beziershape");
            this.b2d_state.flushNeeded = true;
        }
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddPolygon: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddPolygon");
        var points      = this.stackNonInteger(4),
            nPoints     = this.stackInteger(3),
            fillIndex   = this.stackPos32BitInt(2),
            borderWidth = this.stackInteger(1),
            borderIndex = this.stackPos32BitInt(0);
        if (!this.success) return false;
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var p = this.gePointsFrom(points, nPoints);
            if (!p) return false;
            var ctx = this.b2d_state.context;
            ctx.moveTo(p[0], p[1]);
            for (var i = 2; i < p.length; i += 2)
                ctx.lineTo(p[i], p[i+1]);
            if (this.b2d_debug) console.log("==> polygon");
            this.b2d_state.flushNeeded = true;
        }
        return true;
    },
    gePrimitiveAddRect: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddRect");
        var origin      = this.stackNonInteger(4).pointers,
            corner      = this.stackNonInteger(3).pointers,
            fillIndex   = this.stackPos32BitInt(2),
            borderWidth = this.stackInteger(1),
            borderIndex = this.stackPos32BitInt(0);
        if (!this.success) return false;
        if (this.geSetStyle(fillIndex, borderIndex, borderWidth)) {
            var x = this.floatOrInt(origin[0]),
                y = this.floatOrInt(origin[1]),
                w = this.floatOrInt(corner[0]) - x,
                h = this.floatOrInt(corner[1]) - y; 
            this.b2d_state.context.rect(x, y, w, h);
            if (this.b2d_debug) console.log("==> rect " + [x, y, w, h].join(','));
            this.b2d_state.flushNeeded = true;
        }
        this.vm.popNandPush(argCount+1, 0);
        return true;
    },
    gePrimitiveAddBezier: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddBezier");
        this.vm.warnOnce("B2D: beziers not implemented yet");
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddCompressedShape: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddCompressedShape");
        this.vm.warnOnce("B2D: compressed shapes not implemented yet");
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddLine: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddLine");
        this.vm.warnOnce("B2D: lines not implemented yet");
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveAddBitmapFill: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddBitmapFill");
        this.vm.warnOnce("B2D: bitmap fills not implemented yet");
        var fills = this.b2d_state.fills;
        fills.push('red');
        this.vm.popNandPush(argCount+1, fills.length);
        return true;
    },
    gePrimitiveAddGradientFill: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveAddGradientFill");
        var ramp = this.stackNonInteger(4).words,
            origin = this.stackNonInteger(3).pointers,
            direction = this.stackNonInteger(2).pointers,
            //normal = this.stackNonInteger(1).pointers,
            isRadial = this.stackBoolean(0);
        if (!this.success) return false;
        var x = this.floatOrInt(origin[0]),
            y = this.floatOrInt(origin[1]),
            dx = this.floatOrInt(direction[0]),
            dy = this.floatOrInt(direction[1]),
            state = this.b2d_state,
            ctx = state.context,
            gradient = isRadial
                ? ctx.createRadialGradient(x, y, 0, x, y, Math.sqrt(dx*dx + dy*dy))
                : ctx.createLinearGradient(x, y, x + dx, y + dy);
        // we get a 512-step color ramp here. Going to assume it's made from only two colors.
        gradient.addColorStop(0, this.geColorFrom(ramp[0]));
        gradient.addColorStop(1, this.geColorFrom(ramp[ramp.length - 1]));
        // TODO: use more than two stops
        // IDEA: the original gradient is likely in a temp at this.vm.stackValue(7)
        //       so we could get the original color stops from it
        state.fills.push(gradient);
        this.vm.popNandPush(argCount+1, state.fills.length);
        return true;
    },
    gePrimitiveNeedsFlush: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveNeedsFlush => " + this.b2d_state.needsFlush);
        this.vm.popNandPush(argCount, this.makeStObject(this.b2d_state.needsFlush));
        return true;
    },
    gePrimitiveSetOffset: function(argCount) {
        if (this.b2d_debug) console.log("b2d: gePrimitiveSetOffset");
        var offset = this.stackNonInteger(0).pointers;
        if (!offset) return false;
        this.geSetOffset(this.floatOrInt(offset[0]), this.floatOrInt(offset[1]));
        this.vm.popN(argCount);
        return true;
    },
    gePrimitiveGetFailureReason: function(argCount) { this.vm.popN(argCount+1, 0); return true; },
    gePrimitiveSetColorTransform: function(argCount) {this.vm.popN(argCount); return true;},
    gePrimitiveSetAALevel: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveGetAALevel: function(argCount) { return false; },
    gePrimitiveSetDepth: function(argCount) {this.vm.popN(argCount); return true; },
    gePrimitiveGetDepth: function(argCount) {this.vm.popNandPush(argCount+1, 0); return true; },
    gePrimitiveGetClipRect: function(argCount) { return false; },
    gePrimitiveGetOffset: function(argCount) { return false; },
    gePrimitiveSetBitBltPlugin: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveDoProfileStats: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveGetBezierStats: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveGetCounts: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveGetTimes: function(argCount) { this.vm.popN(argCount); return true; },
    gePrimitiveInitializeProcessing: function(argCount) { return false; },
    gePrimitiveAddActiveEdgeEntry: function(argCount) { return false; },
    gePrimitiveChangedActiveEdgeEntry: function(argCount) { return false; },
    gePrimitiveNextActiveEdgeEntry: function(argCount) { return false; },
    gePrimitiveNextGlobalEdgeEntry: function(argCount) { return false; },
    gePrimitiveDisplaySpanBuffer: function(argCount) { return false; },
    gePrimitiveCopyBuffer: function(argCount) { return false; },
    gePrimitiveNextFillEntry: function(argCount) { return false; },
    gePrimitiveMergeFillFrom: function(argCount) { return false; },
    gePrimitiveRegisterExternalEdge: function(argCount) { return false; },
    gePrimitiveRegisterExternalFill: function(argCount) { return false; },
},
'ScratchPluginAdditions', {
    // methods not handled by generated ScratchPlugin
    scratch_primitiveOpenURL: function(argCount) {
        var url = this.stackNonInteger(0).bytesAsString();
        if (url == "") return false;
        window.open(url, "_blank"); // likely blocked as pop-up, but what can we do?
        return this.popNIfOK(argCount);
    },
    scratch_primitiveGetFolderPath: function(argCount) {
        var index = this.stackInteger(0);
        if (!this.success) return false;
        var path;
        switch (index) {
            case 1: path = '/'; break;              // home dir
            // case 2: path = '/desktop'; break;    // desktop
            // case 3: path = '/documents'; break;  // documents
            // case 4: path = '/pictures'; break;   // my pictures
            // case 5: path = '/music'; break;      // my music
        }
        if (!path) return false;
        this.vm.popNandPush(argCount + 1, this.makeStString(this.filenameToSqueak(path)));
        return true;
    },
},
'Obsolete', {
    primitiveFloatArrayAt: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAt", argCount);
    },
    primitiveFloatArrayMulFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveMulFloatArray", argCount);
    },
    primitiveFloatArrayAddScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAddScalar", argCount);
    },
    primitiveFloatArrayDivFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDivFloatArray", argCount);
    },
    primitiveFloatArrayDivScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDivScalar", argCount);
    },
    primitiveFloatArrayHash: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveHash", argCount);
    },
    primitiveFloatArrayAtPut: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAtPut", argCount);
    },
    primitiveFloatArrayMulScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveMulScalar", argCount);
    },
    primitiveFloatArrayAddFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAddFloatArray", argCount);
    },
    primitiveFloatArraySubScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveSubScalar", argCount);
    },
    primitiveFloatArraySubFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveSubFloatArray", argCount);
    },
    primitiveFloatArrayEqual: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveEqual", argCount);
    },
    primitiveFloatArrayDotProduct: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDotProduct", argCount);
    },
    m23PrimitiveInvertRectInto: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveInvertRectInto", argCount);
    },
    m23PrimitiveTransformPoint: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveTransformPoint", argCount);
    },
    m23PrimitiveIsPureTranslation: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveIsPureTranslation", argCount);
    },
    m23PrimitiveComposeMatrix: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveComposeMatrix", argCount);
    },
    m23PrimitiveTransformRectInto: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveTransformRectInto", argCount);
    },
    m23PrimitiveIsIdentity: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveIsIdentity", argCount);
    },
    m23PrimitiveInvertPoint: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveInvertPoint", argCount);
    },
    primitiveDeflateBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveDeflateBlock", argCount);
    },
    primitiveDeflateUpdateHashTable: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveDeflateUpdateHashTable", argCount);
    },
    primitiveUpdateGZipCrc32: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveUpdateGZipCrc32", argCount);
    },
    primitiveInflateDecompressBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveInflateDecompressBlock", argCount);
    },
    primitiveZipSendBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveZipSendBlock", argCount);
    },
    primitiveFFTTransformData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTTransformData", argCount);
    },
    primitiveFFTScaleData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTScaleData", argCount);
    },
    primitiveFFTPermuteData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTPermuteData", argCount);
    },
});

Object.subclass('Squeak.InterpreterProxy',
// provides function names exactly like the C interpreter, for ease of porting
// but maybe less efficiently because of the indirection
'initialization', {
    VM_PROXY_MAJOR: 1,
    VM_PROXY_MINOR: 11,
    initialize: function(vm) {
        this.vm = vm;
        this.remappableOops = [];
        Object.defineProperty(this, 'successFlag', {
          get: function() { return vm.primHandler.success; },
          set: function(success) { vm.primHandler.success = success; },
        });
    },
    majorVersion: function() {
        return this.VM_PROXY_MAJOR;
    },
    minorVersion: function() {
        return this.VM_PROXY_MINOR;
    },
},
'success',
{
    failed: function() {
        return !this.successFlag;
    },
    primitiveFail: function() {
        this.successFlag = false;
    },
    success: function(boolean) {
        if (!boolean) this.successFlag = false;
    },
},
'stack access',
{
    pop: function(n) {
        this.vm.popN(n);
    },
    popthenPush: function(n, obj) {
        this.vm.popNandPush(n, obj);
    },
    pushBool: function(bool) {
        this.vm.push(bool ? this.vm.trueObj : this.vm.falseObj);
    },
    pushInteger: function(int) {
        this.vm.push(int);
    },
    pushFloat: function(num) {
        this.vm.push(this.floatObjectOf(num));
    },
    stackValue: function(n) {
        return this.vm.stackValue(n);
    },
	stackIntegerValue: function(n) {
        var int = this.vm.stackValue(n);
        if (typeof int === "number") return int;
        this.successFlag = false;
        return 0;
    },
    stackFloatValue: function(n) {
        this.vm.success = true;
        var float = this.vm.stackIntOrFloat(n);
        if (this.vm.success) return float;
        this.successFlag = false;
        return 0;
    },
	stackObjectValue: function(n) {
        var obj = this.vm.stackValue(n);
        if (typeof obj !== "number") return obj;
        this.successFlag = false;
        return this.vm.nilObj;
    },
    stackBytes: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.bytes) return oop.bytes;
        if (oop.words) return oop.wordsAsUint8Array();
        if (typeof oop === "number" || !oop.isWordsOrBytes()) this.successFlag = false;
        return [];
    },
    stackWords: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.words;
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackInt32Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsInt32Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackInt16Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsInt16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    stackUint16Array: function(n) {
        var oop = this.vm.stackValue(n);
        if (oop.words) return oop.wordsAsUint16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
},
'object access',
{
    isBytes: function(obj) {
        return typeof obj !== "number" && obj.isBytes();
    },
    isWords: function(obj) {
        return typeof obj !== "number" && obj.isWords();
    },
    isPointers: function(obj) {
        return typeof obj !== "number" && obj.isPointers();
    },
    booleanValueOf: function(obj) {
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        this.successFlag = false;
        return false;
    },
    positive32BitValueOf: function(obj) {
        return this.vm.primHandler.positive32BitValueOf(obj);
    },
    positive32BitIntegerFor: function(int) {
        return this.vm.primHandler.pos32BitIntFor(int);
    },
    floatValueOf: function(obj) {
        if (obj.isFloat) return obj.float;
        this.successFlag = false;
        return 0;
    },
    floatObjectOf: function(num) {
        return this.vm.primHandler.makeFloat(num);
    },
    fetchPointerofObject: function(n, obj) {
        return obj.pointers[n];
    },
    fetchBytesofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.bytes) return oop.bytes;
        if (oop.words) return oop.wordsAsUint8Array();
        if (typeof oop === "number" || !oop.isWordsOrBytes()) this.successFlag = false;
        return [];
    },
    fetchWordsofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.words;
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchInt32ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsInt32Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchInt16ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsInt16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchUint16ArrayofObject: function(n, obj) {
        var oop = obj.pointers[n];
        if (oop.words) return oop.wordsAsUint16Array();
        if (typeof oop === "number" || !oop.isWords()) this.successFlag = false;
        return [];
    },
    fetchIntegerofObject: function(n, obj) {
	    var int = obj.pointers[n];
	    if (typeof int === "number") return int;
	    this.successFlag = false;
	    return 0;
    },
    storeIntegerofObjectwithValue: function(n, obj, value) {
        if (typeof value === "number")
            obj.pointers[n] = value;
        else this.successFlag = false;
    },
    storePointerofObjectwithValue: function(n, obj, value) {
        obj.pointers[n] = value;
    },
    stObjectatput: function(array, index, obj) {
        if (array.sqClass !== this.classArray()) throw Error("Array expected");
        if (index < 1 || index >= array.pointers.length) return this.successFlag = false;
        array.pointers[index] = obj;
    },
}, 
'constant access',
{
    isKindOfInteger: function(obj) {
        return typeof obj === "number" ||
            obj.sqClass == this.classLargeNegativeInteger() ||
            obj.sqClass == this.classLargePositiveInteger();
    },
    classArray: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassArray];
    },
    classSmallInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassInteger];
    },
    classLargePositiveInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger];
    },
    classLargeNegativeInteger: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassLargeNegativeInteger];
    },
    classPoint: function() {
        return this.vm.specialObjects[Squeak.splOb_ClassPoint];
    },
    nilObject: function() {
        return this.vm.nilObj;
    },
    falseObject: function() {
        return this.vm.falseObj;
    },
    trueObject: function() {
        return this.vm.trueObj;
    },
},
'vm functions',
{
    instantiateClassindexableSize: function(aClass, indexableSize) {
        return this.vm.instantiateClass(aClass, indexableSize);
    },
    methodArgumentCount: function() {
        return this.argCount;
    },
    makePointwithxValueyValue: function(x, y) {
        return this.vm.primHandler.makePointWithXandY(x, y);
    },
    pushRemappableOop: function(obj) {
        this.remappableOops.push(obj);
    },
    popRemappableOop: function() {
        return this.remappableOops.pop();
    },
    showDisplayBitsLeftTopRightBottom: function(form, left, top, right, bottom) {
        if (left < right && top < bottom) {
            var rect = {left: left, top: top, right: right, bottom: bottom};
            this.vm.primHandler.displayDirty(form, rect);
        }
    },
});

Object.extend(Squeak, {
    dbTransaction: function(mode, transactionFunc) {
        // File contents is stored in the IndexedDB named "squeak" in object store "files"
        // and directory entries in localStorage with prefix "squeak:"
        if (typeof indexedDB == "undefined")
            return transactionFunc(this.dbFake());

        var startTransaction = function() {
            var trans = SqueakDB.transaction("files", mode),
                fileStore = trans.objectStore("files");
            transactionFunc(fileStore);
        };

        // if database connection already opened, just do transaction
        if (window.SqueakDB) return startTransaction();
        
        // otherwise, open SqueakDB first
        var openReq = indexedDB.open("squeak");
        openReq.onsuccess = function(e) {
            window.SqueakDB = this.result;
            SqueakDB.onversionchange = function(e) {
                delete window.SqueakDB;
                this.close();
            };
            startTransaction();
        };
        openReq.onupgradeneeded = function (e) {
            // run only first time, or when version changed
            console.log("Creating database version " + e.newVersion);
            var db = e.target.result;
            db.createObjectStore("files");
        };
        openReq.onerror = function(e) {
            console.log("Error opening database: " + e.target.errorCode);
        };
        openReq.onblocked = function(e) {
            // If some other tab is loaded with the database, then it needs to be closed
            // before we can proceed upgrading the database.
            alert("Database upgrade needed. Please close all other tabs with this site open!");
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
                get: function(filename) {
                    var string = localStorage["squeak-file:" + filename];
                    if (!string) {
                        var compressed = localStorage["squeak-file.lz:" + filename];
                        if (compressed) {
                            if (typeof LZString == "object") {
                                string = LZString.decompressFromUTF16(compressed);
                            } else {
                                console.error("LZString not loaded: cannot decompress " + filename);
                            }
                        }
                    }
                    var bytes = new Uint8Array(string ? string.length : 0);
                    for (var i = 0; i < bytes.length; i++)
                        bytes[i] = string.charCodeAt(i) & 0xFF;
                    var req = {result: bytes.buffer};
                    setTimeout(function(){
                        if (string && req.onsuccess) req.onsuccess();
                        if (!string && req.onerror) req.onerror();
                    }, 0);
                    return req;
                },
                put: function(buffer, filename) {
                    var string = Squeak.bytesAsString(new Uint8Array(buffer));
                    if (typeof LZString == "object") {
                        var compressed = LZString.compressToUTF16(string);
                        localStorage["squeak-file.lz:" + filename] = compressed;
                        delete localStorage["squeak-file:" + filename];
                    } else {
                        localStorage["squeak-file:" + filename] = string;
                    }
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess()}, 0);
                    return req;
                },
                delete: function(filename) {
                    delete localStorage["squeak-file:" + filename];
                    delete localStorage["squeak-file.lz:" + filename];
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess()}, 0);
                    return req;
                },
            }
        }
        return SqueakDBFake;
    },
    fileGet: function(filepath, thenDo, errorDo) {
        if (!errorDo) errorDo = console.log;
        var path = this.splitFilePath(filepath);
        if (!path.basename) return errorDo("Invalid path: " + filepath);
        this.dbTransaction("readonly", function(fileStore) {
            var getReq = fileStore.get(path.fullname);
            getReq.onerror = function(e) { errorDo(this.errorCode) };
            getReq.onsuccess = function(e) {
                if (this.result == undefined) {
                    // fall back on fake db, may be file is there
                    var fakeReq = Squeak.dbFake().get(path.fullname);
                    fakeReq.onerror = function(e) { errorDo("file not found: " + path.fullname) };
                    fakeReq.onsuccess = function(e) { thenDo(this.result); }
                    return;
                }
                thenDo(this.result);
            };
        });
    },
    filePut: function(filepath, contents) {
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
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        // put file contents (async)
        this.dbTransaction("readwrite", function(fileStore) {
            fileStore.put(contents, path.fullname);
        });
        return entry;
    },
    fileDelete: function(filepath) {
        var path = this.splitFilePath(filepath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        var entry = directory[path.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        // delete entry from directory
        delete directory[path.basename];
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        // delete file contents (async)
        this.dbTransaction("readwrite", function(fileStore) {
            fileStore['delete'](path.fullname);    // workaround for ometa parser
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
        localStorage["squeak:" + newpath.dirname] = JSON.stringify(newdir);
        if (!samedir) localStorage["squeak:" + oldpath.dirname] = JSON.stringify(olddir);
        // move file contents (async)
        this.fileGet(oldpath.fullname,
            function success(contents) {
                this.dbTransaction("readwrite", function(fileStore) {
                    fileStore.put(contents, newpath.fullname);
                });
            }.bind(this),
            function error(msg) {
                console.log("File rename failed: " + msg);
            }.bind(this));
        return true;
    },
    dirCreate: function(dirpath) {
        var path = this.splitFilePath(dirpath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        if (directory[path.basename]) return false;
        var now = this.totalSeconds(),
            entry = [/*name*/ path.basename, /*ctime*/ now, /*mtime*/ now, /*dir*/ true, /*size*/ 0];
        directory[path.basename] = entry;
        localStorage["squeak:" + path.fullname] = JSON.stringify({});
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
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
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        // delete itself
        delete localStorage["squeak:" + path.fullname];
        return true;
    },
    dirList: function(dirpath) {
        // return directory entries or null
        var path = this.splitFilePath(dirpath),
            entries = localStorage["squeak:" + path.fullname];
        if (entries) return JSON.parse(entries);
        if (path.fullname == "/") return {};
        return null;
    },
    splitFilePath: function(filepath) {
        if (filepath[0] !== '/') filepath = '/' + filepath;
        filepath = filepath.replace(/\/\//ig, '/');      // replace double-slashes
        var matches = filepath.match(/(.*)\/(.*)/),
            dirname = matches[1].length ? matches[1] : '/',
            basename = matches[2].length ? matches[2] : null;
        return {fullname: filepath, dirname: dirname, basename: basename};
    },
    bytesAsString: function(bytes) {
	var chars = [];
        for (var i = 0; i < bytes.length; i++)
            chars.push(String.fromCharCode(bytes[i]));
	return chars.join('');
    },
    flushFile: function(file) {
        if (file.modified) {
            var buffer = file.contents.buffer;
            if (buffer.byteLength !== file.size) {
                buffer = new ArrayBuffer(file.size);
                (new Uint8Array(buffer)).set(file.contents.subarray(0, file.size));
            }
            Squeak.filePut(file.name, buffer);
            if (/SqueakDebug.log/.test(file.name)) {
                var chars = Squeak.bytesAsString(new Uint8Array(buffer));
                console.warn(chars.replace(/\r/g, '\n'));
            }
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
    totalSeconds: function() {
        // seconds since 1901-01-01, local time
        return Math.floor(Date.now()/1000) - Squeak.Epoch;
    },
    startAudio: function() {
        if (!this.audioContext) {
            var ctxProto = window.AudioContext || window.webkitAudioContext;
            this.audioContext = ctxProto && new ctxProto();
        }
        return this.audioContext;
    },
});

Object.subclass('Squeak.InstructionPrinter',
'initialization', {
    initialize: function(method, vm) {
        this.method = method;
        this.vm = vm;
    },
},
'printing', {
    printInstructions: function(indent, highlight, highlightPC) {
        // all args are optional
        this.indent = indent;           // prepend to every line except if highlighted
        this.highlight = highlight;     // prepend to highlighted line
        this.highlightPC = highlightPC; // PC of highlighted line
        this.innerIndents = {};
        this.result = '';
        this.scanner = new Squeak.InstructionStream(this.method, this.vm);
        this.oldPC = this.scanner.pc;
        this.endPC = 0;                 // adjusted while scanning
        this.done = false;
        while (!this.done)
        	this.scanner.interpretNextInstructionFor(this);
        return this.result;
    },
    print: function(instruction) {
        if (this.oldPC === this.highlightPC) {
            if (this.highlight) this.result += this.highlight;
        } else {
            if (this.indent) this.result += this.indent;
        }
        this.result += this.oldPC;
        for (var i = 0; i < this.innerIndents[this.oldPC] || 0; i++)
            this.result += "   ";
        this.result += " <";
        for (var i = this.oldPC; i < this.scanner.pc; i++) {
            if (i > this.oldPC) this.result += " ";
            this.result += (this.method.bytes[i]+0x100).toString(16).substr(-2).toUpperCase(); // padded hex
        }
        this.result += "> " + instruction + "\n";
        this.oldPC = this.scanner.pc;
    }
},
'decoding', {
    blockReturnTop: function() {
    	this.print('blockReturn');
    },
    doDup: function() {
    	this.print('dup');
    },
    doPop: function() {
    	this.print('pop');
    },
	jump: function(offset) {
        this.print('jumpTo: ' + (this.scanner.pc + offset));
        if (this.scanner.pc + offset > this.endPC) this.endPC = this.scanner.pc + offset;
    },
    jumpIf: function(condition, offset) {
        this.print((condition ? 'jumpIfTrue: ' : 'jumpIfFalse: ') + (this.scanner.pc + offset));
        if (this.scanner.pc + offset > this.endPC) this.endPC = this.scanner.pc + offset;
    },
    methodReturnReceiver: function() {
        this.print('return: receiver');
        this.done = this.scanner.pc > this.endPC;
    },
    methodReturnTop: function() {
        this.print('return: topOfStack');
        this.done = this.scanner.pc > this.endPC;
    },
    methodReturnConstant: function(obj) {
        this.print('returnConst: ' + obj.toString());
        this.done = this.scanner.pc > this.endPC;
    },
    popIntoLiteralVariable: function(anAssociation) { 
    	this.print('popIntoBinding: ' + anAssociation.assnKeyAsString());
    },
    popIntoReceiverVariable: function(offset) { 
    	this.print('popIntoInstVar: ' + offset);
    },
    popIntoTemporaryVariable: function(offset) { 
    	this.print('popIntoTemp: ' + offset);
    },
	pushActiveContext: function() {
	    this.print('push: thisContext');
    },
    pushConstant: function(obj) {
        var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
        this.print('pushConst: ' + value);
    },
    pushLiteralVariable: function(anAssociation) {
    	this.print('pushBinding: ' + anAssociation.assnKeyAsString());
    },
	pushReceiver: function() {
	    this.print('push: self');
    },
    pushReceiverVariable: function(offset) { 
    	this.print('pushInstVar: ' + offset);
    },
	pushTemporaryVariable: function(offset) {
	    this.print('pushTemp: ' + offset);
    },
    send: function(selector, numberArguments, supered) {
    	this.print( (supered ? 'superSend: #' : 'send: #') + (selector.bytesAsString ? selector.bytesAsString() : selector));
    },
    storeIntoLiteralVariable: function(anAssociation) {
    	this.print('storeIntoBinding: ' + anAssociation.assnKeyAsString());
    },
    storeIntoReceiverVariable: function(offset) { 
    	this.print('storeIntoInstVar: ' + offset);
    },
	storeIntoTemporaryVariable: function(offset) {
	    this.print('storeIntoTemp: ' + offset);
    },
    pushNewArray: function(size) {
        this.print('push: (Array new: ' + size + ')');
    },
    popIntoNewArray: function(numElements) {
        this.print('pop: ' + numElements + ' into: (Array new: ' + numElements + ')');
    },
    pushRemoteTemp: function(offset , arrayOffset) {
        this.print('push: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    storeIntoRemoteTemp: function(offset , arrayOffset) {
        this.print('storeInto: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    popIntoRemoteTemp: function(offset , arrayOffset) {
        this.print('popInto: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    pushClosureCopy: function(numCopied, numArgs, blockSize) {
        var from = this.scanner.pc,
            to = from + blockSize;
        this.print('closure(' + from + '-' + (to-1) + '): ' + numCopied + ' captured, ' + numArgs + ' args');
        for (var i = from; i < to; i++)
    		this.innerIndents[i] = (this.innerIndents[i] || 0) + 1;
    	if (to > this.endPC) this.endPC = to;
	},
});

Object.subclass('Squeak.InstructionStream',
'initialization', {
    initialize: function(method, vm) {
        this.vm = vm;
        this.method = method;
        this.pc = 0;
        this.specialConstants = ['true', 'false', 'nil', '-1', '0', '1', '2'];
        this.specialSelectors = ['+', '-', '<', '>', '<=', '>=', '=', '~=', '*', '/', '\\', '@',
            'bitShift:', '//', 'bitAnd:', 'bitOr:', 'at:', 'at:put:', 'size', 'next', 'nextPut:',
            'atEnd', '==', 'class', 'blockCopy:', 'value', 'value:', 'do:', 'new', 'new:', 'x', 'y'];
        this.specialSelectorsNArgs = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 1,
            0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0];
    },
},
'decoding',
{
    interpretNextInstructionFor: function(client) {
    	// Send to the argument, client, a message that specifies the type of the next instruction.
    	var method = this.method;
    	var byte = method.bytes[this.pc++];
    	var type = (byte / 16) | 0;  
    	var offset = byte % 16;
    	if (type === 0) return client.pushReceiverVariable(offset);
    	if (type === 1) return client.pushTemporaryVariable(offset);
    	if (type === 2) return client.pushConstant(method.methodGetLiteral(offset));
    	if (type === 3) return client.pushConstant(method.methodGetLiteral(offset + 16));
    	if (type === 4) return client.pushLiteralVariable(method.methodGetLiteral(offset));
    	if (type === 5) return client.pushLiteralVariable(method.methodGetLiteral(offset + 16));
    	if (type === 6)
    		if (offset<8) return client.popIntoReceiverVariable(offset)
    		else return client.popIntoTemporaryVariable(offset-8);
    	if (type === 7) {
            if (offset===0) return client.pushReceiver()
			if (offset < 8) return client.pushConstant(this.specialConstants[offset - 1])
			if (offset===8) return client.methodReturnReceiver();
			if (offset < 12) return client.methodReturnConstant(this.specialConstants[offset - 9]);
			if (offset===12) return client.methodReturnTop();
			if (offset===13) return client.blockReturnTop();
			if (offset > 13) throw Error("unusedBytecode");
    	}
    	if (type === 8) return this.interpretExtension(offset, method, client);
    	if (type === 9) // short jumps
    			if (offset<8) return client.jump(offset+1);
    			else return client.jumpIf(false, offset-8+1);
    	if (type === 10) {// long jumps
    		byte = this.method.bytes[this.pc++];
			if (offset<8) return client.jump((offset-4)*256 + byte);
			else return client.jumpIf(offset<12, (offset & 3)*256 + byte);
    	}
    	if (type === 11)
            return client.send(this.specialSelectors[offset], 
				this.specialSelectorsNArgs[offset],
				false);
    	if (type === 12)
            return client.send(this.specialSelectors[offset+16], 
				this.specialSelectorsNArgs[offset+16],
				false);
    	if (type > 12)
    		return client.send(method.methodGetLiteral(offset), type-13, false);
    },
    interpretExtension: function(offset, method, client) {
    	if (offset <= 6) { // Extended op codes 128-134
    		var byte2 = this.method.bytes[this.pc++];
    		if (offset <= 2) { // 128-130:  extended pushes and pops
    			var type = byte2 / 64 | 0;
    			var offset2 = byte2 % 64;
    			if (offset === 0) {
    			    if (type === 0) return client.pushReceiverVariable(offset2);
    				if (type === 1) return client.pushTemporaryVariable(offset2);
    				if (type === 2) return client.pushConstant(this.method.methodGetLiteral(offset2));
    				if (type === 3) return client.pushLiteralVariable(this.method.methodGetLiteral(offset2));
    			}
    			if (offset === 1) {
    			    if (type === 0) return client.storeIntoReceiverVariable(offset2);
    				if (type === 1) return client.storeIntoTemporaryVariable(offset2);
    				if (type === 2) throw Error("illegalStore");
    				if (type === 3) return client.storeIntoLiteralVariable(this.method.methodGetLiteral(offset2));
    			}
    			if (offset === 2) {
        			if (type === 0) return client.popIntoReceiverVariable(offset2);
    				if (type === 1) return client.popIntoTemporaryVariable(offset2);
    				if (type === 2) throw Error("illegalStore");
    				if (type === 3) return client.popIntoLiteralVariable(this.method.methodGetLiteral(offset2));
    			}
    		}
    		// 131-134 (extended sends)
    		if (offset === 3) // Single extended send
    			return client.send(this.method.methodGetLiteral(byte2 % 32), byte2 / 32 | 0, false);
    		if (offset === 4) { // Double extended do-anything
    			var byte3 = this.method.bytes[this.pc++];
    			var type = byte2 / 32 | 0;
    			if (type === 0) return client.send(this.method.methodGetLiteral(byte3), byte2 % 32, false);
    			if (type === 1) return client.send(this.method.methodGetLiteral(byte3), byte2 % 32, true);
    			if (type === 2) return client.pushReceiverVariable(byte3);
    			if (type === 3) return client.pushConstant(this.method.methodGetLiteral(byte3));
    			if (type === 4) return client.pushLiteralVariable(this.method.methodGetLiteral(byte3));
    			if (type === 5) return client.storeIntoReceiverVariable(byte3);
    			if (type === 6) return client.popIntoReceiverVariable(byte3);
    			if (type === 7) return client.storeIntoLiteralVariable(this.method.methodGetLiteral(byte3));
    		}
    		if (offset === 5) // Single extended send to super
    			return client.send(this.method.methodGetLiteral(byte2 & 31), byte2 >> 5, true);
    		if (offset === 6) // Second extended send
    			return client.send(this.method.methodGetLiteral(byte2 & 63), byte2 >> 6, false);
    	}
    	if (offset === 7) return client.doPop();
    	if (offset === 8) return client.doDup();
    	if (offset === 9) return client.pushActiveContext();
        // closures
        var byte2 = this.method.bytes[this.pc++];
        if (offset === 10)
            return byte2 < 128 ? client.pushNewArray(byte2) : client.popIntoNewArray(byte2 - 128);
        if (offset === 11) throw Error("unusedBytecode");
        var byte3 = this.method.bytes[this.pc++];
        if (offset === 12) return client.pushRemoteTemp(byte2, byte3);
        if (offset === 13) return client.storeIntoRemoteTemp(byte2, byte3);
        if (offset === 14) return client.popIntoRemoteTemp(byte2, byte3);
        // offset === 15
        var byte4 = this.method.bytes[this.pc++];
        return client.pushClosureCopy(byte2 >> 4, byte2 & 0xF, (byte3 * 256) + byte4);
    }
});

}) // end of module
