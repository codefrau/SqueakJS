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
    	this.HeaderTypeMask = 3;
    	this.HeaderTypeSizeAndClass = 0; //3-word header
    	this.HeaderTypeClass = 1;        //2-word header
    	this.HeaderTypeFree = 2;         //free block
	    this.HeaderTypeShort = 3;        //1-word header
    },
},
'reading', {
    readFromBuffer: function(buffer) {
        var bytes = new Uint8Array(buffer);
        var doSwap = false,
            pos = 0;
        var readInt = function() {
            return doSwap
                ? (bytes[pos++] + (bytes[pos++] << 8) + (bytes[pos++] << 16) + (bytes[pos++] << 24))
                : ((bytes[pos++] << 24) + (bytes[pos++] << 16) + (bytes[pos++] << 8) + bytes[pos++]);
        };
        // read version
        var version = readInt();
        if (version != 6502) {
            doSwap = true; pos = 0;
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
        console.profile();
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
            var format= ((header>>8) & 15);
            var hash= ((header>>17) & 4095);
            
            // Note classInt and data are just raw data; no base addr adjustment and no Int conversion
            var data = new Array(nWords);
            for (var j = 0; j<nWords; j++)
                data[j]= readInt();
            i += nWords*4;

            var object = {classInt: classInt, format: format, hash: hash, data: data};
            //registerObject(object);
            //oopMap is from old oops to new objects
            oopMap[oldBaseAddr + baseAddr] = object;
        }
        console.profileEnd();
        return oopMap;
     },
});

}) // end of module
