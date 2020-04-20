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

Object.extend(Squeak.Primitives.prototype,
'JPEGReadWriter2Plugin', {
    jpeg2_primJPEGPluginIsPresent: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.vm.trueObj);
    },
    jpeg2_primImageHeight: function(argCount) {
        var decompressStruct = this.stackNonInteger(0).wordsOrBytes();
        if (!decompressStruct) return false;
        var height = decompressStruct[1];
        return this.popNandPushIfOK(argCount + 1, height);
    },
    jpeg2_primImageWidth: function(argCount) {
        var decompressStruct = this.stackNonInteger(0).wordsOrBytes();
        if (!decompressStruct) return false;
        var width = decompressStruct[0];
        return this.popNandPushIfOK(argCount + 1, width);
    },
    jpeg2_primJPEGCompressStructSize: function(argCount) {
        // no struct needed
        return this.popNandPushIfOK(argCount + 1, 0);
    },
    jpeg2_primJPEGDecompressStructSize: function(argCount) {
        // width, height, 32 bits each
        return this.popNandPushIfOK(argCount + 1, 8);
    },
    jpeg2_primJPEGErrorMgr2StructSize: function(argCount) {
        // no struct needed
        return this.popNandPushIfOK(argCount + 1, 0);
    },
    jpeg2_primJPEGReadHeaderfromByteArrayerrorMgr: function(argCount) {
        var decompressStruct = this.stackNonInteger(2).wordsOrBytes(),
            source = this.stackNonInteger(1).bytes;
        if (!decompressStruct || !source) return false;
        var unfreeze = this.vm.freeze();
        this.jpeg2_readImageFromBytes(source,
            function success(image) {
                this.jpeg2state = {src: source, img: image};
                decompressStruct[0] = image.width;
                decompressStruct[1] = image.height;
                unfreeze();
            }.bind(this),
            function error() {
                decompressStruct[0] = 0;
                decompressStruct[1] = 0;
                unfreeze();
            }.bind(this));
        return this.popNIfOK(argCount);
    },
    jpeg2_primJPEGReadImagefromByteArrayonFormdoDitheringerrorMgr: function(argCount) {
        var source = this.stackNonInteger(3).bytes,
            form = this.stackNonInteger(2).pointers,
            ditherFlag = this.stackBoolean(1);
        if (!this.success || !source || !form) return false;
        var state = this.jpeg2state;
        if (!state || state.src !== source) {
            console.error("jpeg read did not match header info");
            return false;
        }
        var depth = form[Squeak.Form_depth],
            image = this.jpeg2_getPixelsFromImage(state.img),
            formBits = form[Squeak.Form_bits].words;
        if (depth === 32) {
            this.jpeg2_copyPixelsToForm32(image, formBits);
        } else if (depth === 16) {
            if (ditherFlag) this.jpeg2_ditherPixelsToForm16(image, formBits);
            else this.jpeg2_copyPixelsToForm16(image, formBits);
        } else return false;
        return this.popNIfOK(argCount);
    },
    jpeg2_primJPEGWriteImageonByteArrayformqualityprogressiveJPEGerrorMgr: function(argCount) {
        this.vm.warnOnce("JPEGReadWritePlugin2: writing not implemented yet");
        return false;
    },
    jpeg2_readImageFromBytes: function(bytes, thenDo, errorDo) {
        var blob = new Blob([bytes], {type: "image/jpeg"}),
            image = new Image();
        image.onload = function() {
            thenDo(image);
        };
        image.onerror = function() {
            console.warn("could not render JPEG");
            errorDo();
        };
        image.src = (window.URL || window.webkitURL).createObjectURL(blob);
    },
    jpeg2_getPixelsFromImage: function(image) {
        var canvas = document.createElement("canvas"),
            context = canvas.getContext("2d");
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
    },
    jpeg2_copyPixelsToForm32: function(image, formBits) {
        var pixels = image.data;
        for (var i = 0; i < formBits.length; i++) {
            var r = pixels[i*4 + 0],
                g = pixels[i*4 + 1],
                b = pixels[i*4 + 2];
            formBits[i] = 0xFF000000 | (r << 16) | (g << 8) | b;
        }
    },
    jpeg2_copyPixelsToForm16: function(image, formBits) {
        var width = image.width,
            height = image.height,
            pixels = image.data;
        for (var y = 0; y < height; y++)
            for (var x = 0; x < width; x += 2) {
                var i = y * height + x,
                    r1 = pixels[i*4 + 0] >> 3,
                    g1 = pixels[i*4 + 1] >> 3,
                    b1 = pixels[i*4 + 2] >> 3,
                    r2 = pixels[i*4 + 4] >> 3,
                    g2 = pixels[i*4 + 5] >> 3,
                    b2 = pixels[i*4 + 6] >> 3,
                    formPix = (r1 << 10) | (g1 << 5) | b1;
                if (formPix === 0) formPix = 1;
                formPix = (formPix << 16) | (r2 << 10) | (g2 << 5) | b2;
                if ((formPix & 65535) === 0) formPix = formPix | 1;
                formBits[i >> 1] = formPix;
            }
    },
    jpeg2_ditherPixelsToForm16: function(image, formBits) {
        var width = image.width >> 1,   // 2 pix a time
            height = image.height,
            pixels = image.data,
            ditherMatrix1 = [2, 0, 14, 12, 1, 3, 13, 15],
            ditherMatrix2 = [10, 8, 6, 4, 9, 11, 5, 7];
        for (var y = 0; y < height; y++)
            for (var x = 0; x < width; x++) {
                var i = (y * height + 2 * x) << 2,
                    r1 = pixels[i + 0],
                    g1 = pixels[i + 1],
                    b1 = pixels[i + 2],
                    r2 = pixels[i + 4],
                    g2 = pixels[i + 5],
                    b2 = pixels[i + 6];
                /* Do 4x4 ordered dithering. Taken from Form>>orderedDither32To16 */
                var v = ((y & 3) << 1) | (x & 1),
                    dmv1 = ditherMatrix1[v],
                    dmv2 = ditherMatrix2[v],
                    di, dmi, dmo;
                di = (r1 * 496) >> 8, dmi = di & 15, dmo = di >> 4;
                if (dmv1 < dmi) { r1 = dmo+1; } else { r1 = dmo; };
                di = (g1 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv1 < dmi) { g1 = dmo+1; } else { g1 = dmo; };
                di = (b1 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv1 < dmi) { b1 = dmo+1; } else { b1 = dmo; };

                di = (r2 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv2 < dmi) { r2 = dmo+1; } else { r2 = dmo; };
                di = (g2 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv2 < dmi) { g2 = dmo+1; } else { g2 = dmo; };
                di = (b2 * 496) >> 8; dmi = di & 15; dmo = di >> 4;
                if (dmv2 < dmi) { b2 = dmo+1; } else { b2 = dmo; };

                var formPix = (r1 << 10) | (g1 << 5) | b1;
                if (formPix === 0) formPix = 1;
                formPix = (formPix << 16) | (r2 << 10) | (g2 << 5) | b2;
                if ((formPix & 65535) === 0) formPix = formPix | 1;
                formBits[i >> 3] = formPix;
            }
    },
});
