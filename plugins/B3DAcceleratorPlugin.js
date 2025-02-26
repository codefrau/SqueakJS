function B3DAcceleratorPlugin() {
    "use strict";

    var DEBUG = 0; // 0 = off, 1 = some, 2 = lots
    var DEBUG_WAIT = false; // wait after each frame

    var renderers = []; // list of all renderers
    var rendererId = 0;  // unique id for each renderer
    var currentRenderer = null; // set by makeCurrent()
    var OpenGL = null; // set by setOpenGL()
    var GL = null; // set by setOpenGL()

    /* Renderer creation flags:
        B3D_SOFTWARE_RENDERER: Enable use of software renderers
        B3D_HARDWARE_RENDERER: Enable use of hardware renderers
        B3D_STENCIL_BUFFER:    Request stencil buffer
        B3D_ANTIALIASING:      Request antialiasing in the renderer.
        B3D_STEREO:            Request stereo visual from the renderer
        B3D_SYNCVBL:           Request VBL sync
        More flags may be added - if they are not supported by the platform
        code the creation primitive should fail.
    */
    var B3D_SOFTWARE_RENDERER = 0x0001;
    var B3D_HARDWARE_RENDERER = 0x0002;
    var B3D_STENCIL_BUFFER    = 0x0004;
    var B3D_ANTIALIASING      = 0x0008; // ignored
    var B3D_STEREO            = 0x0010; // ignored
    var B3D_SYNCVBL           = 0x0020; // ignored

    return {
        getModuleName: function() { return 'B3DAcceleratorPlugin (SqueakJS)'; },
        interpreterProxy: null,
        primHandler: null,

        setInterpreter: function(anInterpreter) {
            this.interpreterProxy = anInterpreter;
            this.vm = this.interpreterProxy.vm;
            this.primHandler = this.vm.primHandler;
            this.prevDCCallback = this.primHandler.display.changedCallback;
            this.primHandler.display.changedCallback = () => {
                if (this.prevDCCallback) this.prevDCCallback();
                for (const renderer of renderers) {
                    this.adjustCanvas(renderer);
                }
            };
            return true;
        },

        setOpenGL: function(OpenGLPlugin) {
            OpenGL = OpenGLPlugin;
            GL = OpenGLPlugin.GL;
            if (currentRenderer) OpenGL.makeCurrent(currentRenderer);
        },

        makeCurrent(renderer) {
            if (currentRenderer !== renderer) {
                currentRenderer = renderer;
                if (OpenGL) OpenGL.makeCurrent(renderer);
            }
            if (renderer.webgl.isContextLost()) {
                if (!renderer.warning) {
                    console.warn("B3DAccel: WebGL context lost");
                    var div = document.createElement("div");
                    div.style.position = "absolute";
                    div.style.left = renderer.canvas.offsetLeft + "px";
                    div.style.top = renderer.canvas.offsetTop + "px";
                    div.style.width = renderer.canvas.width + "px";
                    div.style.height = renderer.canvas.height + "px";
                    div.style.backgroundColor = "rgba(0,0,0,0.8)";
                    div.style.color = "white";
                    div.style.fontFamily = "sans-serif";
                    div.style.fontSize = "24px";
                    div.style.textAlign = "center";
                    div.style.lineHeight = renderer.canvas.height + "px";
                    div.style.pointerEvents = "none";
                    div.style.cursor = "normal";
                    div.innerHTML = "WebGL context lost";
                    document.body.appendChild(div);
                    renderer.warning = div;
                }
            }
        },

        currentFromStack: function(i) {
            var renderer = this.interpreterProxy.stackObjectValue(i);
            if (!renderer.webgl) return null;
            this.makeCurrent(renderer);
            return renderer;
        },


        primitiveAllocateTexture: function(argCount) {
            if (argCount !== 4) return false;
            var h = this.interpreterProxy.stackIntegerValue(0);
            var w = this.interpreterProxy.stackIntegerValue(1);
            var d = this.interpreterProxy.stackIntegerValue(2);
            if (!this.currentFromStack(3)) return false;
            if (w & (w-1)) return false; /* not power of two */
            if (h & (h-1)) return false; /* not power of two */
            DEBUG > 0 && console.log("B3DAccel: primitiveAllocateTexture", w, h, d);
            var tex = [0];
            OpenGL.glGenTextures(1, tex);
            var texture = tex[0];
            OpenGL.glBindTexture(GL.TEXTURE_2D, texture);
            OpenGL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
            OpenGL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
            OpenGL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.REPEAT);
            OpenGL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.REPEAT);
            OpenGL.glTexEnvi(GL.TEXTURE_ENV, GL.TEXTURE_ENV_MODE, GL.MODULATE);
            OpenGL.glTexImage2D(GL.TEXTURE_2D, 0, GL.RGBA, w, h, 0, GL.BGRA, GL.UNSIGNED_BYTE, null);
            return this.primHandler.popNandPushIfOK(argCount + 1, texture);
        },

        primitiveSetVerboseLevel: function(argCount) {
            if (argCount !== 1) return false;
            var level = this.interpreterProxy.stackIntegerValue(0);
            DEBUG > 0 && console.log("B3DAccel: primitiveSetVerboseLevel", level);
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveCompositeTexture: function(argCount) {
            if (argCount !== 7) return false;
            if (!this.currentFromStack(6)) return false;
            var texHandle = this.interpreterProxy.stackIntegerValue(5);
            var x = this.interpreterProxy.stackIntegerValue(4);
            var y = this.interpreterProxy.stackIntegerValue(3);
            var w = this.interpreterProxy.stackIntegerValue(2);
            var h = this.interpreterProxy.stackIntegerValue(1);
            var translucent = this.interpreterProxy.booleanValueOf(this.interpreterProxy.stackValue(0));
            if (this.interpreterProxy.failed()) return false;
            DEBUG > 1 && console.log("B3DAccel: primitiveCompositeTexture", texHandle, x, y, w, h, translucent);
            var result = this.b3dxCompositeTexture(texHandle, x, y, w, h, translucent);
            if (!result) return false;
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveCreateRendererFlags: function(argCount) {
            if (argCount !== 5) return false;
            var flags = this.interpreterProxy.stackIntegerValue(4);
            var x = this.interpreterProxy.stackIntegerValue(3);
            var y = this.interpreterProxy.stackIntegerValue(2);
            var w = this.interpreterProxy.stackIntegerValue(1);
            var h = this.interpreterProxy.stackIntegerValue(0);
            if (flags & ~(B3D_HARDWARE_RENDERER | B3D_SOFTWARE_RENDERER | B3D_STENCIL_BUFFER))
                return false;
            DEBUG > 0 && console.log("B3DAccel: primitiveCreateRendererFlags", x, y, w, h, flags);
            // create WebGL canvas
            var canvas = document.createElement("canvas");
            canvas.classList.add("b3daccel");
            canvas.width = w;
            canvas.height = h;
            canvas.style.backgroundColor = "transparent";
            canvas.style.pointerEvents = "none";
            canvas.style.cursor = "normal";
            var options = { depth: true, alpha: false, antialias: true };
            if (flags & B3D_STENCIL_BUFFER) options.stencil = true;
            var webgl = canvas.getContext("webgl", options);
            if (!webgl) return false;
            // create renderer
            rendererId++;
            var renderer = this.primHandler.makeStString("WebGL#" + rendererId);
            renderers.push(renderer);
            renderer.rendererId = rendererId;
            renderer.canvas = canvas;
            renderer.webgl = webgl;
            // set viewport
            this.b3dxSetViewport(renderer, x, y, w, h);
            document.body.appendChild(canvas);
            // make renderer accessible to other plugins
            this.makeCurrent(renderer);
            DEBUG > 0 && console.log("B3DAccel: created renderer", rendererId);
            return this.primHandler.popNandPushIfOK(argCount + 1, renderer);
        },

        primitiveDestroyRenderer: function(argCount) {
            if (argCount !== 1) return false;
            if (!this.currentFromStack(0)) return false;
            DEBUG > 0 && console.log("B3DAccel: primitiveDestroyRenderer", currentRenderer.rendererId);
            renderers = renderers.filter(r => r !== currentRenderer);
            if (OpenGL) OpenGL.destroyGL(currentRenderer);
            if (currentRenderer.warning) {
                currentRenderer.warning.remove();
                currentRenderer.warning = null;
            }
            currentRenderer.canvas.remove();
            currentRenderer.canvas = null;
            currentRenderer.webgl = null;
            currentRenderer = null;
            DEBUG > 0 && console.log("B3DAccel: destroyed renderer", rendererId);
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveDestroyTexture: function(argCount) {
            if (argCount !== 2) return false;
            var texture = this.interpreterProxy.stackIntegerValue(0);
            if (!this.currentFromStack(1)) return false;
            DEBUG > 0 && console.log("B3DAccel: primitiveDestroyTexture", texture);
            OpenGL.glDeleteTextures(1, [texture]);
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveFinishRenderer: function(argCount) {
            if (argCount !== 1) return false;
            if (!this.currentFromStack(0)) return false;
            DEBUG > 1 && console.log("B3DAccel: primitiveFinishRenderer", currentRenderer);
            OpenGL.glFinish();
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveFlushRenderer: function(argCount) {
            if (argCount !== 1) return false;
            if (!this.currentFromStack(0)) return false;
            DEBUG > 1 && console.log("B3DAccel: primitiveFlushRenderer", currentRenderer);
            OpenGL.glFlush();
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveGetRendererSurfaceHandle: function(argCount) {
            // this would allow BitBlt to draw directly into the renderer surface
            // but it was only ever implemented for Direct3D not OpenGL
            // so the image will use a texture overlay instead
            if (argCount !== 1) return false;
            if (!this.currentFromStack(0)) return false;
            DEBUG > 1 && console.log("B3DAccel: UNIMPLEMENTED primitiveGetRendererSurfaceHandle", currentRenderer);
            return false;
        },

        primitiveGetIntProperty: function(argCount) {
            if (argCount !== 2) return false;
            var property = this.interpreterProxy.stackIntegerValue(0);
            if (!this.currentFromStack(1)) return false;
            DEBUG > 1 && console.log("B3DAccel: primitiveGetIntProperty", property);
            var value = this.b3dxGetIntProperty(currentRenderer, property);
            return this.primHandler.popNandPushIfOK(argCount + 1, value);
        },

        primitiveGetRendererSurfaceWidth: function(argCount) {
            if (argCount !== 1) return false;
            if (!this.currentFromStack(0)) return false;
            var width = currentRenderer.canvas.width;
            DEBUG > 0 && console.log("B3DAccel: primitiveGetRendererSurfaceWidth", width);
            return this.primHandler.popNandPushIfOK(argCount + 1, width);
        },

        primitiveGetRendererSurfaceHeight: function(argCount) {
            if (argCount !== 1) return false;
            if (!this.currentFromStack(0)) return false;
            var height = currentRenderer.canvas.height;
            DEBUG > 0 && console.log("B3DAccel: primitiveGetRendererSurfaceHeight", height);
            return this.primHandler.popNandPushIfOK(argCount + 1, height);
        },

        primitiveGetRendererSurfaceDepth: function(argCount) {
            if (argCount !== 1) return false;
            if (!this.currentFromStack(0)) return false;
            var depth = 32;
            DEBUG > 0 && console.log("B3DAccel: primitiveGetRendererSurfaceDepth", depth);
            return this.primHandler.popNandPushIfOK(argCount + 1, depth);
        },

        primitiveGetRendererColorMasks: function(argCount) {
            if (argCount !== 2) return false;
            var array = this.interpreterProxy.stackObjectValue(0);
            if (this.currentFromStack(1)) return false;
            if (array.pointersSize() !== 4) return false;
            var masks = [0x00FF0000, 0x0000FF00, 0x000000FF, 0xFF000000];
            for (var i = 0; i < 4; i++) {
                array.pointers[i] = this.interpreterProxy.positive32BitIntegerFor(masks[i]);
            }
            DEBUG > 0 && console.log("B3DAccel: primitiveGetRendererColorMasks", masks);
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveSetBufferRect: function(argCount) {
            if (argCount !== 5) return false;
            if (!this.currentFromStack(4)) return false;
            var x = this.interpreterProxy.stackIntegerValue(3);
            var y = this.interpreterProxy.stackIntegerValue(2);
            var w = this.interpreterProxy.stackIntegerValue(1);
            var h = this.interpreterProxy.stackIntegerValue(0);
            DEBUG > 1 && console.log("B3DAccel: primitiveSetBufferRect", x, y, w, h);
            this.b3dxSetViewport(currentRenderer, x, y, w, h);
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveSetViewport: function(argCount) {
            if (argCount !== 5) return false;
            if (!this.currentFromStack(4)) return false;
            var x = this.interpreterProxy.stackIntegerValue(3);
            var y = this.interpreterProxy.stackIntegerValue(2);
            var w = this.interpreterProxy.stackIntegerValue(1);
            var h = this.interpreterProxy.stackIntegerValue(0);
            DEBUG > 1 && console.log("B3DAccel: primitiveSetViewport", x, y, w, h);
            this.b3dxSetViewport(currentRenderer, x, y, w, h);
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveSetTransform: function(argCount) {
            if (argCount !== 3) return false;
            if (!this.currentFromStack(2)) return false;
            var modelViewMatrix = this.stackMatrix(1);
            var projectionMatrix = this.stackMatrix(0);
            if (!modelViewMatrix || !projectionMatrix) return false;
            DEBUG > 0 && console.log("B3DAccel: primitiveSetTransform", projectionMatrix, modelViewMatrix);
            OpenGL.glMatrixMode(GL.PROJECTION);
            OpenGL.glLoadMatrixf(projectionMatrix);
            OpenGL.glMatrixMode(GL.MODELVIEW);
            OpenGL.glLoadMatrixf(modelViewMatrix);
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveSetLights: function(argCount) {
            if (argCount !== 2) return false;
            if (!this.currentFromStack(1)) return false;
            var lightArray = this.interpreterProxy.stackObjectValue(0);
            if (this.interpreterProxy.failed()) return false;
            if (!this.b3dxDisableLights(currentRenderer)) return false;
            if (!lightArray) return false;
            DEBUG > 1 && console.log("B3DAccel: UNIMPLEMENTED primitiveSetLights " + lightArray);
            var lightCount = lightArray.pointersSize();
            for (var i = 0; i < lightCount; i++) {
                var light = this.fetchLightSource(i, lightArray);
                if (!this.b3dxLoadLight(currentRenderer, i, light)) return false;
            }
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveSetMaterial: function(argCount) {
            if (argCount !== 2) return false;
            if (!this.currentFromStack(1)) return false;
            var material = this.stackMaterialValue(0);
            DEBUG > 0 && console.log("B3DAccel: primitiveSetMaterial", renderer, material);
            if (!material) {
                OpenGL.glMaterialfv(GL.FRONT, GL.AMBIENT, [0.2, 0.2, 0.2, 1.0]);
                OpenGL.glMaterialfv(GL.FRONT, GL.DIFFUSE, [0.8, 0.8, 0.8, 1.0]);
                OpenGL.glMaterialfv(GL.FRONT, GL.SPECULAR, [0.0, 0.0, 0.0, 1.0]);
                OpenGL.glMaterialfv(GL.FRONT, GL.EMISSION, [0.0, 0.0, 0.0, 1.0]);
                OpenGL.glMaterialf(GL.FRONT, GL.SHININESS, 0.0);
                OpenGL.glDisable(GL.TEXTURE_2D);
            } else {
                // 0: ambient, 4: diffuse, 8: specular, 12: emission, 16: shininess
                this.vm.warnOnce("B3DAccel: primitiveSetMaterial not fully implemented");
                DEBUG > 1 && console.log("B3DAccel: UNIMPLEMENTED primitiveSetMaterial", material);
            }
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveSwapRendererBuffers: function(argCount) {
            if (argCount !== 1) return false;
            if (!this.currentFromStack(0)) return false;
            DEBUG > 1 && console.log("B3DAccel: primitiveSwapRendererBuffers", currentRenderer);
            // let browser display the rendered frame
            this.interpreterProxy.vm.breakNow();
            // tell the spinner we have been rendering
            this.primHandler.display.lastTick = this.vm.lastTick;

            if (DEBUG_WAIT) debugger; // wait after each frame
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveTextureDepth: function(argCount) {
            if (argCount !== 2) return false;
            if (!this.currentFromStack(1)) return false;
            var depth = 32;
            DEBUG > 0 && console.log("B3DAccel: primitiveTextureDepth", depth);
            return this.primHandler.popNandPushIfOK(argCount + 1, depth);
        },

        primitiveTextureGetColorMasks: function(argCount) {
            if (argCount !== 3) return false;
            if (!this.currentFromStack(2)) return false;
            var texture = this.interpreterProxy.stackIntegerValue(1);
            var array = this.interpreterProxy.stackObjectValue(0);
            if (array.pointersSize() !== 4) return false;
            var masks = [0x00FF0000, 0x0000FF00, 0x000000FF, 0xFF000000];
            for (var i = 0; i < 4; i++) {
                array.pointers[i] = this.interpreterProxy.positive32BitIntegerFor(masks[i]);
            }
            DEBUG > 0 && console.log("B3DAccel: primitiveTextureGetColorMasks", texture, masks);
            this.interpreterProxy.pop(argCount);
            return true;
        },

        primitiveTextureByteSex: function(argCount) {
            if (argCount !== 2) return false;
            if (!this.currentFromStack(1)) return false;
            // return > 0 if MSB, = 0 if LSB,
            var byteSex = 0;
            DEBUG > 0 && console.log("B3DAccel: primitiveTextureByteSex", byteSex);
            return this.primHandler.popNandPushIfOK(argCount + 1, byteSex);
        },

        primitiveTextureSurfaceHandle: function(argCount) {
            /* GL textures are not directly accessible */
            return false;
        },

        primitiveTextureUpload: function(argCount) {
            if (argCount !== 3) return false;
            if (!this.currentFromStack(2)) return false;
            var texture = this.interpreterProxy.stackIntegerValue(1);
            var form = this.interpreterProxy.stackObjectValue(0);
            if (form.pointersSize() < 4) return false;
            var bits = form.pointers[Squeak.Form_bits].words;
            var w = form.pointers[Squeak.Form_width];
            var h = form.pointers[Squeak.Form_height];
            var d = form.pointers[Squeak.Form_depth];
            var ppw = 32 / d;
            if (!bits || bits.length !== (w + ppw - 1) / ppw * h) return false;
            DEBUG > 1 && console.log("B3DAccel: primitiveTextureUpload", texture, w, h, d, bits);
            var result = this.b3dxUploadTexture(texture, w, h, d, bits);
            if (!result) return false;
            this.interpreterProxy.pop(argCount);
            return true;
        },

        b3dxCompositeTexture: function(texture, x, y, w, h, translucent) {
            DEBUG > 1 && console.log("B3DAccel: b3dxCompositeTexture", texture, x, y, w, h, translucent);
            if (!OpenGL.glIsTexture(texture)) return false;

            OpenGL.glMatrixMode(GL.MODELVIEW);
            OpenGL.glPushMatrix();
            OpenGL.glLoadIdentity();
            OpenGL.glMatrixMode(GL.PROJECTION);
            OpenGL.glPushMatrix();
            OpenGL.glLoadIdentity();

            var width = currentRenderer.viewport.w;
            var height = currentRenderer.viewport.h;
            OpenGL.glViewport(0, 0, width, height);
            OpenGL.glScaled(2.0/width, -2.0/height, 1.0);
            OpenGL.glTranslated(width*-0.5, height*-0.5, 0.0);

            //We haven't implemented glPushAttrib and glPopAttrib yet
            //OpenGL.glPushAttrib(GL.ALL_ATTRIB_BITS);
            // OpenGL.glShadeModel(GL.FLAT); // not implemented
            OpenGL.glEnable(GL.TEXTURE_2D);
            // OpenGL.glDisable(GL.COLOR_MATERIAL); // not implemented
            // OpenGL.glDisable(GL.DITHER); //
            OpenGL.glDisable(GL.LIGHTING);
            OpenGL.glDisable(GL.DEPTH_TEST);
            OpenGL.glDisable(GL.BLEND);
            OpenGL.glDisable(GL.CULL_FACE);
            OpenGL.glDepthMask(GL.FALSE);
            OpenGL.glColor4d(1.0, 1.0, 1.0, 1.0);

            if (translucent) {
                OpenGL.glEnable(GL.BLEND);
                OpenGL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
            }

            // subtract top and left position of canvas
            x -= currentRenderer.viewport.x;
            y -= currentRenderer.viewport.y;
            OpenGL.glBindTexture(GL.TEXTURE_2D, texture);
            OpenGL.glBegin(GL.QUADS);
                OpenGL.glTexCoord2d(0.0, 0.0);
                OpenGL.glVertex2i(x, y);
                OpenGL.glTexCoord2d(1.0, 0.0);
                OpenGL.glVertex2i(x+w, y);
                OpenGL.glTexCoord2d(1.0, 1.0);
                OpenGL.glVertex2i(x+w, y+h);
                OpenGL.glTexCoord2d(0.0, 1.0);
                OpenGL.glVertex2i(x, y+h);
            OpenGL.glEnd();

            // instead of this ...
            // OpenGL.glPopAttrib();
            // we do this:
            OpenGL.glDepthMask(GL.TRUE);
            OpenGL.glEnable(GL.DEPTH_TEST);
            OpenGL.glEnable(GL.CULL_FACE);
            OpenGL.glDisable(GL.BLEND);
            // OpenGL.glEnable(GL.COLOR_MATERIAL); // not implemented
            // OpenGL.glEnable(GL.DITHER); // not implemented
            OpenGL.glDisable(GL.TEXTURE_2D);
            // OpenGL.glShadeModel(GL.SMOOTH); // not implemented

            OpenGL.glPopMatrix();
            OpenGL.glMatrixMode(GL.MODELVIEW);
            OpenGL.glPopMatrix();

            return true;
        },

        adjustCanvas: function(renderer) {
            var canvas = renderer.canvas;
            var sq = this.primHandler.display.css;
            var x = renderer.viewport.x;
            var y = renderer.viewport.y;
            var w = renderer.viewport.w;
            var h = renderer.viewport.h;
            canvas.width = w;
            canvas.height = h;
            canvas.style.left = (sq.left + x * sq.scale) + "px";
            canvas.style.top = (sq.top + y * sq.scale) + "px";
            canvas.style.width = (w * sq.scale) + "px";
            canvas.style.height = (h * sq.scale) + "px";
            var warning = renderer.warning;
            if (warning) {
                warning.style.left = (sq.left + x * sq.scale) + "px";
                warning.style.top = (sq.top + y * sq.scale) + "px";
                warning.style.width = (w * sq.scale) + "px";
                warning.style.height = (h * sq.scale) + "px";
            }
        },

        b3dxSetViewport: function(renderer, x, y, w, h) {
            renderer.viewport = {x: x, y: y, w: w, h: h};
            this.adjustCanvas(renderer);
        },

        b3dxDisableLights: function(renderer) {
            OpenGL.glDisable(GL.LIGHTING);
            for (var i = 0; i < 8; i++) {
                OpenGL.glDisable(GL.LIGHT0 + i);
            }
            return true;
        },

        b3dxLoadLight: function(renderer, index, light) {
            DEBUG > 0 && console.log("B3DAccel: b3dxLoadLight", renderer, index, light);
            return true;
        },

        b3dxGetIntProperty: function(renderer, prop) {
            // switch (prop) {
            //     case 1: /* backface culling */
            //         if (!glIsEnabled(GL_CULL_FACE)) return 0;
            //         glGetIntegerv(GL_FRONT_FACE, & v);
            //         if (v == GL_CW) return 1;
            //         if (v == GL_CCW) return -1;
            //         return 0;
            //     case 2: /* polygon mode */
            //         glGetIntegerv(GL_POLYGON_MODE, & v);
            //         ERROR_CHECK;
            //         return v;
            //     case 3: /* point size */
            //         glGetIntegerv(GL_POINT_SIZE, & v);
            //         ERROR_CHECK;
            //         return v;
            //     case 4: /* line width */
            //         glGetIntegerv(GL_LINE_WIDTH, & v);
            //         ERROR_CHECK;
            //         return v;
            //     case 5: /* blend enable */
            //         return glIsEnabled(GL_BLEND);
            //     case 6: /* blend source factor */
            //     case 7: /* blend dest factor */
            //         if (prop == 6)
            //             glGetIntegerv(GL_BLEND_SRC, & v);
            //         else
            //             glGetIntegerv(GL_BLEND_DST, & v);
            //         ERROR_CHECK;
            //         switch (v) {
            //             case GL_ZERO: return 0;
            //             case GL_ONE: return 1;
            //             case GL_SRC_COLOR: return 2;
            //             case GL_ONE_MINUS_SRC_COLOR: return 3;
            //             case GL_DST_COLOR: return 4;
            //             case GL_ONE_MINUS_DST_COLOR: return 5;
            //             case GL_SRC_ALPHA: return 6;
            //             case GL_ONE_MINUS_SRC_ALPHA: return 7;
            //             case GL_DST_ALPHA: return 8;
            //             case GL_ONE_MINUS_DST_ALPHA: return 9;
            //             case GL_SRC_ALPHA_SATURATE: return 10;
            //             default: return -1;
            //         }
            // }
            return 0;
        },

        b3dxUploadTexture: function(texture, w, h, d, bits) {
            if (!OpenGL.glIsTexture(texture)) return false;
            OpenGL.glBindTexture(GL.TEXTURE_2D, texture);
            OpenGL.glTexSubImage2D(GL.TEXTURE_2D, 0, 0, 0, w, h, GL.RGBA, GL.UNSIGNED_BYTE, bits.buffer);
            return true;
        },

        fetchLightSource: function(index, lightArray) {
            var light = lightArray.pointers[index];
            if (!light) return null;
            DEBUG > 0 && console.log("B3DAccel: fetchLightSource", index, light);
            return light;
        },

        stackMatrix: function(stackIndex) {
            var m = this.interpreterProxy.stackObjectValue(stackIndex);
            if (!m.words || m.words.length !== 16) return null;
            return m.wordsAsFloat32Array();
        },

        stackMaterialValue: function(stackIndex) {
            var material = this.interpreterProxy.stackObjectValue(stackIndex);
            if (!material.words) return null;
            return material.wordsAsFloat32Array();
        },

    }
}

function registerB3DAcceleratorPlugin() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule('B3DAcceleratorPlugin', B3DAcceleratorPlugin());
    } else self.setTimeout(registerB3DAcceleratorPlugin, 100);
};

registerB3DAcceleratorPlugin();
