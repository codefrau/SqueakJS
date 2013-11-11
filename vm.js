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

Object.subclass('lib.squeak.vm.Image',
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

    },
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
        var oopMap = {};
        for (var i = 0; i < endOfMemory; ) {
            var nWords = 0;
            var classInt = 0;
            var header = readInt();
            switch (header & this.HeaderTypeMask) {
                case this.HeaderTypeSizeAndClass:
                    nWords = header >> 2;
                    classInt = readInt();
                    header = readInt();
                    i += 12;
                    break;
                case this.HeaderTypeClass:
                    classInt = header - this.HeaderTypeClass;
                    header = readInt();
                    nWords = (header >> 2) & 63;
                    i += 8;
                    break;
                case this.HeaderTypeShort:
                    nWords = (header >> 2) & 63;
                    classInt = (header >> 12) & 31; //compact class index
                    //Note classInt<32 implies compact class index
                    i += 4;
                    break;
                case this.HeaderTypeFree:
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
            //oopMap is from old oops to new objects
            oopMap[oldBaseAddr + baseAddr] = object;
        }
        show("objects: "+ Object.keys(oopMap).length);
        //create proper objects
        var splObs         = oopMap[specialObjectsOopInt];
        var compactClasses = oopMap[splObs.bits[this.splOb_CompactClasses]].bits;
        var floatClass     = oopMap[splObs.bits[this.splOb_ClassFloat]];
        for (var oop in oopMap)
            oopMap[oop].installFromImage(oopMap, compactClasses, floatClass);
        this.specialObjectsArray = splObs;
     },
});
Object.subclass('lib.squeak.vm.Object',
'initialization', {
    initFromImage: function(cls, fmt, hsh, data) {
        // initial creation from Image, with unmapped data
        this.sqClass = cls;
        this.format = fmt;
        this.hash = hsh;
        this.bits = data;
    },
    decodeFloat: function(theBits) {
        var buffer = new ArrayBuffer(8);
        var data = new DataView(buffer);
        data.setUint32(0, theBits[0], false);
        data.setUint32(4, theBits[1], false);
        var float = data.getFloat64(0, false);
        return float;
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
            this.pointers = this.decodePointers(nWords, this.bits, oopMap);
            this.bits = undefined; }
        else if (this.format >= 12) {
            //Formats 12-15 -- CompiledMethods both pointers and bits
            var methodHeader = this.bits[0];
            var numLits = (methodHeader>>10) & 255;
            this.pointers = this.decodePointers(numLits+1, this.bits, oopMap); //header+lits
            this.bits = this.decodeBytes(nWords-(numLits+1), this.bits, numLits+1, this.format & 3); }
        else if (this.format >= 8) {
            //Formats 8..11 -- ByteArrays (and Strings)
            this.bits = this.decodeBytes(nWords, this.bits, 0, this.format & 3); }
        //Format 6 word objects are already OK (except Floats...)
        else if (this.sqClass == floatClass) {
            //Floats need two ints to be converted to double
            this.bits = this.decodeFloat(this.bits); }
    },


    decodePointers: function(nWords, theBits, oopMap) {
        //Convert small ints and look up object pointers in oopMap
        var ptrs = new Array(nWords);
        for (var i=0; i<nWords; i++) {
            var oldOop = theBits[i];
            if ((oldOop&1) == 1)
                ptrs[i] = oldOop >> 1;
            else
                ptrs[i] = oopMap[oldOop];
        }
        return ptrs;        
    },
    decodeBytes: function(nWords, theBits, wordOffset, fmtLowBits) {
        //Adjust size for low bits and extract bytes from ints
        var nBytes = (nWords*4) - fmtLowBits;
        var newBits = new Array(nBytes);
        var wordIx = wordOffset;
        var fourBytes = 0;
        for (var i=0; i<nBytes; i++) {
            if ((i&3)==0)
                fourBytes = theBits[wordIx++];
            var pickByte = (fourBytes>>(8*(3-(i&3))))&255;
            if (pickByte>=128)
                pickByte = pickByte-256;
            newBits[i]= pickByte;
        }
        return newBits;
    }


},
'printing', {
    toString: function() {
        return Strings.format('sqObj(%s)',
            this.sqClass.constructor == lib.squeak.vm.Object ? this.sqInstName() : this.sqClass);
    },
    bitsAsString: function() {
        return this.bits.map(function(char) { return String.fromCharCode(char); }).join('');
    },
    sqClassName: function() {
        // the 7th inst var of a class holds either the name, or the non-meta class if this is a metaclass
        var nameOrNonMetaClass = this.sqClass.pointers[6];
        var isMeta = nameOrNonMetaClass.bits == undefined;
        var nameObj = isMeta ? nameOrNonMetaClass.pointers[6] : nameOrNonMetaClass;
        var name = nameObj.bitsAsString();
        return isMeta ? name + " class" : name;
    }

    sqInstName: function() {
        var className = this.sqClassName();
        if (/ /.test(className))
            return className;
        var inst = '';
        switch (className) {
            case 'ByteString':
            case 'WideString':
            case 'Symbol': inst = ' "'+this.bitsAsString()+'"'; break;            
        }
        return  (/^[aeiou]/i.test(className) ? 'an ' + className : 'a ' + className) + inst;
    }


});

}) // end of module
