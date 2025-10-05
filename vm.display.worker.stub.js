"use strict";

function warnDisplayError(message, error) {
    if (typeof console !== "undefined" && console.warn) {
        console.warn(message, error);
    }
}

Object.extend(Squeak.Primitives.prototype,
'display-worker-offscreen', {
    initDisplay: function(display) {
        this.display = display;
        if (!display) return;
        display.vm = this.vm;
        if (typeof display.highdpi !== "boolean") display.highdpi = false;
        if (typeof display.scale !== "number" || !(display.scale > 0)) display.scale = 1;
        if (typeof display.devicePixelRatio !== "number" || !(display.devicePixelRatio > 0)) {
            display.devicePixelRatio = 1;
        }
        display.width = display.width || 0;
        display.height = display.height || 0;
        display.depth = display.depth || 32;
        display.ensureSurface = display.ensureSurface || null;
        display.present = display.present || null;
        display.context = display.context || null;
        display.offscreenCanvas = display.offscreenCanvas || null;
        display._imageBufferCache = null;
        this.reverseDisplay = false;
        this.indexedColors = this._indexedColors || this._initIndexedColors();
    },

    primitiveBeDisplay: function(argCount) {
        var displayObj = this.vm.stackValue(0);
        this.vm.specialObjects[Squeak.splOb_TheDisplay] = displayObj;
        this.vm.popN(argCount);
        return true;
    },

    primitiveReverseDisplay: function(argCount) {
        this.reverseDisplay = !this.reverseDisplay;
        if (this.display) this.renderDisplay(null);
        this.vm.popN(argCount);
        return true;
    },

    primitiveForceDisplayUpdate: function(argCount) {
        if (!this.display) {
            this.vm.popN(argCount);
            return true;
        }
        this.renderDisplay(null);
        if (typeof this.display.notifyForceDisplayUpdate === "function") {
            try {
                this.display.notifyForceDisplayUpdate();
            } catch (error) {
                warnDisplayError("Worker display force update callback failed", error);
            }
        }
        this.vm.popN(argCount);
        return true;
    },

    primitiveShowDisplayRect: function(argCount) {
        var rect = {
            left: this.stackInteger(3),
            right: this.stackInteger(2),
            top: this.stackInteger(1),
            bottom: this.stackInteger(0),
        };
        if (!this.success) return false;
        this.renderDisplay(rect);
        if (this.display && typeof this.display.notifyDisplayRect === "function") {
            try {
                this.display.notifyDisplayRect(rect);
            } catch (error) {
                warnDisplayError("Worker display rect callback failed", error);
            }
        }
        this.vm.popN(argCount);
        return true;
    },

    primitiveBeCursor: function(argCount) {
        // Cursor rendering is not yet supported in worker/offscreen mode.
        this.vm.popN(argCount);
        return true;
    },

    primitiveScreenSize: function(argCount) {
        if (!this.display) return false;
        var width = this.ensureSmallInt(this.display.width || 0);
        var height = this.ensureSmallInt(this.display.height || 0);
        if (!this.success) return false;
        this.vm.popNandPush(argCount, this.makePointWithXandY(width, height));
        return true;
    },

    primitiveScreenDepth: function(argCount) {
        if (!this.display) return false;
        this.vm.popNandPushIntIfOK(argCount, this.display.depth || 32);
        return true;
    },

    primitiveScreenScaleFactor: function(argCount) {
        if (!this.display) return false;
        var scaleFactor = this.display.highdpi ? (this.display.devicePixelRatio || 1) : 1;
        return this.popNandPushIfOK(argCount + 1, scaleFactor);
    },

    primitiveTestDisplayDepth: function(argCount) {
        var supportedDepths = [1, 2, 4, 8, 16, 32];
        var depth = this.stackInteger(0);
        if (!this.success) return false;
        this.vm.popNandPushBoolIfOK(argCount, supportedDepths.indexOf(depth) >= 0);
        return true;
    },

    primitiveSetFullScreen: function(argCount) {
        // Fullscreen is managed by the host thread.
        this.vm.popN(argCount);
        return true;
    },

    renderDisplay: function(rect) {
        if (!this.display) return;
        var form = this.theDisplay();
        if (!form || !form.bits) return;
        var presentRect = rect || {
            left: 0,
            top: 0,
            right: form.width,
            bottom: form.height,
        };
        try {
            if (typeof this.display.ensureSurface === "function") {
                this.display.ensureSurface(form);
            }
        } catch (error) {
            warnDisplayError("Worker ensureSurface failed", error);
            return;
        }
        if (!this.display.context) {
            if (typeof this.display.present === "function") {
                try {
                    this.display.present(presentRect);
                } catch (error) {
                    warnDisplayError("Worker present callback failed", error);
                }
            }
            return;
        }
        this.display.depth = form.depth;
        this.display.width = form.width;
        this.display.height = form.height;
        this.showForm(this.display.context, form, presentRect);
        if (typeof this.display.present === "function") {
            try {
                this.display.present(presentRect);
            } catch (error) {
                warnDisplayError("Worker present callback failed", error);
            }
        }
    },

    loadForm: function(formObj, withOffset) {
        if (!formObj || formObj.isNil) return null;
        var form = {
            obj: formObj,
            bits: formObj.pointers[Squeak.Form_bits].wordsOrBytes(),
            depth: formObj.pointers[Squeak.Form_depth],
            width: formObj.pointers[Squeak.Form_width],
            height: formObj.pointers[Squeak.Form_height],
        };
        if (withOffset) {
            var offset = formObj.pointers[Squeak.Form_offset];
            form.offsetX = offset.pointers ? offset.pointers[Squeak.Point_x] : 0;
            form.offsetY = offset.pointers ? offset.pointers[Squeak.Point_y] : 0;
        }
        if (form.width === 0 || form.height === 0) return form;
        if (!(form.width > 0 && form.height > 0)) return null;
        form.msb = form.depth > 0;
        if (!form.msb) form.depth = -form.depth;
        if (!(form.depth > 0)) return null;
        form.pixPerWord = 32 / form.depth;
        form.pitch = (form.width + (form.pixPerWord - 1)) / form.pixPerWord | 0;
        if (form.bits.length !== (form.pitch * form.height)) {
            if (form.bits.length > (form.pitch * form.height)) {
                this.vm.warnOnce("loadForm(): " + form.bits.length + " !== " + form.pitch + "*" + form.height + "=" + (form.pitch * form.height));
            } else {
                return null;
            }
        }
        return form;
    },

    theDisplay: function() {
        return this.loadForm(this.vm.specialObjects[Squeak.splOb_TheDisplay]);
    },

    displayDirty: function(form, rect) {
        if (!this.deferDisplayUpdates && form === this.vm.specialObjects[Squeak.splOb_TheDisplay]) {
            this.renderDisplay(rect);
        }
    },

    displayUpdate: function(form, rect) {
        this.renderDisplay(rect);
    },

    showForm: function(ctx, form, rect, cursorColors) {
        if (!rect || !ctx) return;
        var srcX = rect.left,
            srcY = rect.top,
            srcW = rect.right - srcX,
            srcH = rect.bottom - srcY;
        if (srcW <= 0 || srcH <= 0) return;
        var pixels = ctx.createImageData(srcW, srcH),
            pixelData = pixels.data;
        if (!pixelData || !pixelData.buffer) {
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
                            abgr = (argb & 0xFF00FF00) +
                                ((argb & 0x00FF0000) >> 16) +
                                ((argb & 0x000000FF) << 16);
                        colors[i] = abgr;
                    }
                    this.swappedColors = colors;
                }
                if (this.reverseDisplay) {
                    if (cursorColors) {
                        colors = cursorColors.map(function(c) { return c ^ 0x00FFFFFF; });
                    } else {
                        if (!this.reversedColors) {
                            this.reversedColors = colors.map(function(c) { return c ^ 0x00FFFFFF; });
                        }
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
                }
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
                            ((rgb & 0x7C00) >> 7) +
                            ((rgb & 0x03E0) << 6) +
                            ((rgb & 0x001F) << 19) +
                            0xFF000000;
                        if ((srcShift -= 16) < 0) {
                            srcShift = 16;
                            src = form.bits[++srcIndex];
                        }
                    }
                    srcY++;
                }
                if (this.reverseDisplay) {
                    for (var i = 0; i < dest.length; i++) {
                        dest[i] = dest[i] ^ 0x00FFFFFF;
                    }
                }
                break;
            case 32:
                var opaque = cursorColors ? 0 : 0xFF000000;
                for (var row = 0; row < srcH; row++) {
                    var srcIndex = form.pitch * srcY + srcX;
                    var dstIndex = pixels.width * row;
                    for (var col = 0; col < srcW; col++) {
                        var argb = form.bits[srcIndex++];
                        var abgr = (argb & 0xFF00FF00) |
                            ((argb & 0x00FF0000) >> 16) |
                            ((argb & 0x000000FF) << 16) |
                            opaque;
                        dest[dstIndex++] = this.reverseDisplay ? (abgr ^ 0x00FFFFFF) : abgr;
                    }
                    srcY++;
                }
                break;
            default:
                throw new Error("depth not implemented");
        }
        if (pixels.data !== pixelData) {
            pixels.data.set(pixelData);
        }
        ctx.putImageData(pixels, rect.left, rect.top);
    },

    _initIndexedColors: function() {
        this._indexedColors = [
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
            0xFFFFCCCC, 0xFFFFFFCC, 0xFFFF00FF, 0xFFFF33FF, 0xFFFF66FF, 0xFFFF99FF, 0xFFFFCCFF, 0xFFFFFFFF
        ];
        return this._indexedColors;
    },
});

