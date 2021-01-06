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

Object.subclass('Squeak.Object',
'initialization', {
    initInstanceOf: function(aClass, indexableSize, hash, nilObj) {
        this.sqClass = aClass;
        this.hash = hash;
        var instSpec = aClass.pointers[Squeak.Class_format],
            instSize = ((instSpec>>1) & 0x3F) + ((instSpec>>10) & 0xC0) - 1; //0-255
        this._format = (instSpec>>7) & 0xF; //This is the 0-15 code

        if (this._format < 8) {
            if (this._format != 6) {
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
                // this._format |= -indexableSize & 3;       //deferred to writeTo()
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
        this._format = original._format;
        if (original.isFloat) {
            this.isFloat = original.isFloat;
            this.float = original.float;
        } else {
            if (original.pointers) this.pointers = original.pointers.slice(0);   // copy
            if (original.words) this.words = new Uint32Array(original.words);    // copy
            if (original.bytes) this.bytes = new Uint8Array(original.bytes);     // copy
        }
    },
    initFromImage: function(oop, cls, fmt, hsh) {
        // initial creation from Image, with unmapped data
        this.oop = oop;
        this.sqClass = cls;
        this._format = fmt;
        this.hash = hsh;
    },
    classNameFromImage: function(oopMap, rawBits) {
        var name = oopMap[rawBits[this.oop][Squeak.Class_name]];
        if (name && name._format >= 8 && name._format < 12) {
            var bits = rawBits[name.oop],
                bytes = name.decodeBytes(bits.length, bits, 0, name._format & 3);
            return Squeak.bytesAsString(bytes);
        }
        return "Class";
    },
    renameFromImage: function(oopMap, rawBits, ccArray) {
        var classObj = this.sqClass < 32 ? oopMap[ccArray[this.sqClass-1]] : oopMap[this.sqClass];
        if (!classObj) return this;
        var instProto = classObj.instProto || classObj.classInstProto(classObj.classNameFromImage(oopMap, rawBits));
        if (!instProto) return this;
        var renamedObj = new instProto; // Squeak.Object
        renamedObj.oop = this.oop;
        renamedObj.sqClass = this.sqClass;
        renamedObj._format = this._format;
        renamedObj.hash = this.hash;
        return renamedObj;
    },
    installFromImage: function(oopMap, rawBits, ccArray, floatClass, littleEndian, nativeFloats) {
        //Install this object by decoding format, and rectifying pointers
        var ccInt = this.sqClass;
        // map compact classes
        if ((ccInt>0) && (ccInt<32))
            this.sqClass = oopMap[ccArray[ccInt-1]];
        else
            this.sqClass = oopMap[ccInt];
        var bits = rawBits[this.oop],
            nWords = bits.length;
        if (this._format < 5) {
            //Formats 0...4 -- Pointer fields
            if (nWords > 0) {
                var oops = bits; // endian conversion was already done
                this.pointers = this.decodePointers(nWords, oops, oopMap);
            }
        } else if (this._format >= 12) {
            //Formats 12-15 -- CompiledMethods both pointers and bits
            var methodHeader = this.decodeWords(1, bits, littleEndian)[0],
                numLits = (methodHeader>>10) & 255,
                oops = this.decodeWords(numLits+1, bits, littleEndian);
            this.pointers = this.decodePointers(numLits+1, oops, oopMap); //header+lits
            this.bytes = this.decodeBytes(nWords-(numLits+1), bits, numLits+1, this._format & 3);
        } else if (this._format >= 8) {
            //Formats 8..11 -- ByteArrays (and ByteStrings)
            if (nWords > 0)
                this.bytes = this.decodeBytes(nWords, bits, 0, this._format & 3);
        } else if (this.sqClass == floatClass) {
            //These words are actually a Float
            this.isFloat = true;
            this.float = this.decodeFloat(bits, littleEndian, nativeFloats);
            if (this.float == 1.3797216632888e-310) {
                if (Squeak.noFloatDecodeWorkaround) {
                    // floatDecode workaround disabled
                } else {
                    this.constructor.prototype.decodeFloat = this.decodeFloatDeoptimized;
                    this.float = this.decodeFloat(bits, littleEndian, nativeFloats);
                    if (this.float == 1.3797216632888e-310)
                        throw Error("Cannot deoptimize decodeFloat");
                }
            }
        } else {
            if (nWords > 0)
                this.words = this.decodeWords(nWords, bits, littleEndian);
        }
        this.mark = false; // for GC
    },
    decodePointers: function(nWords, theBits, oopMap) {
        //Convert small ints and look up object pointers in oopMap
        var ptrs = new Array(nWords);
        for (var i = 0; i < nWords; i++) {
            var oop = theBits[i];
            if ((oop & 1) === 1) {          // SmallInteger
                ptrs[i] = oop >> 1;
            } else {                        // Object
                ptrs[i] = oopMap[oop] || 42424242;
                // when loading a context from image segment, there is
                // garbage beyond its stack pointer, resulting in the oop
                // not being found in oopMap. We just fill in an arbitrary
                // SmallInteger - it's never accessed anyway
            }
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
'testing', {
    isWords: function() {
        return this._format === 6;
    },
    isBytes: function() {
        var fmt = this._format;
        return fmt >= 8 && fmt <= 11;
    },
    isWordsOrBytes: function() {
        var fmt = this._format;
        return fmt == 6  || (fmt >= 8 && fmt <= 11);
    },
    isPointers: function() {
        return this._format <= 4;
    },
    isWeak: function() {
        return this._format === 4;
    },
    isMethod: function() {
        return this._format >= 12;
    },
    sameFormats: function(a, b) {
        return a < 8 ? a === b : (a & 0xC) === (b & 0xC);
    },
    sameFormatAs: function(obj) {
        return this.sameFormats(this._format, obj._format);
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
            approx = value > 0x1FFFFFFFFFFFFF ? '≈' : '';
        return sign + '16r' + digits.join('') + ' (' + approx + sign + value + 'L)';
    },
    assnKeyAsString: function() {
        return this.pointers[Squeak.Assn_key].bytesAsString();
    },
    slotNameAt: function(index) {
        // one-based index
        var instSize = this.instSize();
        if (index <= instSize)
            return this.sqClass.allInstVarNames()[index - 1] || 'ivar' + (index - 1);
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
            case 'Character': var unicode = this.pointers ? this.pointers[0] : this.hash; // Spur
                return "$" + String.fromCharCode(unicode) + " (" + unicode.toString() + ")";
            case 'CompiledMethod': return this.methodAsString();
            case 'CompiledBlock': return "[] in " + this.blockOuterCode().sqInstName();
        }
        return  /^[aeiou]/i.test(className) ? 'an' + className : 'a' + className;
    },
},
'accessing', {
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
        var fmt = this._format;
        if (fmt > 4 || fmt === 2) return 0;      //indexable fields only
        if (fmt < 2) return this.pointersSize(); //fixed fields only
        return this.sqClass.classInstSize();
    },
    indexableSize: function(primHandler) {
        var fmt = this._format;
        if (fmt < 2) return -1; //not indexable
        if (fmt === 3 && primHandler.vm.isContext(this) && !primHandler.allowAccessBeyondSP)
            return this.pointers[Squeak.Context_stackPointer]; // no access beyond top of stacks
        if (fmt < 6) return this.pointersSize() - this.instSize(); // pointers
        if (fmt < 8) return this.wordsSize(); // words
        if (fmt < 12) return this.bytesSize(); // bytes
        return this.bytesSize() + (4 * this.pointersSize()); // methods
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
    wordsAsUint16Array: function() {
        return this.uint16Array
            || (this.words && (this.uint16Array = new Uint16Array(this.words.buffer)));
    },
    wordsAsUint8Array: function() {
        return this.uint8Array
            || (this.words && (this.uint8Array = new Uint8Array(this.words.buffer)));
    },
    wordsOrBytes: function() {
        if (this.words) return this.words;
        if (this.uint32Array) return this.uint32Array;
        if (!this.bytes) return null;
        return this.uint32Array = new Uint32Array(this.bytes.buffer, 0, this.bytes.length >>> 2);
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
        if (this.bytes) nWords += (this.bytes.length + 3) >>> 2;
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
        if (this.bytes) this._format |= -this.bytes.length & 3;
        var beforePos = pos,
            size = this.snapshotSize(),
            formatAndHash = ((this._format & 15) << 8) | ((this.hash & 4095) << 17);
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
    classInstFormat: function() {
        return (this.pointers[Squeak.Class_format] >> 7) & 0xF;
    },
    classInstSize: function() {
        // this is a class, answer number of named inst vars
        var spec = this.pointers[Squeak.Class_format];
        return ((spec >> 10) & 0xC0) + ((spec >> 1) & 0x3F) - 1;
    },
    classInstIsBytes: function() {
        var fmt = this.classInstFormat();
        return fmt >= 8 && fmt <= 11;
    },
    classInstIsPointers: function() {
        return this.classInstFormat() <= 4;
    },
    instVarNames: function() {
        // index changed from 4 to 3 in newer images
        for (var index = 3; index <= 4; index++) {
            var varNames = this.pointers[index].pointers;
            if (varNames && varNames.length && varNames[0].bytes) {
                return varNames.map(function(each) {
                    return each.bytesAsString();
                });
            }
        }
        return [];
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
        if (!this.pointers) return "_NOTACLASS_";
        for (var nameIdx = 6; nameIdx <= 7; nameIdx++) {
            var name = this.pointers[nameIdx];
            if (name && name.bytes) return name.bytesAsString();
        }
        // must be meta class
        for (var clsIndex = 5; clsIndex <= 6; clsIndex++) {
            var cls = this.pointers[clsIndex];
            if (cls && cls.pointers) {
                for (var nameIdx = 6; nameIdx <= 7; nameIdx++) {
                    var name = cls.pointers[nameIdx];
                    if (name && name.bytes) return name.bytesAsString() + " class";
                }
            }
        }
        return "_SOMECLASS_";
    },
    defaultInst: function() {
        return Squeak.Object;
    },
    classInstProto: function(className) {
        if (this.instProto) return this.instProto;
        var proto = this.defaultInst();  // in case below fails
        try {
            if (!className) className = this.className();
            var safeName = className.replace(/[^A-Za-z0-9]/g,'_');
            if (safeName === "UndefinedObject") safeName = "nil";
            else if (safeName === "True") safeName = "true_";
            else if (safeName === "False") safeName = "false_";
            else safeName = ((/^[AEIOU]/.test(safeName)) ? 'an' : 'a') + safeName;
            // fail okay if no eval()
            proto = new Function("return function " + safeName + "() {};")();
            proto.prototype = this.defaultInst().prototype;
        } catch(e) {}
        Object.defineProperty(this, 'instProto', { value: proto });
        return proto;
    },
},
'as method', {
    methodSignFlag: function() {
        return false;
    },
    methodNumLits: function() {
        return (this.pointers[0]>>9) & 0xFF;
    },
    methodNumArgs: function() {
        return (this.pointers[0]>>24) & 0xF;
    },
    methodPrimitiveIndex: function() {
        var primBits = this.pointers[0] & 0x300001FF;
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
        return (this.pointers[0] & 0x20000) > 0;
    },
    methodAddPointers: function(headerAndLits) {
        this.pointers = headerAndLits;
    },
    methodTempCount: function() {
        return (this.pointers[0]>>18) & 63;
    },
    methodGetLiteral: function(zeroBasedIndex) {
        return this.pointers[1+zeroBasedIndex]; // step over header
    },
    methodGetSelector: function(zeroBasedIndex) {
        return this.pointers[1+zeroBasedIndex]; // step over header
    },
    methodAsString: function() {
      return 'aCompiledMethod';
    },
},
'as context', {
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
