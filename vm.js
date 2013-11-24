module('lib.squeak.vm').requires().toRun(function() {
/*
 * Copyright (c) 2013 Bert Freudenberg
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

Object.subclass('lib.squeak.vm.Constants',
'initialization', {
    initialize: function() {
        // object headers
        this.HeaderTypeMask = 3;
        this.HeaderTypeSizeAndClass = 0; //3-word header
        this.HeaderTypeClass = 1;        //2-word header
        this.HeaderTypeFree = 2;         //free block
        this.HeaderTypeShort = 3;        //1-word header
	    
        // Indices into SpecialObjects array
        this.splOb_NilObject = 0;
        this.splOb_FalseObject = 1;
        this.splOb_TrueObject = 2;
        this.splOb_SchedulerAssociation = 3;
        this.splOb_ClassBitmap = 4;
        this.splOb_ClassInteger = 5;
        this.splOb_ClassString = 6;
        this.splOb_ClassArray = 7;
        //this.splOb_SmalltalkDictionary = 8;  old slot 8
        this.splOb_ClassFloat = 9;
        this.splOb_ClassMethodContext = 10;
        this.splOb_ClassBlockContext = 11;
        this.splOb_ClassPoint = 12;
        this.splOb_ClassLargePositiveInteger = 13;
        this.splOb_TheDisplay = 14;
        this.splOb_ClassMessage = 15;
        this.splOb_ClassCompiledMethod = 16;
        this.splOb_TheLowSpaceSemaphore = 17;
        this.splOb_ClassSemaphore = 18;
        this.splOb_ClassCharacter = 19;
        this.splOb_SelectorDoesNotUnderstand = 20;
        this.splOb_SelectorCannotReturn = 21;
        this.splOb_TheInputSemaphore = 22;
        this.splOb_SpecialSelectors = 23;
        this.splOb_CharacterTable = 24;
        this.splOb_SelectorMustBeBoolean = 25;
        this.splOb_ClassByteArray = 26;
        this.splOb_ClassProcess = 27;
        this.splOb_CompactClasses = 28;
        this.splOb_TheTimerSemaphore = 29;
        this.splOb_TheInterruptSemaphore = 30;
        this.splOb_FloatProto = 31;
        this.splOb_SelectorCannotInterpret = 34;
        this.splOb_MethodContextProto = 35;
        this.splOb_BlockContextProto = 37;
        this.splOb_ExternalObjectsArray = 38;
        this.splOb_ClassPseudoContext = 39;
        this.splOb_ClassTranslatedMethod = 40;
        this.splOb_TheFinalizationSemaphore = 41;
        this.splOb_ClassLargeNegativeInteger = 42;
        this.splOb_ClassExternalAddress = 43;
        this.splOb_ClassExternalStructure = 44;
        this.splOb_ClassExternalData = 45;
        this.splOb_ClassExternalFunction = 46;
        this.splOb_ClassExternalLibrary = 47;
        this.splOb_SelectorAboutToReturn = 48;
        
        // Class layout:
        this.Class_superclass = 0;
        this.Class_mdict = 1;
        this.Class_format = 2;
        this.Class_name = 6;
        // Context layout:
        this.Context_sender = 0;
        this.Context_instructionPointer = 1;
        this.Context_stackPointer = 2;
        this.Context_method = 3;
        this.Context_receiver = 5;
        this.Context_tempFrameStart = 6;
        this.Context_smallFrameSize = 17;
        this.Context_largeFrameSize = 57;
        this.BlockContext_caller = 0;
        this.BlockContext_argumentCount = 3;
        this.BlockContext_initialIP = 4;
        this.BlockContext_home = 5;
        // Stream layout:
        this.Stream_array = 0;
        this.Stream_position = 1;
        this.Stream_limit = 2;
        //ProcessorScheduler layout:
        this.ProcSched_processLists = 0;
        this.ProcSched_activeProcess = 1;
        //Link layout:
        this.Link_nextLink = 0;
        //LinkedList layout:
        this.LinkedList_firstLink = 0;
        this.LinkedList_lastLink = 1;
        //Semaphore layout:
        this.Semaphore_excessSignals = 2;
        //Process layout:
        this.Proc_suspendedContext = 1;
        this.Proc_priority = 2;
        this.Proc_myList = 3;	
        // Association layout:
        this.Assn_key = 0;
        this.Assn_value = 1;
        // MethodDict layout:
        this.MethodDict_array = 1;
        this.MethodDict_selectorStart = 2;
        // Message layout
        this.Message_selector = 0;
        this.Message_arguments = 1;
        this.Message_lookupClass = 2;
        // Point layout:
        this.Point_x = 0;
        this.Point_y = 1;
        // LargetInteger layout:
        this.LargeInteger_bytes = 0;
        this.LargeInteger_neg = 1;
        // BitBlt layout:
        this.BitBlt_function = 0;
        this.BitBlt_gray = 1;
        this.BitBlt_destbits = 2;
        this.BitBlt_destraster = 3;
        this.BitBlt_destx = 4;
        this.BitBlt_desty = 5;
        this.BitBlt_width = 6;
        this.BitBlt_height = 7;
        this.BitBlt_sourcebits = 8;
        this.BitBlt_sourceraster = 9;
        this.BitBlt_sourcex = 10;
        this.BitBlt_sourcey = 11;
        this.BitBlt_clipx = 12;
        this.BitBlt_clipy = 13;
        this.BitBlt_clipwidth = 14;
        this.BitBlt_clipheight = 15;
        this.BitBlt_sourcefield = 16;
        this.BitBlt_destfield = 17;
        this.BitBlt_source = 18;
        this.BitBlt_dest = 19;
        // Form layout:
        this.Form_bits = 0;
        this.Form_width = 1;
        this.Form_height = 2;
        this.Form_depth = 3;
    },
});

var Constants = new lib.squeak.vm.Constants();

Object.subclass('lib.squeak.vm.Image',
'documentation', {
    about: function() {
    /*
    Object Format
    =============
    Each Squeak object is a lib.squeak.vm.Object, only SmallIntegers are JS numbers.
    Instance variables/fields reference other objects directly via the "pointers" property.
    {
        sqClass: reference to class object
        format: format word as in Squeak oop header
        hash: identity hash integer
        pointers: (optional) Array referencing inst vars + indexable fields
        bits: (optional) Array of numbers (bytes or words)
        float: (optional) float value if this is a Float object
        isNil: (optional) true if this is the nil object
        isTrue: (optional) true if this is the true object
        isFalse: (optional) true if this is the false object
        isFloat: (optional) true if this is a Float object
        isFloatClass: (optional) true if this is the Float class
    }

    Object Table
    ============
    Used for enumerating objects and GC.

    */    
    }
},
'reading', {
    readFromBuffer: function(buffer) {
        var data = new DataView(buffer),
            littleEndian = false,
            pos = 0;
        var readInt = function() {
            var int = data.getInt32(pos, littleEndian);
            pos += 4;
            return int;
        };
        // read version
        var version = readInt();
        if (version != 6502) {
            littleEndian = true; pos = 0;
            version = readInt();
            if (version != 6502) throw "bad image version";
        }
        // read header
        var headerSize = readInt();
        var endOfMemory = readInt(); //first unused location in heap
        var oldBaseAddr = readInt(); //object memory base address of image
        var specialObjectsOopInt = readInt(); //oop of array of special oops
        this.lastHash = readInt(); //Should be loaded from, and saved to the image header
        var savedWindowSize = readInt();
        var fullScreenFlag = readInt();
        var extraVMMemory = readInt();
        pos += headerSize - (9 * 4); //skip to end of header
        // read objects
        this.objectTable = new Array();
        var oopMap = {};
        for (var i = 0; i < endOfMemory; ) {
            var nWords = 0;
            var classInt = 0;
            var header = readInt();
            switch (header & Constants.HeaderTypeMask) {
                case Constants.HeaderTypeSizeAndClass:
                    nWords = header >> 2;
                    classInt = readInt();
                    header = readInt();
                    i += 12;
                    break;
                case Constants.HeaderTypeClass:
                    classInt = header - Constants.HeaderTypeClass;
                    header = readInt();
                    nWords = (header >> 2) & 63;
                    i += 8;
                    break;
                case Constants.HeaderTypeShort:
                    nWords = (header >> 2) & 63;
                    classInt = (header >> 12) & 31; //compact class index
                    //Note classInt<32 implies compact class index
                    i += 4;
                    break;
                case Constants.HeaderTypeFree:
                    throw "Unexpected free block";
            }
            var baseAddr = i - 4; //0-rel byte oop of this object (base header)
            nWords--;  //length includes base header which we have already read
            var format = ((header>>8) & 15);
            var hash = ((header>>17) & 4095);
            
            // Note classInt and bits are just raw data; no base addr adjustment and no int conversion
            var bits = new Array(nWords);
            for (var j = 0; j<nWords; j++)
                bits[j] = readInt();
            i += nWords*4;

            var object = new lib.squeak.vm.Object();
            object.initFromImage(classInt, format, hash, bits);
            this.registerObject(object);
            //oopMap is from old oops to new objects
            oopMap[oldBaseAddr + baseAddr] = object;
        }
        show("objects: "+ Object.keys(oopMap).length);
        //create proper objects
        var splObs         = oopMap[specialObjectsOopInt];
        var compactClasses = oopMap[splObs.bits[Constants.splOb_CompactClasses]].bits;
        var floatClass     = oopMap[splObs.bits[Constants.splOb_ClassFloat]];
        for (var oop in oopMap)
            oopMap[oop].installFromImage(oopMap, compactClasses, floatClass);
        this.specialObjectsArray = splObs;
        this.decorateKnownObjects();
     },
    decorateKnownObjects: function() {
        var splObjs = this.specialObjectsArray.pointers;
        splObjs[Constants.splOb_NilObject].isNil = true;
        splObjs[Constants.splOb_TrueObject].isTrue = true;
        splObjs[Constants.splOb_FalseObject].isFalse = true;
        splObjs[Constants.splOb_ClassFloat].isFloatClass = true;
    }

},
'object table', {
    registerObject: function(obj) {
        this.objectTable.push(obj);
    	this.lastHash = (13849 + (27181 * this.lastHash)) & 0xFFFFFFFF;
        return this.lastHash & 0xFFF;
    }
},
'allocating', {
    instantiateClass: function(aClass, indexableSize, filler) {
        var newObject = new lib.squeak.vm.Object();
        var hash = this.registerObject(newObject);
        newObject.initInstanceOf(aClass, indexableSize, hash, filler);
        return newObject;
    },
});

