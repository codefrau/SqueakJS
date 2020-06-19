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
'display', {
    initDisplay: function(display) {
        this.display = display;
        this.display.vm = this.vm;
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
    primitiveBeCursor: function(argCount) {
        if (this.display.cursorCanvas) {
            var cursorForm = this.loadForm(this.stackNonInteger(argCount), true),
                maskForm = argCount === 1 ? this.loadForm(this.stackNonInteger(0)) : null;
            if (!this.success || !cursorForm) return false;
            var cursorCanvas = this.display.cursorCanvas,
                context = cursorCanvas.getContext("2d"),
                bounds = {left: 0, top: 0, right: cursorForm.width, bottom: cursorForm.height};
            cursorCanvas.width = cursorForm.width;
            cursorCanvas.height = cursorForm.height;
            if (cursorForm.depth === 1) {
                if (maskForm) {
                    cursorForm = this.cursorMergeMask(cursorForm, maskForm);
                    this.showForm(context, cursorForm, bounds, [0x00000000, 0xFF0000FF, 0xFFFFFFFF, 0xFF000000]);
                } else {
                    this.showForm(context, cursorForm, bounds, [0x00000000, 0xFF000000]);
                }
            } else {
                this.showForm(context, cursorForm, bounds, true);
            }
            var canvas = this.display.context.canvas,
                scale = canvas.offsetWidth / canvas.width;
            cursorCanvas.style.width = (cursorCanvas.width * scale|0) + "px";
            cursorCanvas.style.height = (cursorCanvas.height * scale|0) + "px";
            this.display.cursorOffsetX = cursorForm.offsetX * scale|0;
            this.display.cursorOffsetY = cursorForm.offsetY * scale|0;
        }
        this.vm.popN(argCount);
        return true;
    },
    cursorMergeMask: function(cursor, mask) {
        // make 2-bit form from cursor and mask 1-bit forms
        var bits = new Uint32Array(16);
        for (var y = 0; y < 16; y++) {
            var c = cursor.bits[y],
                m = mask.bits[y],
                bit = 0x80000000,
                merged = 0;
            for (var x = 0; x < 16; x++) {
                merged = merged | ((m & bit) >> x) | ((c & bit) >> (x + 1));
                bit = bit >>> 1;
            }
            bits[y] = merged;
        }
        return {
            obj: cursor.obj, bits: bits,
            depth: 2, width: 16, height: 16,
            offsetX: cursor.offsetX, offsetY: cursor.offsetY,
            msb: true, pixPerWord: 16, pitch: 1,
        }
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
        if (this.display.cursorCanvas) {
            var canvas = this.display.cursorCanvas,
                context = canvas.getContext("2d"),
                image = context.getImageData(0, 0, canvas.width, canvas.height),
                data = new Uint32Array(image.data.buffer);
            for (var i = 0; i < data.length; i++)
                data[i] = data[i] ^ 0x00FFFFFF;
            context.putImageData(image, 0, 0);
        }
        return true;
    },
    primitiveShowDisplayRect: function(argCount) {
        // Force the given rectangular section of the Display to be copied to the screen.
        var rect = {
            left: this.stackInteger(3),
            top: this.stackInteger(1),
            right: this.stackInteger(2),
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
    showForm: function(ctx, form, rect, cursorColors) {
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
                var colors = cursorColors || this.swappedColors;
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
                    if (cursorColors) {
                        colors = cursorColors.map(function(c){return c ^ 0x00FFFFFF});
                    } else {
                        if (!this.reversedColors)
                            this.reversedColors = colors.map(function(c){return c ^ 0x00FFFFFF});
                        colors = this.reversedColors;
                    }
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
                var opaque = cursorColors ? 0 : 0xFF000000;    // keep alpha for cursors
                for (var y = 0; y < srcH; y++) {
                    var srcIndex = form.pitch * srcY + srcX;
                    var dstIndex = pixels.width * y;
                    for (var x = 0; x < srcW; x++) {
                        var argb = form.bits[srcIndex++];  // convert ARGB -> ABGR
                        var abgr = (argb & 0xFF00FF00)     // green and alpha is okay
                            | ((argb & 0x00FF0000) >> 16)  // shift red down
                            | ((argb & 0x000000FF) << 16)  // shift blue up
                            | opaque;                      // set alpha to opaque
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
        ctx.putImageData(pixels, rect.left, rect.top);
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
    primitiveScanCharacters: function(argCount) {
        if (argCount !== 6) return false;
        // Load the arguments
        var kernDelta = this.stackInteger(0);
        var stops = this.stackNonInteger(1);
        var scanRightX = this.stackInteger(2);
        var sourceString = this.stackNonInteger(3);
        var scanStopIndex = this.stackInteger(4);
        var scanStartIndex = this.stackInteger(5);
        if (!this.success) return false;
        if (stops.pointersSize() < 258 || !sourceString.isBytes()) return false;
        if (!(scanStartIndex > 0 && scanStopIndex > 0 && scanStopIndex <= sourceString.bytesSize())) return false;
        // Load receiver and required instVars
        var rcvr = this.stackNonInteger(6);
        if (!this.success || rcvr.pointersSize() < 4) return false;
        var scanDestX = this.checkSmallInt(rcvr.pointers[0]);
        var scanLastIndex = this.checkSmallInt(rcvr.pointers[1]);
        var scanXTable = this.checkNonInteger(rcvr.pointers[2]);
        var scanMap = this.checkNonInteger(rcvr.pointers[3]);
        if (!this.success || scanMap.pointersSize() !== 256) return false;
        var maxGlyph = scanXTable.pointersSize() - 2;
        // Okay, here we go. We have eliminated nearly all failure
        // conditions, to optimize the inner fetches.
        var EndOfRun = 257;
        var CrossedX = 258;
        var scanLastIndex = scanStartIndex;
        while (scanLastIndex <= scanStopIndex) {
            // Known to be okay since scanStartIndex > 0 and scanStopIndex <= sourceString size
            var ascii = sourceString.bytes[scanLastIndex - 1];
            // Known to be okay since stops size >= 258
            var stopReason = stops.pointers[ascii];
            if (!stopReason.isNil) {
                // Store everything back and get out of here since some stop conditionn needs to be checked"
                this.ensureSmallInt(scanDestX); if (!this.success) return false;
                rcvr.pointers[0] = scanDestX;
                rcvr.pointers[1] = scanLastIndex;
                return this.popNandPushIfOK(7, stopReason);
            }
            // Known to be okay since scanMap size = 256
            var glyphIndex = this.checkSmallInt(scanMap.pointers[ascii]);
            // fail if the glyphIndex is out of range
            if (!this.success || glyphIndex < 0 || glyphIndex > maxGlyph) return false;
            var sourceX = this.checkSmallInt(scanXTable.pointers[glyphIndex]);
            var sourceX2 = this.checkSmallInt(scanXTable.pointers[glyphIndex + 1]);
            // Above may fail if non-integer entries in scanXTable
            if (!this.success) return false;
            var nextDestX = scanDestX + sourceX2 - sourceX;
            if (nextDestX > scanRightX) {
                // Store everything back and get out of here since we got to the right edge
                this.ensureSmallInt(scanDestX); if (!this.success) return false;
                rcvr.pointers[0] = scanDestX;
                rcvr.pointers[1] = scanLastIndex;
                stopReason = stops.pointers[CrossedX - 1];
                return this.popNandPushIfOK(7, stopReason);
            }
            scanDestX = nextDestX + kernDelta;
            scanLastIndex = scanLastIndex + 1;
        }
        this.ensureSmallInt(scanDestX); if (!this.success) return false;
        rcvr.pointers[0] = scanDestX;
        rcvr.pointers[1] = scanStopIndex;
        stopReason = stops.pointers[EndOfRun - 1];
        return this.popNandPushIfOK(7, stopReason);
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
        var supportedDepths =  [1, 2, 4, 8, 16, 32]; // match showForm
        return this.pop2andPushBoolIfOK(supportedDepths.indexOf(this.stackInteger(0)) >= 0);
    },
    loadForm: function(formObj, withOffset) {
        if (formObj.isNil) return null;
        var form = {
            obj: formObj,
            bits: formObj.pointers[Squeak.Form_bits].wordsOrBytes(),
            depth: formObj.pointers[Squeak.Form_depth],
            width: formObj.pointers[Squeak.Form_width],
            height: formObj.pointers[Squeak.Form_height],
        }
        if (withOffset) {
            var offset = formObj.pointers[Squeak.Form_offset];
            form.offsetX = offset.pointers ? offset.pointers[Squeak.Point_x] : 0;
            form.offsetY = offset.pointers ? offset.pointers[Squeak.Point_y] : 0;
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
    displayUpdate: function(form, rect) {
        this.showForm(this.display.context, form, rect);
        this.display.lastTick = this.vm.lastTick;
        this.display.idle = 0;
    },
    primitiveBeep: function(argCount) {
        var ctx = Squeak.startAudioOut();
        if (ctx) {
            var beep = ctx.createOscillator();
            beep.connect(ctx.destination);
            beep.type = 'square';
            beep.frequency.value = 880;
            beep.start();
            beep.stop(ctx.currentTime + 0.05);
        } else {
            this.vm.warnOnce("could not initialize audio");
        }
        return this.popNIfOK(argCount);
    },
});