Object.subclass('lib.squeak.vm.Object',
'initialization', {
    initInstanceOf: function(aClass, indexableSize, hash, filler) {
        this.sqClass = aClass;
        this.hash = hash;
        var instSpec = aClass.getPointer(Constants.Class_format);
        var instSize = ((instSpec>>1) & 0x3F) + ((instSpec>>10) & 0xC0) - 1; //0-255
        this.format = (instSpec>>7) & 0xF; //This is the 0-15 code

        if (this.format < 8) {
            if (this.format != 6) {
                if (instSize + indexableSize > 0)
                    this.pointers = this.fillArray(instSize + indexableSize, filler);
            } else // Words
                if (indexableSize > 0)
                    if (aClass.isFloatClass) {
                        this.isFloat = true;
                        this.float = 0.0;
                    } else
                        this.bits = this.fillArray(indexableSize, 0); 
        } else // Bytes
            if (indexableSize > 0)
                this.bits = this.fillArray(indexableSize, 0); //Methods require further init of pointers

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
    initFromImage: function(cls, fmt, hsh, data) {
        // initial creation from Image, with unmapped data
        this.sqClass = cls;
        this.format = fmt;
        this.hash = hsh;
        this.bits = data;
    },
    installFromImage: function(oopMap, ccArray, floatClass) {
        //Install this object by decoding format, and rectifying pointers
        var ccInt = this.sqClass;
        // map compact classes
        if ((ccInt>0) && (ccInt<32))
            this.sqClass = oopMap[ccArray[ccInt-1]];
        else
            this.sqClass = oopMap[ccInt];
        var nWords= this.bits.length;
        if (this.format < 5) {
            //Formats 0...4 -- Pointer fields
            if (nWords > 0)
                this.pointers = this.decodePointers(nWords, this.bits, oopMap);
            delete this.bits; }
        else if (this.format >= 12) {
            //Formats 12-15 -- CompiledMethods both pointers and bits
            var methodHeader = this.bits[0];
            var numLits = (methodHeader>>10) & 255;
            this.isCompiledMethod = true;
            this.pointers = this.decodePointers(numLits+1, this.bits, oopMap); //header+lits
            this.bits = this.decodeBytes(nWords-(numLits+1), this.bits, numLits+1, this.format & 3); }
        else if (this.format >= 8) {
            //Formats 8..11 -- ByteArrays (and Strings)
            this.bits = this.decodeBytes(nWords, this.bits, 0, this.format & 3); }
        //Format 6 word objects are already OK (except Floats...)
        else if (this.sqClass == floatClass) {
            //Floats need two ints to be converted to double
            this.isFloat = true;
            this.float = this.decodeFloat(this.bits);
            delete this.bits }
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
    decodeBytes: function(nWords, theBits, wordOffset, fmtLowBits) {
        //Adjust size for low bits and extract bytes from ints
        if (nWords == 0)
            return null;
        var nBytes = (nWords * 4) - fmtLowBits;
        var newBits = [];
        var wordIx = wordOffset;
        var fourBytes = 0;
        for (var i = 0; i < nBytes; i++) {
            if ((i & 3) === 0)
                fourBytes = theBits[wordIx++];
            newBits[i] = (fourBytes>>(8*(3-(i&3))))&255;
        }
        return newBits;
    },
    decodeFloat: function(theBits) {
        var buffer = new ArrayBuffer(8);
        var data = new DataView(buffer);
        data.setUint32(0, theBits[0], false);
        data.setUint32(4, theBits[1], false);
        var float = data.getFloat64(0, false);
        return float;
    },
    fillArray: function(length, filler) {
        for (var array = [], i = 0; i < length; i++)
            array[i] = filler;
        return array;
    },
},
'printing', {
    toString: function() {
        return Strings.format('sqObj(%s)',
            this.sqClass.constructor == lib.squeak.vm.Object ? this.sqInstName() : this.sqClass);
    },
    bitsAsString: function() {
        return this.bits.map(function(char) { return String.fromCharCode(char); }).join('');
    },
    assnKeyAsString: function() {
        return this.getPointer(Constants.Assn_key).bitsAsString();  
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
        var className = this.sqClass.className();
        if (/ /.test(className))
            return 'the ' + className;
        var inst = '';
        switch (className) {
            case 'String':
            case 'ByteString':
            case 'WideString':
            case 'Symbol':
            case 'WideSymbol':
            case 'ByteSymbol':
                inst = ' "'+this.bitsAsString()+'"'; break;            
        }
        return  (/^[aeiou]/i.test(className) ? 'an ' + className : 'a ' + className) + inst;
    },
},
'accessing', {
    getPointer: function(zeroBasedIndex){
        return this.pointers[zeroBasedIndex];
    },
    setPointer: function(zeroBasedIndex, value){
        return this.pointers[zeroBasedIndex] = value;
    },
    pointersSize: function() {
    	return this.pointers ? this.pointers.length : 0;
    },
    bitsSize: function() {
        if (this.bits) return this.bits.length;
        if (this.isFloat) return 2;
        return 0;
    },
    instSize: function() {//same as class.classInstSize, but faster from format
        if (this.format>4 || this.format==2) return 0; //indexable fields only
        if (this.format<2) return this.pointers.length; //indexable fields only
        return this.sqClass.classInstSize(); //0-255
    },
},
'as class', {
    classInstSize: function() {
        // this is a class, answer number of named inst vars
        var format = this.getPointer(Constants.Class_format);
        return ((format >> 10) & 0xC0) + ((format >> 1) & 0x3F) - 1;
    },
    instVarNames: function() {
        return (this.getPointer(4).pointers || []).map(function(each) {
            return each.bitsAsString();
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
        return this.getPointer(0);
    },
    className: function() {
        var nameOrNonMetaClass = this.getPointer(Constants.Class_name);
        var isMeta = !nameOrNonMetaClass.bits;
        var nameObj = isMeta ? nameOrNonMetaClass.getPointer(Constants.Class_name) : nameOrNonMetaClass;
        var name = nameObj.bitsAsString();
        return isMeta ? name + " class" : name;
    }
},
'as method', {
    methodHeader: function() {
        return this.getPointer(0);
    },
    methodNumLits: function() {
        return (this.methodHeader()>>9) & 0xFF;
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
        var assn = this.getPointer(this.methodNumLits());
        return assn.getPointer(Constants.Assn_value);
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
        return this.getPointer(1+zeroBasedIndex); // step over header
    },
    methodGetSelector: function(zeroBasedIndex) {
        return this.getPointer(1+zeroBasedIndex); // step over header 
    },
    methodSetLiteral: function(zeroBasedIndex, value) {
        this.setPointer(1+zeroBasedIndex, value); // step over header
    },
    methodEndPC: function() {
    	// index after the last bytecode
    	var length = this.bits.length;
    	var flagByte = this.bits[length - 1];
    	if (flagByte === 0) // If last byte == 0, may be either 0, 0, 0, 0 or just 0
    		for (var i = 2; i <= 5 ; i++) 
    		    if (this.bits[length - i] !== 0)
    		        return length - i + 1;
    	if (flagByte < 252) // Magic sources (tempnames encoded in last few bytes)
    	    return length - flagByte - 1;
    	// Normal 4-byte source pointer
    	return length - 4;
    }
});

Object.subclass('lib.squeak.vm.Interpreter',
'initialization', {
    initialize: function(image) {
        this.image = image;
        //this.image.bindVM(this);
        this.primHandler = new lib.squeak.vm.Primitives(this);
        this.loadImageState();
        this.initVMState();
        this.loadInitialContext();
    },
    loadImageState: function() {
        this.specialObjects = this.image.specialObjectsArray.pointers;
        this.specialSelectors = this.specialObjects[Constants.splOb_SpecialSelectors].pointers;
        this.nilObj = this.specialObjects[Constants.splOb_NilObject];
        this.falseObj = this.specialObjects[Constants.splOb_FalseObject];
        this.trueObj = this.specialObjects[Constants.splOb_TrueObject];
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
        this.semaphoresUseBufferA = true;
        this.semaphoresToSignalCountA = 0;
        this.semaphoresToSignalCountB = 0;
        this.deferDisplayUpdates = false;
        this.pendingFinalizationSignals = 0;
        this.freeContexts = this.nilObj;
        this.freeLargeContexts = this.nilObj;
        this.reclaimableContextCount = 0;
        this.nRecycledContexts = 0;
        this.nAllocatedContexts = 0;
    },
    loadInitialContext: function() {
        var schedAssn = this.specialObjects[Constants.splOb_SchedulerAssociation];
        var sched = schedAssn.getPointer(Constants.Assn_value);
        var proc = sched.getPointer(Constants.ProcSched_activeProcess);
        this.activeContext = proc.getPointer(Constants.Proc_suspendedContext);
        this.fetchContextRegisters(this.activeContext);
        this.reclaimableContextCount = 0;
    },
},
'interpreting', {
    interpretOne: function() {
        var b, b2;
        this.byteCodeCount++;
        b = this.nextByte();
        switch (b) { /* The Main Bytecode Dispatch Loop */

            // load receiver variable
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: 
            case 8: case 9: case 10: case 11: case 12: case 13: case 14: case 15: 
                this.push(this.receiver.getPointer(b&0xF)); break;

            // load temporary variable
            case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 23: 
            case 24: case 25: case 26: case 27: case 28: case 29: case 30: case 31: 
                this.push(this.homeContext.getPointer(Constants.Context_tempFrameStart+(b&0xF))); break;

            // loadLiteral
            case 32: case 33: case 34: case 35: case 36: case 37: case 38: case 39: 
            case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47: 
            case 48: case 49: case 50: case 51: case 52: case 53: case 54: case 55: 
            case 56: case 57: case 58: case 59: case 60: case 61: case 62: case 63: 
                this.push(this.method.methodGetLiteral(b&0x1F)); break;

            // loadLiteralIndirect
            case 64: case 65: case 66: case 67: case 68: case 69: case 70: case 71: 
            case 72: case 73: case 74: case 75: case 76: case 77: case 78: case 79: 
            case 80: case 81: case 82: case 83: case 84: case 85: case 86: case 87: 
            case 88: case 89: case 90: case 91: case 92: case 93: case 94: case 95: 
                this.push((this.method.methodGetLiteral(b&0x1F)).getPointer(Constants.Assn_value)); break;

            // storeAndPop rcvr, temp
            case 96: case 97: case 98: case 99: case 100: case 101: case 102: case 103: 
                this.receiver.setPointer(b&7, this.pop()); break;
            case 104: case 105: case 106: case 107: case 108: case 109: case 110: case 111: 
                this.homeContext.setPointer(Constants.Context_tempFrameStart+(b&7), this.pop()); break;

            // Quick push constant
            case 112: this.push(this.receiver); break;
            case 113: this.push(this.trueObj); break;
            case 114: this.push(this.falseObj); break;
            case 115: this.push(this.nilObj); break;
            case 116: this.push(this.smallFromInt(-1)); break;
            case 117: this.push(this.smallFromInt(0)); break;
            case 118: this.push(this.smallFromInt(1)); break;
            case 119: this.push(this.smallFromInt(2)); break;

            // Quick return
            case 120: this.doReturn(this.receiver, this.homeContext.getPointer(Constants.Context_sender)); break;
            case 121: this.doReturn(this.trueObj, this.homeContext.getPointer(Constants.Context_sender)); break;
            case 122: this.doReturn(this.falseObj, this.homeContext.getPointer(Constants.Context_sender)); break;
            case 123: this.doReturn(this.nilObj, this.homeContext.getPointer(Constants.Context_sender)); break;
            case 124: this.doReturn(this.pop(), this.homeContext.getPointer(Constants.Context_sender)); break;
            case 125: this.doReturn(this.pop(), this.activeContext.getPointer(Constants.BlockContext_caller)); break;
            case 126: this.nono(); break;
            case 127: this.nono(); break;

            // Sundry
            case 128: this.extendedPush(this.nextByte()); break;
            case 129: this.extendedStore(this.nextByte()); break;
            case 130: this.extendedStorePop(this.nextByte()); break;
            // singleExtendedSend
            case 131: b2 = this.nextByte(); this.send(this.method.methodGetSelector(b2&31), b2>>5, false); break;
            case 132: this.doubleExtendedDoAnything(this.nextByte()); break;
            // singleExtendedSendToSuper
            case 133: b2= this.nextByte(); this.send(this.method.methodGetSelector(b2&31), b2>>5, true); break;
            // secondExtendedSend
            case 134: b2= this.nextByte(); this.send(this.method.methodGetSelector(b2&63), b2>>6, false); break;
            case 135: this.pop(); break;	// pop
            case 136: this.push(this.top()); break;	// dup
            // thisContext
            case 137: this.push(this.activeContext); this.reclaimableContextCount = 0; break;

            //Unused...
            case 138: case 139: case 140: case 141: case 142: case 143: 
                this.nono(); break;

            // Short jmp
            case 144: case 145: case 146: case 147: case 148: case 149: case 150: case 151: 
                this.pc += (b&7)+1; break;
            // Short conditional jump on false
            case 152: case 153: case 154: case 155: case 156: case 157: case 158: case 159: 
                this.jumpIfFalse((b&7)+1); break;
            // Long jump, forward and back
            case 160: case 161: case 162: case 163: case 164: case 165: case 166: case 167: 
                b2 = this.nextByte();
                this.pc += (((b&7)-4)*256 + b2);
                if ((b&7)<4) this.checkForInterrupts();  //check on backward jumps (loops)
                break;
            // Long conditional jump on true
            case 168: case 169: case 170: case 171:
                this.jumpIfTrue((b&3)*256 + this.nextByte()); break;
            // Long conditional jump on false
            case 172: case 173: case 174: case 175: 
                this.jumpIfFalse((b&3)*256 + this.nextByte()); break;

            // Arithmetic Ops... + - < > <= >= = ~=    * / \ @ lshift: lxor: land: lor:
            case 176: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) + this.stackInteger(0))) this.sendSpecial(b&0xF); break;	// PLUS +
            case 177: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) - this.stackInteger(0))) this.sendSpecial(b&0xF); break;	// PLUS +
            case 178: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackInteger(1) < this.stackInteger(0))) this.sendSpecial(b&0xF); break;  // LESS <
            case 179: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackInteger(1) > this.stackInteger(0))) this.sendSpecial(b&0xF); break;  // GRTR >
            case 180: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackInteger(1) <= this.stackInteger(0))) this.sendSpecial(b&0xF); break;  // LEQ <=
            case 181: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackInteger(1) >= this.stackInteger(0))) this.sendSpecial(b&0xF); break;  // GEQ >=
            case 182: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackInteger(1) === this.stackInteger(0))) this.sendSpecial(b&0xF); break;  // EQU =
            case 183: this.success = true;
                if(!this.pop2AndPushBoolResult(this.stackInteger(1) !== this.stackInteger(0))) this.sendSpecial(b&0xF); break;  // NEQ ~=
            case 184: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) * this.stackInteger(0))) this.sendSpecial(b&0xF); break;  // TIMES *
            case 185: this.success = true;
                if(!this.pop2AndPushIntResult(this.quickDivide(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); break;  // Divide /
            case 186: this.success = true;
                if(!this.pop2AndPushIntResult(this.mod(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); break;  // MOD \\
            case 187: this.success = true;
                if(!this.primHandler.primitiveMakePoint()) this.sendSpecial(b&0xF); break;  // MakePt int@int
            case 188: this.success = true;
                if(!this.pop2AndPushIntResult(this.safeShift(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); break; // bitShift:
            case 189: this.success = true;
                if(!this.pop2AndPushIntResult(this.div(this.stackInteger(1),this.stackInteger(0)))) this.sendSpecial(b&0xF); break;  // Divide //
            case 190: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) & this.stackInteger(0))) this.sendSpecial(b&0xF); break; // bitAnd:
            case 191: this.success = true;
                if(!this.pop2AndPushIntResult(this.stackInteger(1) | this.stackInteger(0))) this.sendSpecial(b&0xF); break; // bitOr:

            // at:, at:put:, size, next, nextPut:, ...
            case 192: case 193: case 194: case 195: case 196: case 197: case 198: case 199: 
            case 200: case 201: case 202: case 203: case 204: case 205: case 206: case 207: 
                if (!this.primHandler.quickSendOther(this.receiver, b&0xF))
                    this.sendSpecial((b&0xF)+16); break;

            // Send Literal Selector with 0, 1, and 2 args
            case 208: case 209: case 210: case 211: case 212: case 213: case 214: case 215: 
            case 216: case 217: case 218: case 219: case 220: case 221: case 222: case 223: 
                this.send(this.method.methodGetSelector(b&0xF), 0, false); break;
            case 224: case 225: case 226: case 227: case 228: case 229: case 230: case 231: 
            case 232: case 233: case 234: case 235: case 236: case 237: case 238: case 239: 
                this.send(this.method.methodGetSelector(b&0xF), 1, false); break;
            case 240: case 241: case 242: case 243: case 244: case 245: case 246: case 247: 
            case 248: case 249: case 250: case 251: case 252: case 253: case 254: case 255:
                this.send(this.method.methodGetSelector(b&0xF), 2, false); break;
        }
    },
    interpret: function() {
        while(true)
            this.interpretOne();
    },
    nextByte: function() {
        return this.methodBytes[this.pc++] & 0xFF;
    },
    nono: function() {
        throw "Oh No!";
    },
    checkForInterrupts: function() {
        // TODO
    },
    extendedStore: function( nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.receiver.setPointer(lobits, this.top()); break;
            case 1: this.homeContext.setPointer(Constants.Context_tempFrameStart+lobits, this.top()); break;
            case 2: this.nono(); break;
            case 3: this.method.methodGetLiteral(lobits).setPointer(Constants.Assn_value, this.top()); break;
        }
    },
    extendedStorePop: function( nextByte) {
        var lobits = nextByte & 63;
        switch (nextByte>>6) {
            case 0: this.receiver.setPointer(lobits, this.pop()); break;
            case 1: this.homeContext.setPointer(Constants.Context_tempFrameStart+lobits, this.pop()); break;
            case 2: this.nono(); break;
            case 3: this.method.methodGetLiteral(lobits).setPointer(Constants.Assn_value, this.pop()); break;
        }
    },
    jumpIfTrue: function(delta) {
        var top = this.pop();
        if (top.isTrue) {this.pc += delta; return;}
        if (top.isFalse) return;
        this.push(top); //Uh-oh it's not even a boolean (that we know of ;-).  Restore stack...
        this.send(this.specialObjects[Constants.splOb_SelectorMustBeBoolean], 1, false);
    },
    jumpIfFalse: function(delta) {
        var top = this.pop();
        if (top.isFalse) {this.pc += delta; return;}
        if (top.isTrue) return;
        this.push(top); //Uh-oh it's not even a boolean (that we know of ;-).  Restore stack...
        this.send(this.specialObjects[Constants.splOb_SelectorMustBeBoolean], 1, false);
    },
    send: function(selector, argCount, doSuper) {
        var newRcvr = this.stackValue(argCount);
        var lookupClass = this.getClass(newRcvr);
        if (doSuper) {
            lookupClass = this.method.methodClassForSuper();
            lookupClass = lookupClass.getPointer(Constants.Class_superclass);
        }
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        this.executeNewMethod(newRcvr, entry.method, argCount, entry.primIndex);
    },
    findSelectorInClass: function(selector, argCount, startingClass) {
        var cacheEntry = {};//this.findMethodCacheEntry(selector, startingClass);
        if (cacheEntry.method) return cacheEntry; // Found it in the method cache
        var currentClass = startingClass;
        var mDict;
        while (!currentClass.isNil) {
            mDict = currentClass.getPointer(Constants.Class_mdict);
            if (mDict.isNil) {
//                ["MethodDict pointer is nil (hopefully due a swapped out stub)
//                        -- raise exception #cannotInterpret:."
//                self createActualMessageTo: class.
//                messageSelector _ self splObj: SelectorCannotInterpret.
//                ^ self lookupMethodInClass: (self superclassOf: currentClass)]
                throw "cannotInterpret";
            }
            var newMethod = this.lookupSelectorInDict(mDict, selector);
            if (!newMethod.isNil) {
                //load cache entry here and return
                cacheEntry.method = newMethod;
                cacheEntry.primIndex = newMethod.methodPrimitiveIndex();
                return cacheEntry;
            }  
            currentClass = currentClass.getPointer(Constants.Class_superclass);
        }
    	//Cound not find a normal message -- send #doesNotUnderstand:
    	var dnuSel = this.specialObjects[Constants.splOb_SelectorDoesNotUnderstand];
        if (selector === dnuSel) // Cannot find #doesNotUnderstand: -- unrecoverable error.
	    	throw "Recursive not understood error encountered";
    	var dnuMsg = this.createActualMessage(selector, argCount, startingClass); //The argument to doesNotUnderstand:
    	this.popNandPush(argCount, dnuMsg);
        return this.findSelectorInClass(dnuSel, 1, startingClass);
    },
    lookupSelectorInDict: function(mDict, messageSelector) {
        //Returns a method or nilObject
        var dictSize = mDict.pointersSize();
        var mask = (dictSize - Constants.MethodDict_selectorStart) - 1;
        var index = (mask & messageSelector.hash) + Constants.MethodDict_selectorStart;
    	// If there are no nils (should always be), then stop looping on second wrap.
    	var hasWrapped = false;
        while (true) {
            var nextSelector = mDict.getPointer(index);
            if (nextSelector === messageSelector) {
                var methArray = mDict.getPointer(Constants.MethodDict_array);
                return methArray.getPointer(index - Constants.MethodDict_selectorStart);
            }
            if (nextSelector.isNil) return this.nilObj;
            if (++index === dictSize) {
                if (hasWrapped) return this.nilObj;
                index = Constants.MethodDict_selectorStart;
                hasWrapped = true;
            }
        }
    },
    executeNewMethod: function(newRcvr, newMethod, argumentCount, primitiveIndex) {
        this.sendCount++;
        if (primitiveIndex>0)
            if (this.tryPrimitive(primitiveIndex, argumentCount))
                return;  //Primitive succeeded -- end of story
        var newContext = this.allocateOrRecycleContext(newMethod.methodNeedsLargeFrame());
        var methodNumLits = this.method.methodNumLits();
        //The stored IP should be 1-based index of *next* instruction, offset by hdr and lits
        var newPC = 0;
    	var tempCount = newMethod.methodTempCount();
        var newSP = tempCount;
        newSP += Constants.Context_tempFrameStart - 1; //-1 for z-rel addressing
        newContext.setPointer(Constants.Context_method, newMethod);
        //Following store is in case we alloc without init; all other fields get stored
        newContext.setPointer(Constants.BlockContext_initialIP, this.nilObj);
        newContext.setPointer(Constants.Context_sender, this.activeContext);
        //Copy receiver and args to new context
        //Note this statement relies on the receiver slot being contiguous with args...
        this.arrayCopy(this.activeContext.pointers, this.sp-argumentCount, newContext.pointers, Constants.Context_tempFrameStart-1, argumentCount+1);
        //...and fill the remaining temps with nil
        this.arrayFill(newContext.pointers, Constants.Context_tempFrameStart+argumentCount, Constants.Context_tempFrameStart+tempCount, this.nilObj);
        this.popN(argumentCount+1);
	    this.reclaimableContextCount++;
        this.storeContextRegisters();
        /////// Woosh //////
        this.activeContext = newContext; //We're off and running...            
        //Following are more efficient than fetchContextRegisters() in newActiveContext()
        this.homeContext = newContext;
        this.method = newMethod;
        this.methodBytes = newMethod.bits;
        this.pc = newPC;
        this.sp = newSP;
        this.storeContextRegisters(); // not really necessary, I claim
        this.receiver = newContext.getPointer(Constants.Context_receiver);
        if (this.receiver !== newRcvr)
            throw "what?!";
        this.checkForInterrupts();
    },
    doReturn: function(returnValue, targetContext) {
        if (targetContext.isNil || targetContext.getPointer(Constants.Context_instructionPointer).isNil)
            this.cannotReturn();
        // search up stack for unwind
        var thisContext = this.activeContext;
        while (thisContext !== targetContext) {
            if (thisContext.isNil)
                this.cannotReturn();
            if (this.isUnwindMarked(thisContext))
                this.aboutToReturn(returnValue,thisContext);
            thisContext = thisContext.getPointer(Constants.Context_sender);
        }
        // no unwind to worry about, just peel back the stack (usually just to sender)
        var nextContext;
        thisContext = this.activeContext;
        while (thisContext !== targetContext) {
            nextContext = thisContext.getPointer(Constants.Context_sender);
            thisContext.setPointer(Constants.Context_sender, this.nilObj);
            thisContext.setPointer(Constants.Context_instructionPointer, this.nilObj);
            if (this.reclaimableContextCount > 0) {
                this.reclaimableContextCount--;
                this.recycleIfPossible(thisContext);
            }
            thisContext = nextContext;
        }
        this.activeContext = thisContext;
        this.fetchContextRegisters(this.activeContext);
        this.push(returnValue);
        console.log("***returning " + returnValue.toString());
    },
    tryPrimitive: function(primIndex, argCount) {
        if ((primIndex > 255) && (primIndex < 520)) {
            if (primIndex >= 264) {//return instvars
                this.popNandPush(1, this.top().getPointer(primIndex - 264));
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
        var success = this.primHandler.doPrimitive(primIndex, argCount);
        return success;
    },
    recycleIfPossible: function(ctxt) {
        if (!this.isMethodContext(ctxt)) return;
        if (ctxt.pointersSize() === (Constants.Context_tempFrameStart+Constants.Context_smallFrameSize)) {
            // Recycle small contexts
            ctxt.setPointer(0, this.freeContexts);
            this.freeContexts = ctxt;
        } else { // Recycle large contexts
            if (ctxt.pointersSize() !== (Constants.Context_tempFrameStart+Constants.Context_largeFrameSize))
                return;
            ctxt.setPointer(0, this.freeLargeContexts);
            this.freeLargeContexts = ctxt;
        }
    },
    allocateOrRecycleContext: function(needsLarge) {
        //Return a recycled context or a newly allocated one if none is available for recycling."
        var freebie;
        if (needsLarge) {
            if (!this.freeLargeContexts.isNil) {
                freebie = freeLargeContexts;
                freeLargeContexts = freebie.getPointer(0);
                this.nRecycledContexts++;
                return freebie;
            }
            this.nAllocatedContexts++;
            return this.instantiateClass(this.specialObjects[Constants.splOb_ClassMethodContext], Constants.Context_largeFrameSize);
        } else {
            if (!this.freeContexts.isNil) {
                freebie = this.freeContexts;
                this.freeContexts = freebie.getPointer(0);
                this.nRecycledContexts++;
                return freebie;
            }
            this.nAllocatedContexts++;
            return this.instantiateClass(this.specialObjects[Constants.splOb_ClassMethodContext], Constants.Context_smallFrameSize);
        }
    },
    instantiateClass: function(aClass, indexableSize) {
        return this.image.instantiateClass(aClass, indexableSize, this.nilObj);
    }
},
'contexts', {
    isContext: function(obj) {//either block or methodContext
        if (obj.sqClass === this.specialObjects[Constants.splOb_ClassMethodContext]) return true;
        if (obj.sqClass === this.specialObjects[Constants.splOb_ClassBlockContext]) return true;
        return false;
    },
    isMethodContext: function(obj) {
        if (obj.sqClass === this.specialObjects[Constants.splOb_ClassMethodContext]) return true;
        return false;
    },
    isUnwindMarked: function(ctx) {
        return false;
    },
    fetchContextRegisters: function(ctxt) {
        var meth = ctxt.getPointer(Constants.Context_method);
        if (this.isSmallInt(meth)) { //if the Method field is an integer, activeCntx is a block context
            this.homeContext = ctxt.getPointer(Constants.BlockContext_home);
            meth = this.homeContext.getPointer(Constants.Context_method);
        } else { //otherwise home==ctxt
            this.homeContext = ctxt;
        }
        this.receiver = this.homeContext.getPointer(Constants.Context_receiver);
        this.method = meth;
        this.methodBytes = meth.bits;
        this.pc = this.decodeSqueakPC(ctxt.getPointer(Constants.Context_instructionPointer), meth);
        if (this.pc < -1)
            throw "error";
        this.sp = this.decodeSqueakSP(ctxt.getPointer(Constants.Context_stackPointer));
    },
    storeContextRegisters: function() {
        //Save pc, sp into activeContext object, prior to change of context
        //   see fetchContextRegisters for symmetry
        //   expects activeContext, pc, sp, and method state vars to still be valid
        this.activeContext.setPointer(Constants.Context_instructionPointer,this.encodeSqueakPC(this.pc, this.method));
        this.activeContext.setPointer(Constants.Context_stackPointer,this.encodeSqueakSP(this.sp));
    },
    encodeSqueakPC: function(intPC, method) {
        // Squeak pc is offset by header and literals
        // and 1 for z-rel addressing
        return intPC + (((method.methodNumLits()+1)*4) + 1);
    },
    decodeSqueakPC: function(squeakPC, method) {
        return squeakPC - (((method.methodNumLits()+1)*4) + 1);
    },
    encodeSqueakSP: function(intSP) {
        // sp is offset by tempFrameStart, -1 for z-rel addressing
        return intSP - (Constants.Context_tempFrameStart - 1);
    },
    decodeSqueakSP: function(squeakPC) {
        return squeakPC + (Constants.Context_tempFrameStart - 1);
    },
},
'stack frame access', {
    pop: function() {
        //Note leaves garbage above SP.  Serious reclaim should store nils above SP
        return this.activeContext.pointers[this.sp--];  
    },
    popN: function(nToPop) {
        this.sp -= nToPop;
    },
    push: function(oop) {
        this.activeContext.pointers[++this.sp] = oop;
    },
    popNandPush: function(nToPop, oop) {
        this.activeContext.pointers[this.sp -= nToPop - 1] = oop;
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
    pop2AndPushIntResult: function(intResult) {// returns success boolean
        if (this.success && this.canBeSmallInt(intResult)) {
            this.popNandPush(2, intResult);
            return true;
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
            return this.specialObjects[Constants.splOb_ClassInteger];
        return obj.sqClass;
    },
    canBeSmallInt: function(anInt) {
        return (anInt >= this.minSmallInt) && (anInt <= this.maxSmallInt);
    },
    isSmallInt: function(object) {
        return typeof object === "number";
    },
    checkSmallInt: function(maybeSmall) { // returns an int and sets success
        if (this.isSmallInt(maybeSmall))
            return maybeSmall;
        this.success = false;
        return 1;
    },
    quickDivide: function(rcvr, arg) { // must only handle exact case
        if (arg === 0) return this.nonSmallInt;  // fail if divide by zero
        var result = rcvr/arg;
        if (result*arg === rcvr) return result;
        return this.nonSmallInt;     // fail if result is not exact
    },
    div: function(rcvr, arg) {
        if (arg === 0) return this.nonSmallInt;  // fail if divide by zero
        return Math.floor(rcvr/arg);
    },
    mod: function(rcvr, arg) {
        if (arg === 0) return this.nonSmallInt;  // fail if divide by zero
        return rcvr - Math.floor(rcvr/arg) * arg;
    },
    safeShift: function(bitsToShift, shiftCount) {
        if (shiftCount<0) return bitsToShift>>-shiftCount; //OK to lose bits shifting right
        //check for lost bits by seeing if computation is reversible
        var shifted = bitsToShift<<shiftCount;
        if  ((shifted>>shiftCount) === bitsToShift) return shifted;
        return this.nonSmallInt;  //non-small result will cause failure
    },
},
'utils',
{
    arrayFill: function(array, fromIndex, toIndex, value) {
        // assign value to range from fromIndex (inclusive) to toIndex (exclusive)
        for (var i = fromIndex; i < toIndex; i++)
            array[i] = value;
    },
    arrayCopy: function(src, srcPos, dest, destPos, length) {
        // copy length elements from src at srcPos to dest at destPos
        for (var i = 0; i < length; i++)
            dest[destPos + i] = src[srcPos + i];
    }
});

Object.subclass('lib.squeak.vm.Primitives',
'initialization', {
    initialize: function(vm) {
        this.vm = vm;
    }
},
'dispatch', {
    quickSendOther: function(rcvr, lobits) {
        // returns true if it succeeds
        this.success = true;
        switch (lobits) {
            //case 0x0: // at:
            //case 0x1: // at:put:
            //case 0x2: // size
            //case 0x3: // next
            //case 0x4: // nextPut:
            //case 0x5: // atEnd
            case 0x6: return this.pop2andPushBoolIfOK(this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 0x7: return this.popNandPushIfOK(1,this.vm.getClass(this.vm.top())); // class
            //case 0x8: return this.popNandPushIfOK(2,this.primitiveBlockCopy()); // blockCopy:
            //case 0x9: return this.primitiveBlockValue(0); // value
            //case 0xa: return this.primitiveBlockValue(1); // value:
            //case 0xb: // do:
            //case 0xc: // new
            //case 0xd: // new:
            //case 0xe: // x
            //case 0xf: // y
        }
        throw "quick prim " + lobits + " not implemented yet";
        return false;
    },
    doPrimitive: function(index, argCount) {
        this.success= true;
        switch (index) {
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
            case 13: return this.popNandPushIntIfOK(2,this.doQuo(this.stackInteger(1),this.stackInteger(0)));  // Integer.quo
            case 14: return this.popNandPushIfOK(2,this.doBitAnd());  // SmallInt.bitAnd
            case 15: return this.popNandPushIfOK(2,this.doBitOr());  // SmallInt.bitOr
            case 16: return this.popNandPushIfOK(2,this.doBitXor());  // SmallInt.bitXor
            case 17: return this.popNandPushIfOK(2,this.doBitShift());  // SmallInt.bitShift
            case 18: return this.primitiveMakePoint(argCount);
            case 40: return this.primitiveAsFloat(argCount);
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
            case 101: return this.primitiveBeCursor(argCount); // Cursor.beCursor
            case 102: return this.primitiveBeDisplay(argCount); // DisplayScreen.beDisplay
        }
        throw "primitive " + index + " not implemented yet"
        return false;
    },
},
'stack access', {
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
    makeFloat: function(value) {
        var floatClass = this.vm.specialObjects[Constants.splOb_ClassFloat];
        var newFloat = this.vm.instantiateClass(floatClass, 2);
        newFloat.float = value;
        return newFloat;
	},
    stackInteger: function(nDeep) {
        return this.checkSmallInt(this.vm.stackValue(nDeep));
    },
    checkSmallInt: function(maybeSmall) { // returns an int and sets success
        if (this.vm.isSmallInt(maybeSmall))
            return maybeSmall;
        this.success = false;
        return 0;
    },
    stackFloat: function(nDeep) {
        return this.checkFloat(this.vm.stackValue(nDeep));
    },
    checkFloat: function(maybeFloat) { // returns a float and sets success
        if (maybeFloat.isFloat)
            return maybeFloat.float;
        this.success = false;
        return 0.0;
    },
    safeFDiv: function(dividend, divisor) {
        if (divisor === 0.0) {
            this.success = false;
            return 1.0;
        }
        return dividend / divisor;
    }
});

Object.subclass('lib.squeak.vm.InstructionPrinter',
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
        this.result = '';
        this.scanner = new lib.squeak.vm.InstructionStream(this.method, this.vm);
        this.oldPC = this.scanner.pc;
        var end = this.method.methodEndPC();
    	while (this.scanner.pc < end)
        	this.scanner.interpretNextInstructionFor(this);
        return this.result;
    },
    print: function(instruction) {
        if (this.oldPC === this.highlightPC) {
            if (this.highlight) this.result += this.highlight;
        } else {
            if (this.indent) this.result += this.indent;
        }
    	this.result += this.oldPC + " <";
    	for (var i = this.oldPC; i < this.scanner.pc; i++) {
    	    if (i > this.oldPC) this.result += " ";
    		this.result += (this.method.bits[i]+0x100).toString(16).substr(-2).toUpperCase(); // padded hex
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
    },
    jumpIf: function(condition, offset) {
        this.print((condition ? 'jumpIfTrue: ' : 'jumpIfFalse: ') + (this.scanner.pc + offset));
    },
    methodReturnReceiver: function() {
	    this.print('return: receiver');
    },
    methodReturnTop: function() {
	    this.print('return: topOfStack');
    },
    methodReturnConstant: function(obj) {
    	this.print('returnConst: ' + obj.toString());
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
    	this.print('pushConst: ' + obj.toString());
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
    	this.print( (supered ? 'superSend: #' : 'send: #') + (selector.bitsAsString ? selector.bitsAsString() : selector));
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
});

Object.subclass('lib.squeak.vm.InstructionStream',
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
    	var byte = method.bits[this.pc++];
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
			if (offset > 13) throw "unusedBytecode";
    	}
    	if (type === 8) return this.interpretExtension(offset, method, client);
    	if (type === 9) // short jumps
    			if (offset<8) return client.jump(offset+1);
    			else return client.jumpIf(false, offset-8+1);
    	if (type === 10) {// long jumps
    		byte = this.method.bits[this.pc++];
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
    		var byte2 = this.method.bits[this.pc++];
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
    				if (type === 2) throw "illegalStore";
    				if (type === 3) return client.storeIntoLiteralVariable(this.method.methodGetLiteral(offset2));
    			}
    			if (offset === 2) {
        			if (type === 0) return client.popIntoReceiverVariable(offset2);
    				if (type === 1) return client.popIntoTemporaryVariable(offset2);
    				if (type === 2) throw "illegalStore";
    				if (type === 3) return client.popIntoLiteralVariable(this.method.methodGetLiteral(offset2));
    			}
    		}
    		// 131-134 (extended sends)
    		if (offset === 3) // Single extended send
    			return client.send(this.method.methodGetLiteral(byte2 % 32), byte2 / 32 | 0, false);
    		if (offset === 4) { // Double extended do-anything
    			var byte3 = this.method.bits[this.pc++];
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
    			return client.send(this.method.methodGetLiteral(byte2 % 32), byte2 % 32, true);
    		if (offset === 6) // Second extended super send
    			return client.send(this.method.methodGetLiteral(byte2 % 64), byte2 % 64, true);
    	}
    	if (offset === 7) return client.doPop();
    	if (offset === 8) return client.doDup();
    	if (offset === 9) return client.pushActiveContext();
    	throw "unusedBytecode";
    }
});

}) // end of module
