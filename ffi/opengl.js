// This is an OpenGL implementation for SqueakJS using WebGL.

// It is very much incomplete and currently only implements
// the subset of OpenGL that is used by Croquet Jasmine,
// but could be extended to support more.

// The functions are invoked via FFI, which takes care of
// converting the arguments and return values between JS
// and Smalltalk.

// The OpenGL context is global and created by B3DAcceleratorPlugin.
// Context switching is done by B3DAcceleratorPlugin.makeCurrent().

// helpful constant lookup:
// https://javagl.github.io/GLConstantsTranslator/GLConstantsTranslator.html

// TODO
// [ ] implement draw arrays
// [X] implement draw elements
// [ ] implement vertex buffer objects
// [X] implement material + lighting
// [X] implement clip planes
// [ ] implement fog
// [ ] implement tex coord gen
// [ ] fix glBitmap for size other than 640x480 (also, make pixel perfect)
// [ ] optimize list compilation glBegin/glEnd
// [ ] implement light attenuation
// [ ] implement spot lights
// [ ] implement color material
// [ ] emulate glLineWidth (WebGL usually only supports 1px lines)
//     e.g. using https://wwwtyro.net/2019/11/18/instanced-lines.html
// [ ] full OpenGL 1.0 support
// [ ] full OpenGL 1.1 support
// [ ] full OpenGL 1.2 support
// [ ] full OpenGL 1.3 support
// [ ] full OpenGL 1.4 support
// [ ] full OpenGL 1.5 support
// [ ] some extensions?

// OpenGL constants (many missing in WebGL)
var GL;

function OpenGL() {
    "use strict";

    var DEBUG = 0;
    // 0 = off
    // 1 = some (errors, warnings)
    // 2 = lots (function calls)
    // 3 = all (call details)

    var identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);

    // Primitive attributes for glBegin/glEnd
    var flagCounter = 0;
    var HAS_NORMAL =            1 << flagCounter++;
    var HAS_COLOR =             1 << flagCounter++;
    var HAS_TEXCOORD =          1 << flagCounter++;

    // additional flags for selecting shader
    var USE_TEXTURE =           1 << flagCounter++;
    var USE_ALPHA_TEST =        1 << flagCounter++;
    var USE_POINT_SIZE =        1 << flagCounter++;
    var NUM_LIGHTS_MASK =      (1 << flagCounter++)  // 3 bits for number of lights (0-7)
                             + (1 << flagCounter++)
                             + (1 << flagCounter++);
    var NUM_CLIP_PLANES_MASK = (1 << flagCounter++)  // 3 bits for number of clip planes (0-5)
                             + (1 << flagCounter++)
                             + (1 << flagCounter++);
    var FOG_MASK =             (1 << flagCounter++)  // 2 bits for fog mode (off, linear, exp, exp2)
                             + (1 << flagCounter++);

    // this math is silly but fun ...
    var NUM_LIGHTS_SHIFT = Math.floor(Math.log2(NUM_LIGHTS_MASK)) - 2;
    var MAX_LIGHTS = (NUM_LIGHTS_MASK >> NUM_LIGHTS_SHIFT) + 1;
    var ANY_LIGHTS = (MAX_LIGHTS-1) << NUM_LIGHTS_SHIFT;
    if (ANY_LIGHTS !== NUM_LIGHTS_MASK) throw Error("OpenGL: bad NUM_LIGHTS_MASK");

    var NUM_CLIP_PLANES_SHIFT = Math.floor(Math.log2(NUM_CLIP_PLANES_MASK)) - 2;
    var MAX_CLIP_PLANES = (NUM_CLIP_PLANES_MASK >> NUM_CLIP_PLANES_SHIFT) + 1;
    var ANY_CLIP_PLANES = (MAX_CLIP_PLANES-1) << NUM_CLIP_PLANES_SHIFT;
    if (ANY_CLIP_PLANES !== NUM_CLIP_PLANES_MASK) throw Error("OpenGL: bad NUM_CLIP_PLANES_MASK");

    var FOG_SHIFT = Math.floor(Math.log2(FOG_MASK)) - 1;
    var MAX_FOG = (FOG_MASK >> FOG_SHIFT) + 1;
    var ANY_FOG = (MAX_FOG-1) << FOG_SHIFT;
    if (ANY_FOG !== FOG_MASK) throw Error("OpenGL: bad ANY_FOG");
    var NO_FOG     = 0;
    var LINEAR_FOG = 1;
    var EXP_FOG    = 2;
    var EXP2_FOG   = 3;

    var gl;    // the emulated OpenGL state
    var webgl; // the actual WebGL context

    return {
        getModuleName: function() { return 'libGL.so (SqueakJS)'; },

        setInterpreter: function(anInterpreterProxy) {
            this.vm = anInterpreterProxy.vm;
            this.ffi = this.vm.primHandler;
            return true;
        },

        ffiFunctionNotFoundHandler: function(name, args) {
            this.vm.warnOnce("OpenGL: UNIMPLEMENTED (missing) " + name);
            if (DEBUG > 0) debugger;
            return null; // do not fail but return nil
        },

        initialiseModule: function() {
            DEBUG > 1 && console.log("OpenGL: initialiseModule");
            if (!GL) initGLConstants();
            // connect to B3DAcceleratorPlugin to get WebGL context
            var modules = SqueakJS.vm.primHandler.loadedModules;
            var B3DAcceleratorPlugin = modules['B3DAcceleratorPlugin'];
            if (!B3DAcceleratorPlugin) throw Error("OpenGL: B3DAcceleratorPlugin not loaded");
            this.GL = GL;
            B3DAcceleratorPlugin.setOpenGL(this); // will call makeCurrent()
        },

        makeCurrent: function(renderer) {
            if (webgl === renderer.webgl) return; // already current
            DEBUG > 1 && console.log("OpenGL: makeCurrent", renderer);
            webgl = renderer.webgl;
            gl = renderer.opengl;
            if (!gl) renderer.opengl = this.initGL();
        },

        initGL: function() {
            DEBUG > 0 && console.log("OpenGL: initGL");
            // if webgl-lint is loaded, configure it
            const ext = webgl.getExtension('GMAN_debug_helper');
            if (ext) ext.setConfiguration({
                throwOnError: false,
            });
            // if Spector script is loaded, capture WebGL calls
            if (typeof SPECTOR !== "undefined") {
                var spector = new SPECTOR.Spector();
                spector.captureContext(webgl);
                spector.displayUI();
            }
            // initialize emulated OpenGL state
            gl = {
                alphaTest: false,
                alphaFunc: null,
                alphaRef: 0,
                extensions: "ARB_texture_non_power_of_two SGIS_generate_mipmap",
                color: new Float32Array(4),
                normal: new Float32Array([0, 0, 1]),
                texCoord: new Float32Array(2),
                primitive: null, // for glBegin/glEnd
                primitiveAttrs: 0, // for glVertex
                clipPlanes: [], // clip plane equations
                clientState: {}, // enabled arrays by attr
                fogMode: GL.EXP, // fog mode
                fogEnabled: false, // fog enabled
                fogDensity: 1, // fog density
                fogStart: 0, // fog start
                fogEnd: 1, // fog end
                fogColor: new Float32Array([0, 0, 0, 0]), // fog color
                fogHint: GL.DONT_CARE, // fog hint
                shaders: {}, // shader programs by attr/flags
                matrixMode: 0, // current matrix mode
                matrices: {}, // matrix stacks by mode
                matrix: null, // current matrix (matrices[mode][0])
                lightingEnabled: false,
                lights: [], // light states
                lightModelAmbient: null, // scene ambient color
                material: null, // material state
                textureIdGen: 0, // texture id generator
                textures: {}, // webgl texture objects by id
                texture: null, // texture
                textureEnabled: false, // texture enabled
                textureEnvMode: GL.MODULATE, // texture environment mode
                listIdGen: 0, // display list id generator
                lists: {}, // display lists by id
                list: null, // current display list
                listMode: 0, // current display list mode
                listBase: 0, // base for glCallLists
                pixelStoreUnpackRowLength: 0,
                pixelStoreUnpackSkipRows: 0,
                pixelStoreUnpackSkipPixels: 0,
                rasterPos: new Float32Array(4),
                rasterColor: new Float32Array([1, 1, 1, 1]),
                bitmapTexture: null, // texture for glBitmap
                bitmapVertexBuffer: null, // vertex buffer for glBitmap
                bitmapShader: { // shader program for glBitmap
                    program: null,
                    locations: {},
                }, // shader for glBitmap
                viewport: new Int32Array([0, 0, 0, 0]),
                depthRange: new Float32Array([0, 1]),
            };

            // set initial state
            gl.matrices[GL.MODELVIEW] = [new Float32Array(identity)];
            gl.matrices[GL.PROJECTION] = [new Float32Array(identity)];
            gl.matrixMode = GL.MODELVIEW;
            gl.matrix = gl.matrices[gl.matrixMode][0];
            gl.color.set([1, 1, 1, 1]);
            for (var i = 0; i < MAX_CLIP_PLANES; i++) {
                gl.clipPlanes[i] = {
                    enabled: false,
                    equation: new Float32Array([0, 0, 0, 0]),
                };
            }
            for (var i = 0; i < MAX_LIGHTS; i++) {
                gl.lights[i] = {
                    enabled: false,
                    ambient: new Float32Array([0, 0, 0, 1]),
                    diffuse: new Float32Array(i === 0 ? [1, 1, 1, 1] : [0, 0, 0, 1]),
                    specular: new Float32Array(i === 0 ? [1, 1, 1, 1] : [0, 0, 0, 1]),
                    position: new Float32Array([0, 0, 1, 0]),
                };
            }
            gl.lightModelAmbient = new Float32Array([0.2, 0.2, 0.2, 1]);
            gl.material = {
                ambient: new Float32Array([0.2, 0.2, 0.2, 1]),
                diffuse: new Float32Array([0.8, 0.8, 0.8, 1]),
                specular: new Float32Array([0, 0, 0, 1]),
                emission: new Float32Array([0, 0, 0, 1]),
                shininess: 0,
            };
            var clientStates = ["vertexArray", "normalArray", "colorArray", "textureCoordArray"];
            for (var i = 0; i < clientStates.length; i++) {
                var attr = clientStates[i];
                gl.clientState[attr] = {
                    enabled: false,
                    size: 0,
                    type: GL.FLOAT,
                    stride: 0,
                    pointer: null,
                    // binding: null, TODO: support VBOs
                }
            }
            return gl;
        },

        destroyGL: function(renderer) {
            DEBUG > 0 && console.log("OpenGL: destroyGL");
            // TODO: delete textures, arrays, shaders?
            renderer.opengl = null;
            webgl = null;
            gl = null;
        },

        // FFI functions get JS args, return JS result

        addToList: function(name, args) {
            if (!gl.list) return false;
            gl.list.commands.push({name: name, args: args});
            if (gl.listMode === GL.COMPILE) {
                DEBUG > 1 && console.log("[COMPILE]", name, args);
                return true;
            }
            return false;
        },

        glAlphaFunc: function(func, ref) {
            if (gl.listMode && this.addToList("glAlphaFunc", [func, ref])) return;
            DEBUG > 1 && console.log("glAlphaFunc", GL_Symbol(func), ref);
            gl.alphaFunc = func;
            gl.alphaRef = ref;
        },

        glBegin: function(mode) {
            if (gl.listMode && this.addToList("glBegin", [mode])) return;
            DEBUG > 1 && console.log("glBegin", GL_Symbol(mode, 'POINTS'));
            gl.primitive = {
                mode: mode,
                vertices: [],
                vertexSize: 0,
                vertexAttrs: 0,
            }
            gl.primitiveAttrs = 0;
        },

        glBindTexture: function(target, texture) {
            if (gl.listMode && this.addToList("glBindTexture", [target, texture])) return;
            DEBUG > 1 && console.log("glBindTexture", GL_Symbol(target), texture);
            var textureObj = gl.textures[texture];
            if (!textureObj) throw Error("OpenGL: texture not found");
            webgl.bindTexture(target, textureObj);
            gl.texture = textureObj;
        },

        glBitmap: function(width, height, xorig, yorig, xmove, ymove, bitmap) {
            // bitmap is supposed to be declared as "GLubyte*" per OpenGL spec,
            // which the FFI would convert to Uint8Array for us. However, the
            // image FFI declaration uses "void*", probably because it makes no
            // difference in C, a pointer is a pointer. In JS, we get an
            // ArrayBuffer for "void*" so we need to convert it to Uint8Array
            // ourselves.
            if (!bitmap.buffer) bitmap = new Uint8Array(bitmap);
            if (gl.listMode && this.addToList("glBitmap", [width, height, xorig, yorig, xmove, ymove, bitmap])) return;
            DEBUG > 1 && console.log("glBitmap", width, height, xorig, yorig, xmove, ymove, bitmap);
            if (width > 0 && height > 0) {
                // we need to convert the 1-bit deep bitmap to a 1-byte
                // per pixel texture in ALPHA format, with the bitmap
                // mapping 0-bits to transparent, 1-bits to opaque,
                // and then draw it as a textured quad covering the viewport
                var texels = new Uint8Array(width * height);
                var bytesPerRow = Math.ceil(width / 32) * 4;
                for (var y = 0; y < height; y++) {
                    var byteIndex = y * bytesPerRow;
                    var bitIndex = 7;
                    for (var x = 0; x < width; x++) {
                        var bit = bitmap[byteIndex] & (1 << bitIndex);
                        if (bit) texels[y * width + x] = 255;
                        bitIndex--;
                        if (bitIndex < 0) {
                            byteIndex++;
                            bitIndex = 7;
                        }
                    }
                }
                // debug: print bitmap
                // s=''; for (y = height -1 ; y >= 0; y--) { for (x = 0; x < width; x++) s += texels[y * width + x] ? '⬛️' : '⬜️'; s+='\n'}; console.log(s)
                var texture = gl.bitmapTexture;
                if (!texture) {
                    texture = gl.bitmapTexture = webgl.createTexture();
                    webgl.bindTexture(webgl.TEXTURE_2D, texture);
                    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER, webgl.LINEAR);
                    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MAG_FILTER, webgl.LINEAR);
                    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_S, webgl.CLAMP_TO_EDGE);
                    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_T, webgl.CLAMP_TO_EDGE);
                } else {
                    webgl.bindTexture(webgl.TEXTURE_2D, texture);
                }
                webgl.pixelStorei(webgl.UNPACK_ALIGNMENT, 1);
                webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.ALPHA, width, height, 0, webgl.ALPHA, webgl.UNSIGNED_BYTE, texels);
                webgl.pixelStorei(webgl.UNPACK_ALIGNMENT, 4);

                webgl.disable(webgl.CULL_FACE);
                webgl.disable(webgl.DEPTH_TEST);
                webgl.disable(webgl.BLEND);
                webgl.colorMask(true, true, true, true);
                webgl.viewport(0, 0, webgl.drawingBufferWidth, webgl.drawingBufferHeight);
                var vertexBuffer = gl.bitmapVertexBuffer;
                if (!vertexBuffer) {
                    var vertices = new Float32Array([
                        0, 0,
                        1, 0,
                        0, 1,
                        1, 1,
                    ]);
                    vertexBuffer = gl.bitmapVertexBuffer = webgl.createBuffer();
                    webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
                    webgl.bufferData(webgl.ARRAY_BUFFER, vertices, webgl.STATIC_DRAW);
                } else {
                    webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
                }
                var shader = gl.bitmapShader;
                if (!shader.program) {
                    shader.program = webgl.createProgram();
                    var vs = webgl.createShader(webgl.VERTEX_SHADER);
                    webgl.shaderSource(vs, `
                        attribute vec2 a_position;
                        uniform vec3 u_raster;
                        uniform vec2 u_rasterOffset;
                        uniform vec2 u_rasterScale;
                        uniform vec2 u_translate;
                        uniform vec2 u_scale;
                        varying vec2 v_texcoord;
                        void main() {
                            vec2 raster = u_raster.xy * u_rasterScale + u_rasterOffset;
                            vec2 pos = (a_position + raster) * u_scale + u_translate;
                            gl_Position = vec4(pos, u_raster.z, 1);
                            v_texcoord = a_position;
                        }
                    `);
                    webgl.compileShader(vs);
                    if (!webgl.getShaderParameter(vs, webgl.COMPILE_STATUS)) {
                        console.error("OpenGL: vertex shader compile error: " + webgl.getShaderInfoLog(vs));
                        debugger;
                        return;
                    }
                    var fs = webgl.createShader(webgl.FRAGMENT_SHADER);
                    webgl.shaderSource(fs, `
                        precision mediump float;
                        uniform sampler2D u_texture;
                        uniform vec4 u_color;
                        varying vec2 v_texcoord;
                        void main() {
                            float alpha = texture2D(u_texture, v_texcoord).a;
                            if (alpha < 0.5) discard;
                            gl_FragColor = u_color;
                        }
                    `);
                    webgl.compileShader(fs);
                    if (!webgl.getShaderParameter(fs, webgl.COMPILE_STATUS)) {
                        console.error("OpenGL: fragment shader compile error: " + webgl.getShaderInfoLog(fs));
                        debugger;
                        return;
                    }
                    webgl.attachShader(shader.program, vs);
                    webgl.attachShader(shader.program, fs);
                    webgl.linkProgram(shader.program);
                    if (!webgl.getProgramParameter(shader.program, webgl.LINK_STATUS)) {
                        console.error("OpenGL: shader link error: " + webgl.getProgramInfoLog(shader.program));
                        debugger
                        return;
                    }
                    shader.locations = {
                        a_position: webgl.getAttribLocation(shader.program, "a_position"),
                        u_texture: webgl.getUniformLocation(shader.program, "u_texture"),
                        u_color: webgl.getUniformLocation(shader.program, "u_color"),
                        u_raster: webgl.getUniformLocation(shader.program, "u_raster"),
                        u_rasterOffset: webgl.getUniformLocation(shader.program, "u_rasterOffset"),
                        u_rasterScale: webgl.getUniformLocation(shader.program, "u_rasterScale"),
                        u_translate: webgl.getUniformLocation(shader.program, "u_translate"),
                        u_scale: webgl.getUniformLocation(shader.program, "u_scale"),
                    };
                }
                webgl.useProgram(shader.program);
                webgl.enableVertexAttribArray(shader.locations.a_position);
                webgl.vertexAttribPointer(shader.locations.a_position, 2, webgl.FLOAT, false, 0, 0);
                webgl.uniform1i(shader.locations.u_texture, 0);
                webgl.uniform4fv(shader.locations.u_color, gl.rasterColor);
                // these seem to work for 640x480... I can't figure out the right transform yet
                if (!this.bitmapScale) this.bitmapScale = [0.0311, 0.0419];
                if (!this.bitmapTranslate) this.bitmapTranslate = [-1, -1];
                if (!this.bitmapRasterOffset) this.bitmapRasterOffset = [0, 0];
                if (!this.bitmapRasterScale) this.bitmapRasterScale = [0.1, 0.1];
                // these properties allow intereactive debugging
                webgl.uniform3f(shader.locations.u_raster, gl.rasterPos[0] + xorig, gl.rasterPos[1] + yorig, gl.rasterPos[2]);
                webgl.uniform2fv(shader.locations.u_rasterOffset, this.bitmapRasterOffset);
                webgl.uniform2fv(shader.locations.u_rasterScale, this.bitmapRasterScale);
                webgl.uniform2fv(shader.locations.u_translate, this.bitmapTranslate);
                webgl.uniform2fv(shader.locations.u_scale, this.bitmapScale);
                webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, 4);
                webgl.disableVertexAttribArray(shader.locations.a_position);
                webgl.bindBuffer(webgl.ARRAY_BUFFER, null);
                webgl.useProgram(null);
                webgl.bindTexture(webgl.TEXTURE_2D, null);
                webgl.enable(webgl.CULL_FACE);
                webgl.enable(webgl.DEPTH_TEST);
                webgl.enable(webgl.BLEND);
            }
            gl.rasterPos[0] += xmove;
            gl.rasterPos[1] += ymove;
        },

        glBlendFunc: function(sfactor, dfactor) {
            if (gl.listMode && this.addToList("glBlendFunc", [sfactor, dfactor])) return;
            DEBUG > 1 && console.log("glBlendFunc", GL_Symbol(sfactor), GL_Symbol(dfactor));
            webgl.blendFunc(sfactor, dfactor);
        },

        glCallList: function(list) {
            if (gl.listMode && this.addToList("glCallList", [list])) return;
            DEBUG > 1 && console.log("glCallList", list, "START");
            this.executeList(list);
            DEBUG > 1 && console.log("glCallList", list, "DONE");
        },

        glCallLists: function(n, type, lists) {
            if (gl.listMode && this.addToList("glCallLists", [n, type, lists])) return;
            DEBUG > 1 && console.log("glCallLists", n, GL_Symbol(type), lists);
            var array;
            switch (type) {
                case GL.BYTE:
                    array = new Int8Array(lists);
                    break;
                case GL.UNSIGNED_BYTE:
                    array = new Uint8Array(lists);
                    break;
                case GL.INT:
                    array = new Int32Array(lists);
                    break;
                case GL.UNSIGNED_INT:
                    array = new Uint32Array(lists);
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glCallLists type", GL_Symbol(type))
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glCallLists type " + GL_Symbol(type));
                    return;
            }
            for (var i = 0; i < n; i++) {
                var list = gl.listBase + array[i];
                this.executeList(list);
            }
        },

        glClear: function(mask) {
            if (gl.listMode && this.addToList("glClear", [mask])) return;
            var maskString = "";
            if (mask & webgl.COLOR_BUFFER_BIT) maskString += " COLOR";
            if (mask & webgl.DEPTH_BUFFER_BIT) maskString += " DEPTH";
            if (mask & webgl.STENCIL_BUFFER_BIT) maskString += " STENCIL";
            DEBUG > 1 && console.log("glClear"+ maskString);
            webgl.clear(mask);
            // B3DAcceleratorPlugin will call vm.breakNow()
            // to emulate double buffering (which will return
            // control to the browser which will flush the canvas).
            // We discourage breaking until then to avoid flicker
            // glClear is a good place for that since it's usually
            // called at least once per frame
            this.vm.breakAfter(500);
        },

        glClearColor: function(red, green, blue, alpha) {
            if (gl.listMode && this.addToList("glClearColor", [red, green, blue, alpha])) return;
            DEBUG > 1 && console.log("glClearColor", red, green, blue, alpha);
            webgl.clearColor(red, green, blue, alpha);
        },

        glColor3f: function(red, green, blue) {
            if (gl.listMode && this.addToList("glColor3f", [red, green, blue])) return;
            DEBUG > 1 && console.log("glColor3f", red, green, blue);
            gl.color[0] = red;
            gl.color[1] = green;
            gl.color[2] = blue;
            gl.color[3] = 1;
            gl.primitiveAttrs |= HAS_COLOR;
        },

        glColor3fv: function(v) {
            if (gl.listMode && this.addToList("glColor3fv", [v.slice()])) return;
            DEBUG > 1 && console.log("glColor3fv", Array.from(v));
            gl.color.set(v);
            gl.color[3] = 1;
            gl.primitiveAttrs |= HAS_COLOR;
        },

        glColor4d: function(red, green, blue, alpha) {
            if (gl.listMode && this.addToList("glColor4d", [red, green, blue, alpha])) return;
            DEBUG > 1 && console.log("glColor4d", red, green, blue, alpha);
            gl.color[0] = red;
            gl.color[1] = green;
            gl.color[2] = blue;
            gl.color[3] = alpha;
            gl.primitiveAttrs |= HAS_COLOR;
        },

        glColor4f: function(red, green, blue, alpha) {
            if (gl.listMode && this.addToList("glColor4f", [red, green, blue, alpha])) return;
            DEBUG > 1 && console.log("glColor4f", red, green, blue, alpha);
            gl.color[0] = red;
            gl.color[1] = green;
            gl.color[2] = blue;
            gl.color[3] = alpha;
            gl.primitiveAttrs |= HAS_COLOR;
        },

        glColor4fv: function(v) {
            if (gl.listMode && this.addToList("glColor4fv", [v.slice()])) return;
            DEBUG > 1 && console.log("glColor4fv", Array.from(v));
            gl.color.set(v);
            gl.primitiveAttrs |= HAS_COLOR;
        },

        glColorPointer: function(size, type, stride, pointer) {
            if (gl.listMode && this.addToList("glColorPointer", [size, type, stride, pointer])) return;
            DEBUG > 1 && console.log("glColorPointer", size, GL_Symbol(type), stride, pointer);
            gl.clientState.colorArray.size = size;
            gl.clientState.colorArray.type = type;
            gl.clientState.colorArray.stride = stride;
            gl.clientState.colorArray.pointer = pointer;
        },

        glColorMask: function(red, green, blue, alpha) {
            if (gl.listMode && this.addToList("glColorMask", [red, green, blue, alpha])) return;
            DEBUG > 1 && console.log("glColorMask", red, green, blue, alpha);
            webgl.colorMask(red, green, blue, alpha);
        },

        glClipPlane: function(plane, equation) {
            if (gl.listMode && this.addToList("glClipPlane", [plane, equation])) return;
            DEBUG > 1 && console.log("glClipPlane", GL_Symbol(plane), Array.from(equation));
            var clipPlane = gl.clipPlanes[plane - GL.CLIP_PLANE0];
            // multiply by inverse of modelview matrix
            var m = new Float32Array(16);
            invertMatrix(gl.matrices[GL.MODELVIEW][0], m);
            transposeMatrix(m);
            multVec4(m, equation, clipPlane.equation);
        },

        glDeleteLists: function(list, range) {
            DEBUG > 1 && console.log("glDeleteLists", list, range);
            for (var i = 0; i < range; i++) {
                delete gl.lists[list + i];
            }
        },

        glDeleteTextures: function(n, textures) {
            DEBUG > 1 && console.log("glDeleteTextures", n, Array.from(textures));
            for (var i = 0; i < n; i++) {
                var id = textures[i];
                var texture = gl.textures[id];
                if (texture) {
                    webgl.deleteTexture(texture);
                    if (gl.texture === texture) gl.texture = null;
                }
                delete gl.textures[id];
            }
        },

        glDepthFunc: function(func) {
            if (gl.listMode && this.addToList("glDepthFunc", [func])) return;
            DEBUG > 1 && console.log("glDepthFunc", GL_Symbol(func));
            webgl.depthFunc(func);
        },

        glDepthMask: function(flag) {
            if (gl.listMode && this.addToList("glDepthMask", [flag])) return;
            DEBUG > 1 && console.log("glDepthMask", flag);
            webgl.depthMask(flag);
        },

        glDepthRange: function(zNear, zFar) {
            if (gl.listMode && this.addToList("glDepthRange", [zNear, zFar])) return;
            DEBUG > 1 && console.log("glDepthRange", zNear, zFar);
            webgl.depthRange(zNear, zFar);
        },

        glDisable: function(cap) {
            if (gl.listMode && this.addToList("glDisable", [cap])) return;
            switch (cap) {
                case GL.ALPHA_TEST:
                    DEBUG > 1 && console.log("glDisable GL_ALPHA_TEST");
                    gl.alphaTest = false;
                    break;
                case webgl.BLEND:
                    DEBUG > 1 && console.log("glDisable GL_BLEND");
                    webgl.disable(webgl.BLEND);
                    break;
                case GL.CLIP_PLANE0:
                case GL.CLIP_PLANE1:
                case GL.CLIP_PLANE2:
                case GL.CLIP_PLANE3:
                case GL.CLIP_PLANE4:
                case GL.CLIP_PLANE5:
                case GL.CLIP_PLANE6:
                case GL.CLIP_PLANE7:
                    DEBUG > 1 && console.log("glDisable GL_CLIP_PLANE" + (cap - GL.CLIP_PLANE0));
                    gl.clipPlanes[cap - GL.CLIP_PLANE0].enabled = false;
                    break;
                case webgl.CULL_FACE:
                    DEBUG > 1 && console.log("glDisable GL.CULL_FACE");
                    webgl.disable(webgl.CULL_FACE);
                    break;
                case webgl.DEPTH_TEST:
                    DEBUG > 1 && console.log("glDisable GL_DEPTH_TEST");
                    webgl.disable(webgl.DEPTH_TEST);
                    break;
                case GL.FOG:
                    DEBUG > 1 && console.log("glDisable GL_FOG");
                    gl.fogEnabled = false;
                    break;
                case GL.NORMALIZE:
                    DEBUG > 1 && console.log("glDisable GL_NORMALIZE");
                    // we always normalize normals
                    break;
                case GL.LIGHT0:
                case GL.LIGHT1:
                case GL.LIGHT2:
                case GL.LIGHT3:
                case GL.LIGHT4:
                case GL.LIGHT5:
                case GL.LIGHT6:
                case GL.LIGHT7:
                    DEBUG > 1 && console.log("glDisable GL_LIGHT" + (cap - GL.LIGHT0));
                    gl.lights[cap - GL.LIGHT0].enabled = false;
                    break;
                case GL.LIGHTING:
                    DEBUG > 1 && console.log("glDisable GL_LIGHTING");
                    gl.lightingEnabled = false;
                    break;
                case webgl.POLYGON_OFFSET_FILL:
                    DEBUG > 1 && console.log("glDisable GL_POLYGON_OFFSET_FILL");
                    webgl.disable(webgl.POLYGON_OFFSET_FILL);
                    break;
                case webgl.STENCIL_TEST:
                    DEBUG > 1 && console.log("glDisable GL_STENCIL_TEST");
                    webgl.disable(webgl.STENCIL_TEST);
                    break;
                case webgl.TEXTURE_2D:
                    DEBUG > 1 && console.log("glDisable GL_TEXTURE_2D");
                    gl.textureEnabled = false;
                    break;
                case GL.TEXTURE_GEN_S:
                case GL.TEXTURE_GEN_T:
                case GL.TEXTURE_GEN_R:
                case GL.TEXTURE_GEN_Q:
                    if (DEBUG) console.log("UNIMPLEMENTED glDisable GL_TEXTURE_GEN_" + (cap - GL.TEXTURE_GEN_S));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glDisable GL_TEXTURE_GEN_" + (cap - GL.TEXTURE_GEN_S));
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glDisable", GL_Symbol(cap));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glDisable " + GL_Symbol(cap));
            }
        },

        glDisableClientState: function(cap) {
            if (gl.listMode && this.addToList("glDisableClientState", [cap])) return;
            switch (cap) {
                case GL.VERTEX_ARRAY:
                    DEBUG > 1 && console.log("glDisableClientState GL_VERTEX_ARRAY");
                    gl.clientState.vertexArray.enabled = false;
                    return;
                case GL.NORMAL_ARRAY:
                    DEBUG > 1 && console.log("glDisableClientState GL_NORMAL_ARRAY");
                    gl.clientState.normalArray.enabled = false;
                    return;
                case GL.COLOR_ARRAY:
                    DEBUG > 1 && console.log("glDisableClientState GL_COLOR_ARRAY");
                    gl.clientState.colorArray.enabled = false;
                    return;
                case GL.TEXTURE_COORD_ARRAY:
                    DEBUG > 1 && console.log("glDisableClientState GL_TEXTURE_COORD_ARRAY");
                    gl.clientState.textureCoordArray.enabled = false;
                    return;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glDisableClientState", GL_Symbol(cap));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glDisableClientState " + GL_Symbol(cap));
            }
        },

        glDrawArrays: function(mode, first, count) {
            if (gl.listMode && this.addToList("glDrawArrays", [mode, first, count])) return;
            var geometryFlags = 0;
            if (gl.clientState.normalArray.enabled) geometryFlags |= HAS_NORMAL;
            if (gl.clientState.colorArray.enabled) geometryFlags |= HAS_COLOR;
            if (gl.clientState.textureCoordArray.enabled) geometryFlags |= HAS_TEXCOORD;
            if (mode === GL.POINTS) geometryFlags |= USE_POINT_SIZE;

            var shader = this.getShader(geometryFlags);
            if (!shader.program) {
                if (DEBUG) console.warn("UNIMPLEMENTED glDrawArrays shader: " + shader.label);
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glDrawArrays shader: " + shader.label);
                return;
            }

            var vertexArray = gl.clientState.vertexArray;
            if (!vertexArray.enabled || !vertexArray.pointer) {
                DEBUG > 0 && console.warn("glDrawArrays: GL_VERTEX_ARRAY incomplete, skipping");
                return;
            }

            DEBUG > 1 && console.log("glDrawArrays", GL_Symbol(mode, 'POINTS'), first, count, shader.label);

            webgl.useProgram(shader.program);
            this.setShaderUniforms(shader);
            var loc = shader.locations;

            var vertexBuffer = webgl.createBuffer();
            webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
            webgl.bufferData(webgl.ARRAY_BUFFER, vertexArray.pointer, webgl.DYNAMIC_DRAW);
            webgl.vertexAttribPointer(loc['aPosition'], vertexArray.size, vertexArray.type, false, vertexArray.stride, 0);
            webgl.enableVertexAttribArray(loc['aPosition']);

            var normalBuffer;
            if (loc['aNormal'] >= 0) {
                var normalArray = gl.clientState.normalArray;
                normalBuffer = webgl.createBuffer();
                webgl.bindBuffer(webgl.ARRAY_BUFFER, normalBuffer);
                webgl.bufferData(webgl.ARRAY_BUFFER, normalArray.pointer, webgl.DYNAMIC_DRAW);
                webgl.vertexAttribPointer(loc['aNormal'], normalArray.size, normalArray.type, false, normalArray.stride, 0);
                webgl.enableVertexAttribArray(loc['aNormal']);
            }

            var colorBuffer;
            if (loc['aColor'] >= 0) {
                var colorArray = gl.clientState.colorArray;
                colorBuffer = webgl.createBuffer();
                webgl.bindBuffer(webgl.ARRAY_BUFFER, colorBuffer);
                webgl.bufferData(webgl.ARRAY_BUFFER, colorArray.pointer, webgl.DYNAMIC_DRAW);
                webgl.vertexAttribPointer(loc['aColor'], colorArray.size, colorArray.type, false, colorArray.stride, 0);
                webgl.enableVertexAttribArray(loc['aColor']);
            }

            var texCoordBuffer;
            if (loc['aTexCoord'] >= 0) {
                var texCoordArray = gl.clientState.textureCoordArray;
                texCoordBuffer = webgl.createBuffer();
                webgl.bindBuffer(webgl.ARRAY_BUFFER, texCoordBuffer);
                webgl.bufferData(webgl.ARRAY_BUFFER, texCoordArray.pointer, webgl.DYNAMIC_DRAW);
                webgl.vertexAttribPointer(loc['aTexCoord'], texCoordArray.size, texCoordArray.type, false, texCoordArray.stride, 0);
                webgl.enableVertexAttribArray(loc['aTexCoord']);
            }

            webgl.drawArrays(mode, first, count);

            webgl.useProgram(null);

            webgl.bindBuffer(webgl.ARRAY_BUFFER, null);

            webgl.disableVertexAttribArray(loc['aPosition']);
            webgl.deleteBuffer(vertexBuffer);
            if (normalBuffer) {
                webgl.disableVertexAttribArray(loc['aNormal']);
                webgl.deleteBuffer(normalBuffer);
            }
            if (colorBuffer) {
                webgl.disableVertexAttribArray(loc['aColor']);
                webgl.deleteBuffer(colorBuffer);
            }
            if (texCoordBuffer) {
                webgl.disableVertexAttribArray(loc['aTexCoord']);
                webgl.deleteBuffer(texCoordBuffer);
            }
        },

        glDrawElements: function(mode, count, type, indicesPtr) {
            if (gl.listMode && this.addToList("glDrawElements", [mode, count, type, indicesPtr])) return;
            var indices;
            switch (type) {
                case GL.UNSIGNED_BYTE:
                    indices = new Uint8Array(indicesPtr);
                    break;
                case GL.UNSIGNED_SHORT:
                    indices = new Uint16Array(indicesPtr);
                    break;
                case GL.UNSIGNED_INT:
                    // not directly supported by WebGL without OES_element_index_uint
                    var indices32 = new Uint32Array(indicesPtr);
                    var max = Math.max.apply(null, indices32);
                    if (max > 0xFFFF) console.warn("OpenGL: glDrawElements with indices > 65535 not supported, truncating", max);
                    if (max <= 0xFF) {
                        indices = new Uint8Array(indices32.length);
                        type = GL.UNSIGNED_BYTE;
                    } else {
                        indices = new Uint16Array(indices32.length);
                        type = GL.UNSIGNED_SHORT;
                    }
                    for (var i = 0; i < count; i++) indices[i] = indices32[i];
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glDrawElements type", GL_Symbol(type));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glDrawElements type " + GL_Symbol(type));
                    return;
            }

            var geometryFlags = 0;
            if (gl.clientState.normalArray.enabled) geometryFlags |= HAS_NORMAL;
            if (gl.clientState.colorArray.enabled) geometryFlags |= HAS_COLOR;
            if (gl.clientState.textureCoordArray.enabled) geometryFlags |= HAS_TEXCOORD;
            if (mode === GL.POINTS) geometryFlags |= USE_POINT_SIZE;

            var shader = this.getShader(geometryFlags);
            if (!shader.program) {
                if (DEBUG) console.warn("UNIMPLEMENTED glDrawElements shader: " + shader.label);
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glDrawElements shader: " + shader.label);
                return;
            }

            var vertexArray = gl.clientState.vertexArray;
            if (!vertexArray.enabled || !vertexArray.pointer) {
                DEBUG > 0 && console.warn("glDrawElements: GL_VERTEX_ARRAY incomplete, skipping");
                return;
            }

            DEBUG > 1 && console.log("glDrawElements", GL_Symbol(mode, 'POINTS'), count, GL_Symbol(type), shader.label, Array.from(indices));

            webgl.useProgram(shader.program);
            this.setShaderUniforms(shader);
            var loc = shader.locations;

            var vertexBuffer = webgl.createBuffer();
            webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
            webgl.bufferData(webgl.ARRAY_BUFFER, vertexArray.pointer, webgl.DYNAMIC_DRAW);
            webgl.vertexAttribPointer(loc['aPosition'], vertexArray.size, vertexArray.type, false, vertexArray.stride, 0);
            webgl.enableVertexAttribArray(loc['aPosition']);

            var normalBuffer;
            if (loc['aNormal'] >= 0) {
                var normalArray = gl.clientState.normalArray;
                normalBuffer = webgl.createBuffer();
                webgl.bindBuffer(webgl.ARRAY_BUFFER, normalBuffer);
                webgl.bufferData(webgl.ARRAY_BUFFER, normalArray.pointer, webgl.DYNAMIC_DRAW);
                webgl.vertexAttribPointer(loc['aNormal'], normalArray.size, normalArray.type, false, normalArray.stride, 0);
                webgl.enableVertexAttribArray(loc['aNormal']);
            }

            var colorBuffer;
            if (loc['aColor'] >= 0) {
                var colorArray = gl.clientState.colorArray;
                colorBuffer = webgl.createBuffer();
                webgl.bindBuffer(webgl.ARRAY_BUFFER, colorBuffer);
                webgl.bufferData(webgl.ARRAY_BUFFER, colorArray.pointer, webgl.DYNAMIC_DRAW);
                webgl.vertexAttribPointer(loc['aColor'], colorArray.size, colorArray.type, false, colorArray.stride, 0);
                webgl.enableVertexAttribArray(loc['aColor']);
            }

            var texCoordBuffer;
            if (loc['aTexCoord'] >= 0) {
                var texCoordArray = gl.clientState.textureCoordArray;
                texCoordBuffer = webgl.createBuffer();
                webgl.bindBuffer(webgl.ARRAY_BUFFER, texCoordBuffer);
                webgl.bufferData(webgl.ARRAY_BUFFER, texCoordArray.pointer, webgl.DYNAMIC_DRAW);
                webgl.vertexAttribPointer(loc['aTexCoord'], texCoordArray.size, texCoordArray.type, false, texCoordArray.stride, 0);
                webgl.enableVertexAttribArray(loc['aTexCoord']);
            }

            var indexBuffer = webgl.createBuffer();
            webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            webgl.bufferData(webgl.ELEMENT_ARRAY_BUFFER, indices, webgl.DYNAMIC_DRAW);

            webgl.drawElements(mode, indices.length, type, 0);

            webgl.useProgram(null);

            webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, null);
            webgl.bindBuffer(webgl.ARRAY_BUFFER, null);

            webgl.deleteBuffer(indexBuffer);
            webgl.disableVertexAttribArray(loc['aPosition']);
            webgl.deleteBuffer(vertexBuffer);
            if (normalBuffer) {
                webgl.disableVertexAttribArray(loc['aNormal']);
                webgl.deleteBuffer(normalBuffer);
            }
            if (colorBuffer) {
                webgl.disableVertexAttribArray(loc['aColor']);
                webgl.deleteBuffer(colorBuffer);
            }
            if (texCoordBuffer) {
                webgl.disableVertexAttribArray(loc['aTexCoord']);
                webgl.deleteBuffer(texCoordBuffer);
            }
        },

        glEnable: function(cap) {
            if (gl.listMode && this.addToList("glEnable", [cap])) return;
            switch (cap) {
                case GL.ALPHA_TEST:
                    DEBUG > 1 && console.log("glEnable GL_ALPHA_TEST");
                    gl.alphaTest = true;
                    break;
                case webgl.BLEND:
                    DEBUG > 1 && console.log("glEnable GL_BLEND");
                    webgl.enable(webgl.BLEND);
                    break;
                case GL.CLIP_PLANE0:
                case GL.CLIP_PLANE1:
                case GL.CLIP_PLANE2:
                case GL.CLIP_PLANE3:
                case GL.CLIP_PLANE4:
                case GL.CLIP_PLANE5:
                case GL.CLIP_PLANE6:
                case GL.CLIP_PLANE7:
                    DEBUG > 1 && console.log("glEnable GL_CLIP_PLANE" + (cap - GL.CLIP_PLANE0));
                    gl.clipPlanes[cap - GL.CLIP_PLANE0].enabled = true;
                    break;
                case webgl.CULL_FACE:
                    DEBUG > 1 && console.log("glEnable GL_CULL_FACE");
                    webgl.enable(webgl.CULL_FACE);
                    break;
                case webgl.DEPTH_TEST:
                    DEBUG > 1 && console.log("glEnable GL_DEPTH_TEST");
                    webgl.enable(webgl.DEPTH_TEST);
                    break;
                case GL.FOG:
                    DEBUG > 1 && console.log("glEnable GL_FOG");
                    gl.fogEnabled = true;
                    break;
                case GL.NORMALIZE:
                    DEBUG > 1 && console.log("glEnable GL_NORMALIZE");
                    // we always normalize normals
                    break;
                case GL.LIGHT0:
                case GL.LIGHT1:
                case GL.LIGHT2:
                case GL.LIGHT3:
                case GL.LIGHT4:
                case GL.LIGHT5:
                case GL.LIGHT6:
                case GL.LIGHT7:
                    DEBUG > 1 && console.log("glEnable GL_LIGHT" + (cap - GL.LIGHT0));
                    gl.lights[cap - GL.LIGHT0].enabled = true;
                    break;
                case GL.LIGHTING:
                    DEBUG > 1 && console.log("glEnable GL_LIGHTING");
                    gl.lightingEnabled = true;
                    break;
                case webgl.POLYGON_OFFSET_FILL:
                    DEBUG > 1 && console.log("glEnable GL_POLYGON_OFFSET_FILL");
                    webgl.enable(webgl.POLYGON_OFFSET_FILL);
                    break;
                case webgl.STENCIL_TEST:
                    DEBUG > 1 && console.log("glEnable GL_STENCIL_TEST");
                    webgl.enable(webgl.STENCIL_TEST);
                    break;
                case webgl.TEXTURE_2D:
                    DEBUG > 1 && console.log("glEnable GL_TEXTURE_2D");
                    gl.textureEnabled = true;
                    break;
                case GL.TEXTURE_GEN_S:
                case GL.TEXTURE_GEN_T:
                case GL.TEXTURE_GEN_R:
                case GL.TEXTURE_GEN_Q:
                    if (DEBUG) console.log("UNIMPLEMENTED glEnable GL_" + GL_Symbol(cap, "TEXTURE_GEN_S"));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glEnable GL_" + GL_Symbol(cap, "TEXTURE_GEN_S"));
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glEnable", GL_Symbol(cap));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glEnable " + GL_Symbol(cap));
            }
        },

        glEnableClientState: function(cap) {
            if (gl.listMode && this.addToList("glEnableClientState", [cap])) return;
            switch (cap) {
                case GL.VERTEX_ARRAY:
                    DEBUG > 1 && console.log("glEnableClientState GL_VERTEX_ARRAY");
                    gl.clientState.vertexArray.enabled = true;
                    return;
                case GL.NORMAL_ARRAY:
                    DEBUG > 1 && console.log("glEnableClientState GL_NORMAL_ARRAY");
                    gl.clientState.normalArray.enabled = true;
                    return;
                case GL.COLOR_ARRAY:
                    DEBUG > 1 && console.log("glEnableClientState GL_COLOR_ARRAY");
                    gl.clientState.colorArray.enabled = true;
                    return;
                case GL.TEXTURE_COORD_ARRAY:
                    DEBUG > 1 && console.log("glEnableClientState GL_TEXTURE_COORD_ARRAY");
                    gl.clientState.textureCoordArray.enabled = true;
                    return;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glEnableClientState", GL_Symbol(cap));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glEnableClientState " + GL_Symbol(cap));
            }
        },

        glFog: function(pname, param) {
            if (gl.listMode && this.addToList("glFog", [pname, param])) return;
            switch (pname) {
                case GL.FOG_MODE:
                    gl.fogMode = param;
                    DEBUG > 1 && console.log("glFog GL_FOG_MODE", GL_Symbol(param));
                    break;
                case GL.FOG_DENSITY:
                    DEBUG > 1 && console.log("glFog GL_FOG_DENSITY", param);
                    gl.fogDensity = param;
                    break;
                case GL.FOG_START:
                    DEBUG > 1 && console.log("glFog GL_FOG_START", param);
                    gl.fogStart = param;
                    break;
                case GL.FOG_END:
                    DEBUG > 1 && console.log("glFog GL_FOG_END", param);
                    gl.fogEnd = param;
                    break;
                case GL.FOG_COLOR:
                    DEBUG > 1 && console.log("glFog GL_FOG_COLOR", Array.from(param));
                    gl.fogColor.set(param);
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glFog", GL_Symbol(pname), param);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glFog " + GL_Symbol(pname));
            }
        },

        glFogi: function(pname, param) {
            this.glFog(pname, param);
        },

        glFogf: function(pname, param) {
            this.glFog(pname, param);
        },

        glFogiv: function(pname, params) {
            // FOG_COLOR integer values are mapped linearly such that the most positive representable value maps to 1.0,
            // and the most negative representable value maps to -1.0
            this.glFog(pname, pname === GL.FOG_COLOR
                ? params.map(function(x) { return (x + 0.5) / (0x7FFFFFFF + 0.5); })
                : params[0]);
        },

        glFogfv: function(pname, params) {
            this.glFog(pname, pname === GL.FOG_COLOR ? params : params[0]);
        },

        getShader: function(geometryFlags) {
            // geometryFlags: HAS_TEXCOORD, HAS_NORMAL, HAS_COLOR, USE_POINT_SIZE

            var shaderFlags = geometryFlags;
            if (gl.textureEnabled && gl.texture) shaderFlags |= USE_TEXTURE;
            if (gl.alphaTest) shaderFlags |= USE_ALPHA_TEST; // UNIMPLEMENTED
            if (gl.fogEnabled) switch (gl.fogMode) {
                case GL.EXP: shaderFlags |= EXP_FOG << FOG_SHIFT; break;
                case GL.EXP2: shaderFlags |= EXP2_FOG << FOG_SHIFT; break;
                case GL.LINEAR: shaderFlags |= LINEAR_FOG << FOG_SHIFT; break;
            }
            var numLights = 0;
            if (gl.lightingEnabled) {
                for (var i = 0; i < MAX_LIGHTS; i++) {
                    if (gl.lights[i].enabled) numLights++;
                }
                shaderFlags |= numLights << NUM_LIGHTS_SHIFT;
            }
            var numClipPlanes = 0;
            for (var i = 0; i < MAX_CLIP_PLANES; i++) {
                if (gl.clipPlanes[i].enabled) {
                    numClipPlanes++;
                }
            }
            shaderFlags |= numClipPlanes << NUM_CLIP_PLANES_SHIFT;

            // create shader program
            var shader = gl.shaders[shaderFlags];
            if (!shader) {
                var flagString = "[POSITION";
                if (shaderFlags & HAS_NORMAL) flagString += ", NORMAL";
                if (shaderFlags & HAS_COLOR) flagString += ", COLOR";
                if (shaderFlags & HAS_TEXCOORD) flagString += ", TEXCOORD";
                flagString += "]";
                if (shaderFlags & USE_TEXTURE) flagString += ", TEXTURE";
                if (shaderFlags & ANY_LIGHTS) { flagString += ", "+ numLights +" LIGHT"; if (numLights !== 1) flagString += "S"; }
                if (shaderFlags & ANY_CLIP_PLANES) { flagString += ", "+ numClipPlanes +" CLIP_PLANE"; if (numClipPlanes !== 1) flagString += "S"; }
                if (shaderFlags & USE_ALPHA_TEST) flagString += ", ALPHA_TEST";
                if (shaderFlags & USE_POINT_SIZE) flagString += ", POINT_SIZE";
                if (shaderFlags & ANY_FOG) flagString += ", FOG";

                shader = gl.shaders[shaderFlags] = {
                    flags: shaderFlags,
                    label: flagString,
                    program: null,
                    locations: null,
                    vsource: null, // for debugging
                    fsource: null, // for debugging
                };
                var implemented = HAS_TEXCOORD | HAS_NORMAL | HAS_COLOR | USE_TEXTURE | NUM_LIGHTS_MASK | NUM_CLIP_PLANES_MASK | USE_POINT_SIZE | FOG_MASK;
                if (shaderFlags & ~implemented) return shader;

                var program = webgl.createProgram()
                var vs = webgl.createShader(webgl.VERTEX_SHADER);
                shader.vsource = this.vertexShaderSource(shaderFlags);
                webgl.shaderSource(vs, shader.vsource);
                webgl.compileShader(vs);
                if (!webgl.getShaderParameter(vs, webgl.COMPILE_STATUS)) {
                    console.error("OpenGL: vertex shader compile error: " + webgl.getShaderInfoLog(vs));
                    debugger;
                    return shader;
                }
                var fs = webgl.createShader(webgl.FRAGMENT_SHADER);
                shader.fsource = this.fragmentShaderSource(shaderFlags);
                webgl.shaderSource(fs, shader.fsource);
                webgl.compileShader(fs);
                if (!webgl.getShaderParameter(fs, webgl.COMPILE_STATUS)) {
                    console.error("OpenGL: fragment shader compile error: " + webgl.getShaderInfoLog(fs));
                    debugger;
                    return shader;
                }
                webgl.attachShader(program, vs);
                webgl.attachShader(program, fs);
                webgl.linkProgram(program);
                if (!webgl.getProgramParameter(program, webgl.LINK_STATUS)) {
                    console.error("OpenGL: shader link error: " + webgl.getProgramInfoLog(program));
                    debugger
                    return shader;
                }
                shader.program = program;
                shader.locations = this.getLocations(program, shaderFlags);
            }
            return shader;
        },

        setShaderUniforms: function(shader) {
            var loc = shader.locations;
            DEBUG > 2 && console.log("uModelView", Array.from(gl.matrices[GL.MODELVIEW][0]));
            webgl.uniformMatrix4fv(loc['uModelView'], false, gl.matrices[GL.MODELVIEW][0]);
            DEBUG > 2 && console.log("uProjection", Array.from(gl.matrices[GL.PROJECTION][0]));
            webgl.uniformMatrix4fv(loc['uProjection'], false, gl.matrices[GL.PROJECTION][0]);
            if (loc['uNormalMatrix']) {
                var normalMatrix = asNormalMatrix(gl.matrices[GL.MODELVIEW][0]);
                DEBUG > 2 && console.log("uNormalMatrix", Array.from(normalMatrix));
                webgl.uniformMatrix3fv(loc['uNormalMatrix'], false, normalMatrix);
            }
            if (loc['uNormal']) {
                DEBUG > 2 && console.log("uNormal", Array.from(gl.normal));
                webgl.uniform3fv(loc['uNormal'], gl.normal);
            }
            if (loc['uColor']) {
                var color = gl.color;
                if (gl.textureEnvMode === GL.REPLACE) color = [1, 1, 1, 1]; // HACK
                DEBUG > 2 && console.log("uColor", Array.from(color));
                webgl.uniform4fv(loc['uColor'], color);
            }
            if (loc['uTexCoord']) {
                DEBUG > 2 && console.log("uTexCoord", Array.from(gl.texCoord));
                webgl.uniform2fv(loc['uTexCoord'], gl.texCoord);
            }
            if (loc['uSampler']) {
                DEBUG > 2 && console.log("uSampler", gl.texture);
                webgl.activeTexture(webgl.TEXTURE0);
                webgl.bindTexture(webgl.TEXTURE_2D, gl.texture);
                webgl.uniform1i(loc['uSampler'], 0);
            }
            if (loc['uPointSize']) {
                DEBUG > 2 && console.log("uPointSize", gl.pointSize);
                webgl.uniform1f(loc['uPointSize'], gl.pointSize);
            }
            var numLights = (shader.flags & NUM_LIGHTS_MASK) >> NUM_LIGHTS_SHIFT;
            if (numLights > 0) {
                DEBUG > 2 && console.log("uLightModelAmbient", Array.from(gl.lightModelAmbient));
                webgl.uniform4fv(loc['uLightModelAmbient'], gl.lightModelAmbient);
                DEBUG > 2 && console.log("uMaterialAmbient", Array.from(gl.material.ambient));
                webgl.uniform4fv(loc['uMaterialAmbient'], gl.material.ambient);
                DEBUG > 2 && console.log("uMaterialDiffuse", Array.from(gl.material.diffuse));
                webgl.uniform4fv(loc['uMaterialDiffuse'], gl.material.diffuse);
                DEBUG > 2 && console.log("uMaterialSpecular", Array.from(gl.material.specular));
                webgl.uniform4fv(loc['uMaterialSpecular'], gl.material.specular);
                DEBUG > 2 && console.log("uMaterialEmission", Array.from(gl.material.emission));
                webgl.uniform4fv(loc['uMaterialEmission'], gl.material.emission);
                DEBUG > 2 && console.log("uMaterialShininess", gl.material.shininess);
                webgl.uniform1f(loc['uMaterialShininess'], gl.material.shininess);
                var index = 0;
                for (var i = 0; i < MAX_LIGHTS; i++) {
                    var light = gl.lights[i];
                    if (!light.enabled) continue;
                    DEBUG > 2 && console.log("uLights[" + index + "].ambient", Array.from(light.ambient));
                    webgl.uniform4fv(loc['uLights'][index].ambient, light.ambient);
                    DEBUG > 2 && console.log("uLights[" + index + "].diffuse", Array.from(light.diffuse));
                    webgl.uniform4fv(loc['uLights'][index].diffuse, light.diffuse);
                    DEBUG > 2 && console.log("uLights[" + index + "].specular", Array.from(light.specular));
                    webgl.uniform4fv(loc['uLights'][index].specular, light.specular);
                    DEBUG > 2 && console.log("uLights[" + index + "].position", Array.from(light.position));
                    webgl.uniform4fv(loc['uLights'][index].position, light.position);
                    index++;
                }
            }
            var numClipPlanes = (shader.flags & NUM_CLIP_PLANES_MASK) >> NUM_CLIP_PLANES_SHIFT;
            if (numClipPlanes > 0) {
                var index = 0;
                for (var i = 0; i < MAX_CLIP_PLANES; i++) {
                    var clipPlane = gl.clipPlanes[i];
                    if (!clipPlane.enabled) continue;
                    DEBUG > 2 && console.log("uClipPlanes[" + index + "]", Array.from(clipPlane.equation));
                    webgl.uniform4fv(loc['uClipPlanes'][index], clipPlane.equation);
                    index++;
                }
            }
            if (loc['uFogColor']) {
                DEBUG > 2 && console.log("uFogColor", Array.from(gl.fogColor));
                webgl.uniform4fv(loc['uFogColor'], gl.fogColor);
            }
            if (loc['uFogEnd']) {
                DEBUG > 2 && console.log("uFogEnd", gl.fogEnd);
                webgl.uniform1f(loc['uFogEnd'], gl.fogEnd);
            }
            if (loc['uFogRange']) {
                DEBUG > 2 && console.log("uFogRange", gl.fogEnd - gl.fogStart);
                webgl.uniform1f(loc['uFogRange'], gl.fogEnd - gl.fogStart);
            }
            if (loc['uFogDensity']) {
                DEBUG > 2 && console.log("uFogDensity", gl.fogDensity);
                webgl.uniform1f(loc['uFogDensity'], gl.fogDensity);
            }
        },

        glEnd: function() {
            if (gl.listMode && this.addToList("glEnd", [])) return;
            var primitive = gl.primitive;
            gl.primitive = null;

            // select shader
            var geometryFlags = primitive.vertexAttrs;
            if (primitive.mode === GL.POINTS) geometryFlags |= USE_POINT_SIZE;

            var shader = this.getShader(geometryFlags);
            if (!shader.program) {
                if (DEBUG) console.warn("UNIMPLEMENTED glEnd shader: " + shader.label);
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glEnd shader: " + shader.label);
                return;
            }

            // create interleaved vertex buffer
            var vertices = primitive.vertices;
            var size = primitive.vertexSize;
            var data = new Float32Array(vertices.length * size);
            for (var i = 0, offset = 0; i < vertices.length; i++, offset += size) {
                data.set(vertices[i], offset);
            }
            var vertexBuffer = webgl.createBuffer();
            webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
            webgl.bufferData(webgl.ARRAY_BUFFER, data, webgl.DYNAMIC_DRAW);

            // set mode depending on primitive mode
            // and create index buffer if needed
            var mode;
            var indices;

            switch (primitive.mode) {
                // supported by WebGL, no index buffer needed
                case webgl.POINTS:
                case webgl.LINES:
                case webgl.LINE_LOOP:
                case webgl.LINE_STRIP:
                case webgl.TRIANGLES:
                case webgl.TRIANGLE_STRIP:
                case webgl.TRIANGLE_FAN:
                    DEBUG > 1 && console.log("glEnd " + GL_Symbol(primitive.mode, "POINTS") + ":" + shader.label);
                    mode = primitive.mode;
                    break;
                // not supported by WebGL, emulate
                case GL.QUADS:
                    // use triangles and an index buffer to
                    // duplicate vertices as v0-v1-v2, v2-v1-v3
                    // we assume that all attributes are floats
                    DEBUG > 1 && console.log("glEnd GL_QUADS:" + shader.label);
                    indices = vertices.length > 256
                        ? new Uint16Array(vertices.length * 3 / 2)
                        : new Uint8Array(vertices.length * 3 / 2);
                    var offset = 0;
                    for (var i = 0; i < vertices.length; i += 4) {
                        indices[offset++] = i;
                        indices[offset++] = i+1;
                        indices[offset++] = i+2;
                        indices[offset++] = i;
                        indices[offset++] = i+2;
                        indices[offset++] = i+3;
                    }
                    mode = webgl.TRIANGLES;
                    break;
                case GL.QUAD_STRIP:
                    if (DEBUG) console.log("UNIMPLEMENTED glEnd GL_QUAD_STRIP:" + shader.label);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glEnd GL_QUAD_STRIP");
                    return;
                case GL.POLYGON:
                    // use triangle fan, which works for convex polygons
                    DEBUG > 1 && console.log("glEnd GL_POLYGON:" + shader.label);
                    mode = webgl.TRIANGLE_FAN;
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glEnd", primitive.mode);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glEnd " + primitive.mode);
                    return;
            }
            var indexBuffer;
            if (indices) {
                indexBuffer = webgl.createBuffer();
                webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                webgl.bufferData(webgl.ELEMENT_ARRAY_BUFFER, indices, webgl.DYNAMIC_DRAW);
            }

            // set up uniforms and vertex attributes
            var stride = size * 4;
            var offset = 0;

            webgl.useProgram(shader.program);
            this.setShaderUniforms(shader);
            var loc = shader.locations;
            DEBUG > 2 && console.log("aPosition: @" + offset + "/" + stride);
            webgl.vertexAttribPointer(loc['aPosition'], 3, webgl.FLOAT, false, stride, offset);
            webgl.enableVertexAttribArray(loc['aPosition']);
            offset += 12;
            if (loc['aNormal'] >= 0) {
                DEBUG > 2 && console.log("aNormal: @" + offset + "/" + stride);
                webgl.vertexAttribPointer(loc['aNormal'], 3, webgl.FLOAT, false, stride, offset);
                webgl.enableVertexAttribArray(loc['aNormal']);
            }
            if (geometryFlags & HAS_NORMAL) offset += 12;
            if (loc['aColor'] >= 0) {
                DEBUG > 2 && console.log("aColor: @" + offset + "/" + stride);
                webgl.vertexAttribPointer(loc['aColor'], 4, webgl.FLOAT, false, stride, offset);
                webgl.enableVertexAttribArray(loc['aColor']);
            }
            if (geometryFlags & HAS_COLOR) offset += 16;
            if (loc['aTexCoord'] >= 0) {
                DEBUG > 2 && console.log("aTexCoord: @" + offset + "/" + stride);
                webgl.vertexAttribPointer(loc['aTexCoord'], 2, webgl.FLOAT, false, stride, offset);
                webgl.enableVertexAttribArray(loc['aTexCoord']);
            }
            if (geometryFlags & HAS_TEXCOORD) offset += 8;

            // draw
            if (indexBuffer) {
                DEBUG > 1 && console.log("glEnd: draw indexed vertices", GL_Symbol(mode, 'POINTS'), Array.from(indices), vertices.map(function(v) { return ""+v; }));
                webgl.drawElements(mode, indices.length, vertices.length > 256 ? webgl.UNSIGNED_SHORT : webgl.UNSIGNED_BYTE, 0);
            } else {
                DEBUG > 1 && console.log("glEnd: draw vertices", GL_Symbol(mode, 'POINTS'), 0, vertices.map(function(v) { return ""+v; }));
                webgl.drawArrays(mode, 0, vertices.length);
            }
            webgl.useProgram(null);
            webgl.disableVertexAttribArray(loc['aPosition']);
            if (loc['aNormal'] >= 0) webgl.disableVertexAttribArray(loc['aNormal']);
            if (loc['aColor'] >= 0) webgl.disableVertexAttribArray(loc['aColor']);
            if (loc['aTexCoord'] >= 0) webgl.disableVertexAttribArray(loc['aTexCoord']);
            webgl.bindBuffer(webgl.ARRAY_BUFFER, null);
            webgl.deleteBuffer(vertexBuffer);
            if (indexBuffer) {
                webgl.deleteBuffer(indexBuffer);
                webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, null);
            }
        },

        glEndList: function() {
            DEBUG > 1 && console.log("glEndList");
            var list = gl.list;
            gl.list = null;
            gl.lists[list.id] = list;
            gl.listMode = 0;
        },

        glFinish: function() {
            DEBUG > 1 && console.log("glFinish");
            webgl.finish();
        },

        glFlush: function() {
            DEBUG > 1 && console.log("glFlush");
            webgl.flush();
        },

        glFrontFace: function(mode) {
            if (gl.listMode && this.addToList("glFrontFace", [mode])) return;
            DEBUG > 1 && console.log("glFrontFace", GL_Symbol(mode));
            webgl.frontFace(mode);
        },

        glFrustum: function(left, right, bottom, top, zNear, zFar) {
            if (gl.listMode && this.addToList("glFrustum", [left, right, bottom, top, zNear, zFar])) return;
            DEBUG > 1 && console.log("glFrustum", left, right, bottom, top, zNear, zFar);
            var m = gl.matrix;
            m[0] = 2 * zNear / (right - left);
            m[1] = 0;
            m[2] = 0;
            m[3] = 0;

            m[4] = 0;
            m[5] = 2 * zNear / (top - bottom);
            m[6] = 0;
            m[7] = 0;

            m[8] = (right + left) / (right - left);
            m[9] = (top + bottom) / (top - bottom);
            m[10] = -(zFar + zNear) / (zFar - zNear);
            m[11] = -1;

            m[12] = 0;
            m[13] = 0;
            m[14] = -(2 * zFar * zNear) / (zFar - zNear);
            m[15] = 0;
        },

        glGenLists: function(range) {
            DEBUG > 1 && console.log("glGenLists", range);
            var firstId = 0;
            if (range > 0) {
                firstId = gl.listIdGen + 1;
                gl.listIdGen += range;
            }
            return firstId;
        },

        glGenTextures: function(n, textures) {
            for (var i = 0; i < n; i++) {
                var id = ++gl.textureIdGen;
                gl.textures[id] = webgl.createTexture();
                textures[i] = id;
            }
            DEBUG > 1 && console.log("glGenTextures", n, Array.from(textures));
        },

        glGetFloatv: function(pname, params) {
            switch (pname) {
                case GL.MODELVIEW_MATRIX:
                    DEBUG > 1 && console.log("glGetFloatv GL_MODELVIEW_MATRIX");
                    params.set(gl.matrices[GL.MODELVIEW][0]);
                    break;
                case GL.PROJECTION_MATRIX:
                    DEBUG > 1 && console.log("glGetFloatv GL_PROJECTION_MATRIX");
                    params.set(gl.matrices[GL.PROJECTION][0]);
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glGetFloatv", GL_Symbol(pname));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glGetFloatv " + GL_Symbol(pname));
            }
        },

        glGetIntegerv(name, params) {
            switch (name) {
                case GL.LIST_INDEX:
                    DEBUG > 1 && console.log("glGetIntegerv GL_LIST_INDEX");
                    params[0] = gl.list ? gl.list.id : 0;
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glGetIntegerv", GL_Symbol(name));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glGetIntegerv " + GL_Symbol(name));
            }
        },

        glGetString: function(name) {
            switch (name) {
                case GL.EXTENSIONS:
                    DEBUG > 1 && console.log("glGetString GL_EXTENSIONS");
                    return gl.extensions;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glGetString", name);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glGetString " + name);
            }
            return "";
        },

        glGetTexLevelParameteriv: function(target, level, pname, params) {
            switch (pname) {
                case GL.TEXTURE_COMPRESSED:
                    return false;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glGetTexLevelParameteriv", GL_Symbol(target), level, GL_Symbol(pname), params);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glGetTexLevelParameteriv " + GL_Symbol(target) + " " + GL_Symbol(pname));
            }
        },

        glHint: function(target, mode) {
            if (gl.listMode && this.addToList("glHint", [target, mode])) return;
            switch (target) {
            case webgl.GENERATE_MIPMAP_HINT:
                DEBUG > 1 && console.log("glHint GL_GENERATE_MIPMAP_HINT", GL_Symbol(mode));
                webgl.hint(target, mode);
                break;
            }
            // webgl doesn't support any other hints
            DEBUG > 1 && console.log("IGNORING glHint", GL_Symbol(target), GL_Symbol(mode));
        },

        glIsEnabled: function(cap) {
            switch (cap) {
                case GL.LIGHTING:
                    DEBUG > 1 && console.log("glIsEnabled GL_LIGHTING");
                    return gl.lightingEnabled;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glIsEnabled", cap);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glIsEnabled " + cap);
            }
            return false;
        },

        glIsTexture: function(texture) {
            DEBUG > 1 && console.log("glIsTexture", texture);
            return !!gl.textures[texture];
        },

        glLightf: function(light, pname, param) {
            if (gl.listMode && this.addToList("glLightf", [light, pname, param])) return;
            var i = light - GL.LIGHT0;
            switch (pname) {
                case GL.SPOT_CUTOFF:
                    if (param === 180) {
                        DEBUG > 1 && console.log("glLightf", i, "GL_SPOT_CUTOFF", param);
                        return;
                    }
                    // fall through if not default
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glLightf", i, GL_Symbol(pname), param);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glLightf " + GL_Symbol(pname));
            }
        },

        glLightfv: function(light, pname, param) {
            if (gl.listMode && this.addToList("glLightfv", [light, pname, param])) return;
            var i = light - GL.LIGHT0;
            switch (pname) {
                case GL.AMBIENT:
                    DEBUG > 1 && console.log("glLightfv", i, "GL_AMBIENT", Array.from(param));
                    gl.lights[i].ambient = param;
                    break;
                case GL.DIFFUSE:
                    DEBUG > 1 && console.log("glLightfv", i, "GL_DIFFUSE", Array.from(param));
                    gl.lights[i].diffuse = param;
                    break;
                case GL.SPECULAR:
                    DEBUG > 1 && console.log("glLightfv", i, "GL_SPECULAR", Array.from(param));
                    gl.lights[i].specular = param;
                    break;
                case GL.POSITION:
                    if (param[3] === 0) {
                        transformDirection(gl.matrices[GL.MODELVIEW][0], param, gl.lights[i].position);
                    } else {
                        transformPoint(gl.matrices[GL.MODELVIEW][0], param, gl.lights[i].position);
                    }
                    DEBUG > 1 && console.log("glLightfv", i, "GL_POSITION", Array.from(param), "=>", Array.from(gl.lights[i].position));
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glLightfv", i, GL_Symbol(pname), Array.from(param));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glLightfv " + GL_Symbol(pname));
            }
        },

        glLightModelfv: function(pname, params) {
            if (gl.listMode && this.addToList("glLightModelfv", [pname, params])) return;
            switch (pname) {
                case GL.LIGHT_MODEL_AMBIENT:
                    DEBUG > 1 && console.log("glLightModelfv GL_LIGHT_MODEL_AMBIENT", Array.from(params));
                    gl.lightModelAmbient = params;
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glLightModelfv", GL_Symbol(pname), Array.from(params));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glLightModelfv " + GL_Symbol(pname));
            }
        },

        glLineWidth: function(width) {
            if (gl.listMode && this.addToList("glLineWidth", [width])) return;
            DEBUG > 1 && console.log("glLineWidth", width);
            webgl.lineWidth(width);
        },

        glListBase: function(base) {
            DEBUG > 1 && console.log("glListBase", base);
            gl.listBase = base;
        },

        glLoadIdentity: function() {
            if (gl.listMode && this.addToList("glLoadIdentity", [])) return;
            DEBUG > 1 && console.log("glLoadIdentity");
            gl.matrix.set(identity);
        },

        glLoadMatrixf: function(m) {
            if (gl.listMode && this.addToList("glLoadMatrixf", [m])) return;
            gl.matrix.set(m);
            DEBUG > 1 && console.log("glLoadMatrixf", GL_Symbol(gl.matrixMode), Array.from(m));
        },

        glMaterialf: function(face, pname, param) {
            if (gl.listMode && this.addToList("glMaterialf", [face, pname, param])) return;
            switch (pname) {
                case GL.SHININESS:
                    DEBUG > 1 && console.log("glMaterialf GL_SHININESS", param);
                    gl.material.shininess = param;
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glMaterialf", GL_Symbol(pname), param);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glMaterialf " + GL_Symbol(pname));
            }
        },

        glMaterialfv: function(face, pname, param) {
            if (gl.listMode && this.addToList("glMaterialfv", [face, pname, param])) return;
            switch (pname) {
                case GL.AMBIENT:
                    DEBUG > 1 && console.log("glMaterialfv GL_AMBIENT", Array.from(param));
                    gl.material.ambient = param;
                    break;
                case GL.DIFFUSE:
                    DEBUG > 1 && console.log("glMaterialfv GL_DIFFUSE", Array.from(param));
                    gl.material.diffuse = param;
                    break;
                case GL.SPECULAR:
                    DEBUG > 1 && console.log("glMaterialfv GL_SPECULAR", Array.from(param));
                    gl.material.specular = param;
                    break;
                case GL.EMISSION:
                    DEBUG > 1 && console.log("glMaterialfv GL_EMISSION", Array.from(param));
                    gl.material.emission = param;
                    break;
                case GL.SHININESS:
                    DEBUG > 1 && console.log("glMaterialfv GL_SHININESS", Array.from(param));
                    gl.material.shininess = param[0];
                    break;
                case GL.AMBIENT_AND_DIFFUSE:
                    DEBUG > 1 && console.log("glMaterialfv GL_AMBIENT_AND_DIFFUSE", Array.from(param));
                    gl.material.ambient = param;
                    gl.material.diffuse = param;
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glMaterialfv", GL_Symbol(pname), Array.from(param));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glMaterialfv " + GL_Symbol(pname));
            }
        },

        glMatrixMode: function(mode) {
            if (gl.listMode && this.addToList("glMatrixMode", [mode])) return;
            if (mode !== GL.MODELVIEW && mode !== GL.PROJECTION) {
                if (DEBUG) console.warn("UNIMPLEMENTED glMatrixMode", GL_Symbol(mode));
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glMatrixMode " + GL_Symbol(mode));
            } else DEBUG > 1 && console.log("glMatrixMode", GL_Symbol(mode));
            gl.matrixMode = mode;
            if (!gl.matrices[mode]) gl.matrices[mode] = [new Float32Array(identity)];
            gl.matrix = gl.matrices[mode][0];
        },

        glMultMatrixf: function(m) {
            if (gl.listMode && this.addToList("glMultMatrixf", [m])) return;
            multMatrix(gl.matrix, m);
            DEBUG > 1 && console.log("glMultMatrixf", GL_Symbol(gl.matrixMode), Array.from(m), "=>", Array.from(gl.matrix));
        },

        glNewList: function(list, mode) {
            DEBUG > 1 && console.log("glNewList", list, GL_Symbol(mode));
            var newList = {
                id: list,
                commands: [],
            };
            gl.list = newList;
            gl.listMode = mode;
        },

        glNormal3f: function(nx, ny, nz) {
            if (gl.listMode && this.addToList("glNormal3f", [nx, ny, nz])) return;
            DEBUG > 1 && console.log("glNormal3f", nx, ny, nz);
            gl.normal[0] = nx;
            gl.normal[1] = ny;
            gl.normal[2] = nz;
            gl.primitiveAttrs |= HAS_NORMAL;
        },

        glNormal3fv: function(v) {
            if (gl.listMode && this.addToList("glNormal3fv", [v.slice()])) return;
            DEBUG > 1 && console.log("glNormal3fv", Array.from(v));
            gl.normal.set(v);
            gl.primitiveAttrs |= HAS_NORMAL;
        },

        glNormalPointer: function(type, stride, pointer) {
            if (gl.listMode && this.addToList("glNormalPointer", [type, stride, pointer])) return;
            DEBUG > 1 && console.log("glNormalPointer", GL_Symbol(type), stride, pointer);
            gl.clientState.normalArray.size = 3;
            gl.clientState.normalArray.type = type;
            gl.clientState.normalArray.stride = stride;
            gl.clientState.normalArray.pointer = pointer;
        },

        glPixelStorei: function(pname, param) {
            switch (pname) {
                case webgl.UNPACK_ALIGNMENT:
                    DEBUG > 1 && console.log("glPixelStorei GL_UNPACK_ALIGNMENT", param);
                    //@webgl.pixelStorei(webgl.UNPACK_ALIGNMENT, param);
                    break;
                case GL.UNPACK_LSB_FIRST:
                    if (param !== 0) console.log("UNIMPLEMENTED glPixelStorei GL_UNPACK_LSB_FIRST", param);
                    break;
                case GL.UNPACK_ROW_LENGTH:
                    DEBUG > 1 && console.log("glPixelStorei GL_UNPACK_ROW_LENGTH", param);
                    gl.pixelStoreUnpackRowLength = param;
                    break;
                case GL.UNPACK_SKIP_ROWS:
                    DEBUG > 1 && console.log("glPixelStorei GL_UNPACK_SKIP_ROWS", param);
                    gl.pixelStoreUnpackSkipRows = param;
                    break;
                case GL.UNPACK_SKIP_PIXELS:
                    DEBUG > 1 && console.log("glPixelStorei GL_UNPACK_SKIP_PIXELS", param);
                    gl.pixelStoreUnpackSkipPixels = param;
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glPixelStorei", pname, param);
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glPixelStorei " + pname);
            }
        },

        glPolygonOffset: function(factor, units) {
            if (gl.listMode && this.addToList("glPolygonOffset", [factor, units])) return;
            DEBUG > 1 && console.log("glPolygonOffset", factor, units);
            webgl.polygonOffset(factor, units);
        },

        glPushAttrib: function(mask) {
            if (gl.listMode && this.addToList("glPushAttrib", [mask])) return;
            if (DEBUG > 0) {
                var maskString = '';
                if (mask === GL.ALL_ATTRIB_BITS) {
                    maskString = 'GL_ALL_ATTRIB_BITS';
                } else {
                    if (mask & GL.CURRENT_BIT) { maskString += 'GL_CURRENT_BIT '; mask &= ~GL.CURRENT_BIT; }
                    if (mask & GL.ENABLE_BIT) { maskString += 'GL_ENABLE_BIT '; mask &= ~GL.ENABLE_BIT; }
                    if (mask & GL.LIGHTING_BIT) { maskString += 'GL_LIGHTING_BIT '; mask &= ~GL.LIGHTING_BIT; }
                    if (mask & GL.COLOR_BUFFER_BIT) { maskString += 'GL_COLOR_BUFFER_BIT '; mask &= ~GL.COLOR_BUFFER_BIT; }
                    if (mask & GL.DEPTH_BUFFER_BIT) { maskString += 'GL_DEPTH_BUFFER_BIT '; mask &= ~GL.DEPTH_BUFFER_BIT; }
                    if (mask & GL.POLYGON_BIT) { maskString += 'GL_POLYGON_BIT '; mask &= ~GL.POLYGON_BIT; }
                    if (mask & GL.TEXTURE_BIT) { maskString += 'GL_TEXTURE_BIT '; mask &= ~GL.TEXTURE_BIT; }
                    if (mask) for (var i = 0; i < 32; i++) {
                        if (mask & (1 << i)) maskString += " " + (1 << i);
                    }
                }
                console.log("UNIMPLEMENTED glPushAttrib", maskString);
            } else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glPushAttrib");
        },

        glPushMatrix: function() {
            if (gl.listMode && this.addToList("glPushMatrix", [])) return;
            gl.matrix = new Float32Array(gl.matrix);
            gl.matrices[gl.matrixMode].unshift(gl.matrix);
            DEBUG > 1 && console.log("glPushMatrix", GL_Symbol(gl.matrixMode), "=>", Array.from(gl.matrix));
        },

        glPointSize: function(size) {
            if (gl.listMode && this.addToList("glPointSize", [size])) return;
            DEBUG > 1 && console.log("glPointSize", size);
            gl.pointSize = size;
        },

        glPopAttrib: function() {
            if (gl.listMode && this.addToList("glPopAttrib", [])) return;
            if (DEBUG) console.log("UNIMPLEMENTED glPopAttrib");
            else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glPopAttrib");
        },

        glPopMatrix: function() {
            if (gl.listMode && this.addToList("glPopMatrix", [])) return;
            if (gl.matrices[gl.matrixMode].length <= 1)
                return DEBUG > 0 && console.warn("OpenGL: matrix stack underflow");
            gl.matrices[gl.matrixMode].shift();
            gl.matrix = gl.matrices[gl.matrixMode][0];
            DEBUG > 1 && console.log("glPopMatrix", GL_Symbol(gl.matrixMode), "=>", Array.from(gl.matrix));
        },

        glRasterPos3f: function(x, y, z) {
            if (gl.listMode && this.addToList("glRasterPos3f", [x, y, z])) return;
            DEBUG > 1 && console.log("glRasterPos3f", x, y, z);
            gl.rasterPos[0] = x;
            gl.rasterPos[1] = y;
            gl.rasterPos[2] = z;
            gl.rasterPos[3] = 1;
            // transform point via modelview and projection matrices
            var m = gl.matrices[GL.PROJECTION][0];
            transformPoint(m, gl.rasterPos, gl.rasterPos);
            m = gl.matrices[GL.MODELVIEW][0];
            transformPoint(m, gl.rasterPos, gl.rasterPos);
            // transform to window coordinates
            gl.rasterPos[0] = (gl.rasterPos[0] * 0.5 + 0.5) * gl.viewport[2] + gl.viewport[0];
            gl.rasterPos[1] = (gl.rasterPos[1] * 0.5 + 0.5) * gl.viewport[3] + gl.viewport[1];
            gl.rasterPos[2] = (gl.rasterPos[2] * 0.5 + 0.5) * (gl.depthRange[1] - gl.depthRange[0]) + gl.depthRange[0];
            // remember raster color
            gl.rasterColor.set(gl.color);
        },

        glReadPixels: function(x, y, width, height, format, type, pixels) {
            if (gl.listMode && this.addToList("glReadPixels", [x, y, width, height, format, type, pixels])) return;
            var swizzle = false;
            switch (format) {
                case webgl.RGBA:
                    break;
                case GL.BGRA:
                    format = webgl.RGBA;
                    swizzle = true;
                    break;
                default:
                    if (DEBUG) console.warn("UNIMPLEMENTED glReadPixels format " + GL_Symbol(format));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glReadPixels format " + GL_Symbol(format));
                    return;
            }
            switch (type) {
                case webgl.UNSIGNED_BYTE:
                    pixels = new Uint8Array(pixels);
                    break;
                default:
                    if (DEBUG) console.warn("UNIMPLEMENTED glReadPixels type " + GL_Symbol(type));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glReadPixels type " + GL_Symbol(type));
                    return;
            }
            DEBUG > 1 && console.log("glReadPixels", x, y, width, height, GL_Symbol(format), GL_Symbol(type), pixels);
            webgl.readPixels(x, y, width, height, format, type, pixels);
            if (swizzle) {
                for (var i = 0; i < pixels.length; i += 4) {
                    var r = pixels[i];
                    var b = pixels[i+2];
                    pixels[i] = b;
                    pixels[i+2] = r;
                }
            }
        },

        glTranslated: function(x, y, z) {
            if (gl.listMode && this.addToList("glTranslated", [x, y, z])) return;
            translateMatrix(gl.matrix, x, y, z);
            DEBUG > 1 && console.log("glTranslated", GL_Symbol(gl.matrixMode), x, y, z, "=>", Array.from(gl.matrix));
        },

        glTranslatef: function(x, y, z) {
            if (gl.listMode && this.addToList("glTranslatef", [x, y, z])) return;
            translateMatrix(gl.matrix, x, y, z);
            DEBUG > 1 && console.log("glTranslatef", GL_Symbol(gl.matrixMode), x, y, z, "=>", Array.from(gl.matrix));
        },

        glRotatef: function(angle, x, y, z) {
            if (gl.listMode && this.addToList("glRotatef", [angle, x, y, z])) return;
            rotateMatrix(gl.matrix, angle, x, y, z);
            DEBUG > 1 && console.log("glRotatef", GL_Symbol(gl.matrixMode), angle, x, y, z, "=>", Array.from(gl.matrix));
        },

        glScalef: function(x, y, z) {
            if (gl.listMode && this.addToList("glScalef", [x, y, z])) return;
            scaleMatrix(gl.matrix, x, y, z);
            DEBUG > 1 && console.log("glScalef", GL_Symbol(gl.matrixMode), x, y, z, "=>", Array.from(gl.matrix));
        },

        glScaled: function(x, y, z) {
            if (gl.listMode && this.addToList("glScaled", [x, y, z])) return;
            scaleMatrix(gl.matrix, x, y, z);
            DEBUG > 1 && console.log("glScaled", GL_Symbol(gl.matrixMode), x, y, z, "=>", Array.from(gl.matrix));
        },

        glShadeModel: function(mode) {
            if (gl.listMode && this.addToList("glShadeModel", [mode])) return;
            if (DEBUG) console.log("UNIMPLEMENTED glShadeModel", GL_Symbol(mode));
            else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glShadeModel " + GL_Symbol(mode));
        },

        glStencilFunc: function(func, ref, mask) {
            if (gl.listMode && this.addToList("glStencilFunc", [func, ref, mask])) return;
            DEBUG > 1 && console.log("glStencilFunc", GL_Symbol(func), ref, '0x'+(mask>>>0).toString(16));
            webgl.stencilFunc(func, ref, mask);
        },

        glStencilOp: function(fail, zfail, zpass) {
            if (gl.listMode && this.addToList("glStencilOp", [fail, zfail, zpass])) return;
            DEBUG > 1 && console.log("glStencilOp", GL_Symbol(fail), GL_Symbol(zfail), GL_Symbol(zpass));
            webgl.stencilOp(fail, zfail, zpass);
        },

        glTexEnv: function(target, pname, param) {
            if (gl.listMode && this.addToList("glTexEnv", [target, pname, param])) return;
            switch (pname) {
                case GL.TEXTURE_ENV_MODE:
                    switch (param) {
                        case GL.MODULATE:
                            // Modulate means multiply the texture color with the fragment color
                            // which is what our fragment shader does by default
                            DEBUG > 1 && console.log("glTexEnv", GL_Symbol(target), "GL_TEXTURE_ENV_MODE", GL_Symbol(param));
                            gl.textureEnvMode = param;
                            return;
                        case GL.REPLACE:
                            // Replace means use the texture color as the fragment color
                            // which we emulate by forcing the uniform color to white
                            DEBUG > 1 && console.log("glTexEnv", GL_Symbol(target), "GL_TEXTURE_ENV_MODE", GL_Symbol(param));
                            gl.textureEnvMode = param;
                            return;
                        default:
                            if (DEBUG) console.log("UNIMPLEMENTED glTexEnv", GL_Symbol(target), "GL_TEXTURE_ENV_MODE", GL_Symbol(param));
                            else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexEnv " + GL_Symbol(target) + " GL_TEXTURE_ENV_MODE " + GL_Symbol(param));
                    }
                    break;
                default:
                    if (DEBUG) console.log("UNIMPLEMENTED glTexEnv", GL_Symbol(target), GL_Symbol(pname), GL_Symbol(param));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexEnv " + GL_Symbol(target) + " " + GL_Symbol(pname));
            }
        },

        glTexEnvi: function(target, pname, param) {
            this.glTexEnv(target, pname, param);
        },

        glTexEnvf: function(target, pname, param) {
            this.glTexEnv(target, pname, param);
        },

        glTexGen: function(coord, pname, param) {
            if (gl.listMode && this.addToList("glTexGen", [coord, pname, param])) return;
            if (DEBUG) console.log("UNIMPLEMENTED glTexGen", GL_Symbol(coord, "S"), GL_Symbol(pname), GL_Symbol(param));
            else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexGen " + GL_Symbol(pname));
        },

        glTexGeni: function(coord, pname, param) {
            this.glTexGen(coord, pname, param);
        },

        glTexGenf: function(coord, pname, param) {
            this.glTexGen(coord, pname, param);
        },

        glTexGend: function(coord, pname, params) {
            this.glTexGen(coord, pname, param);
        },

        glTexGenfv: function(coord, pname, params) {
            if (gl.listMode && this.addToList("glTexGenfv", [coord, pname, params])) return;
            if (DEBUG) console.log("UNIMPLEMENTED glTexGenfv", GL_Symbol(coord, "S"), GL_Symbol(pname), Array.from(params));
            else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexGenfv " + GL_Symbol(pname));
        },

        glTexImage2D: function(target, level, internalformat, width, height, border, format, type, pixels) {
            if (gl.listMode && this.addToList("glTexImage2D", [target, level, internalformat, width, height, border, format, type, pixels])) return;
            DEBUG > 1 && console.log("glTexImage2D", GL_Symbol(target), level, GL_Symbol(internalformat), width, height, border, GL_Symbol(format), GL_Symbol(type), pixels);
            gl.texture.width = width;
            gl.texture.height = height;
            // WebGL does not support GL_UNPACK_ROW_LENGTH, GL_UNPACK_SKIP_ROWS, GL_UNPACK_SKIP_PIXELS
            if (gl.pixelStoreUnpackRowLength !== 0 && gl.pixelStoreUnpackRowLength !== gl.texture.width) {
                if (DEBUG) console.warn("UNIMPLEMENTED glTexImage2D GL_UNPACK_ROW_LENGTH " + gl.pixelStoreUnpackRowLength);
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexImage2D GL_UNPACK_ROW_LENGTH");
            }
            if (gl.pixelStoreUnpackSkipRows !== 0) {
                if (DEBUG) console.warn("UNIMPLEMENTED glTexImage2D GL_UNPACK_SKIP_ROWS " + gl.pixelStoreUnpackSkipRows);
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexImage2D GL_UNPACK_SKIP_ROWS");
            }
            if (gl.pixelStoreUnpackSkipPixels !== 0) {
                if (DEBUG) console.warn("UNIMPLEMENTED glTexImage2D GL_UNPACK_SKIP_PIXELS " + gl.pixelStoreUnpackSkipPixels);
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexImage2D GL_UNPACK_SKIP_PIXELS");
            }
            // WebGL only supports GL_RGBA
            switch (format) {
                case webgl.RGBA:
                    if (DEBUG) console.warn("glTexImage2D GL_RGBA: need to not swizzle BGRA");
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexImage2D format GL_RGBA");
                    break;
                case GL.BGRA:
                    format = webgl.RGBA;
                    break;
                default:
                    if (DEBUG) console.warn("UNIMPLEMENTED glTexImage2D format " + GL_Symbol(format));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexImage2D format " + GL_Symbol(format));
                    return;
            }
            // pixels are coming in via FFI as void* (ArrayBuffer)
            // convert to appropriate typed array
            // in OpenGL, pixels can be null to allocate texture storage
            if (!pixels) pixels = new ArrayBuffer(width * height * 4);
            switch (type) {
                case webgl.UNSIGNED_BYTE:
                    pixels = new Uint8Array(pixels);
                    gl.texture.pixels = pixels; // for debugging
                    break;
                default:
                    if (DEBUG) console.warn("UNIMPLEMENTED glTexImage2D type " + GL_Symbol(type));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexImage2D type " + GL_Symbol(type));
                    return;
            }
            webgl.texImage2D(target, level, internalformat, width, height, border, format, type, pixels);
        },

        debugTexture: function(texture) {
            if (texture === false) {
                var canvas = document.getElementById("texDebug");
                if (canvas) canvas.remove();
                return;
            }
            if (!texture) texture = gl.texture;
            var pixels = texture.pixels;
            var width = texture.width;
            var height = texture.height;
            var data = new Uint8Array(pixels);
            var canvas = document.getElementById("texDebug");
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = "texDebug";
                canvas.style.position = "absolute";
                canvas.style.zIndex = 1000;
                document.body.appendChild(canvas);
            }
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            var imageData = ctx.createImageData(width, height);
            imageData.data.set(data);
            ctx.putImageData(imageData, 0, 0);
        },

        glTexCoord2d: function(s, t) {
            if (gl.listMode && this.addToList("glTexCoord2d", [s, t])) return;
            DEBUG > 1 && console.log("glTexCoord2d", s, t);
            gl.texCoord[0] = s;
            gl.texCoord[1] = t;
            gl.primitiveAttrs |= HAS_TEXCOORD;
        },

        glTexCoord2f: function(s, t) {
            if (gl.listMode && this.addToList("glTexCoord2f", [s, t])) return;
            DEBUG > 1 && console.log("glTexCoord2f", s, t);
            gl.texCoord[0] = s;
            gl.texCoord[1] = t;
            gl.primitiveAttrs |= HAS_TEXCOORD;
        },

        glTexCoord2fv: function(v) {
            if (gl.listMode && this.addToList("glTexCoord2fv", [v.slice()])) return;
            DEBUG > 1 && console.log("glTexCoord2fv", Array.from(v));
            gl.texCoord.set(v);
            gl.primitiveAttrs |= HAS_TEXCOORD;
        },

        glTexCoordPointer: function(size, type, stride, pointer) {
            if (gl.listMode && this.addToList("glTexCoordPointer", [size, type, stride, pointer])) return;
            DEBUG > 1 && console.log("glTexCoordPointer", size, GL_Symbol(type), stride, pointer);
            gl.clientState.textureCoordArray.size = size;
            gl.clientState.textureCoordArray.type = type;
            gl.clientState.textureCoordArray.stride = stride;
            gl.clientState.textureCoordArray.pointer = pointer;
        },

        glTexParameteri: function(target, pname, param) {
            if (gl.listMode && this.addToList("glTexParameteri", [target, pname, param])) return;
            DEBUG > 1 && console.log("glTexParameteri", GL_Symbol(target), GL_Symbol(pname), GL_Symbol(param));
            webgl.texParameteri(target, pname, param);
        },

        glTexSubImage2D: function(target, level, xoffset, yoffset, width, height, format, type, pixels) {
            if (gl.listMode && this.addToList("glTexSubImage2D", [target, level, xoffset, yoffset, width, height, format, type, pixels])) return;
            DEBUG > 1 && console.log("glTexSubImage2D", GL_Symbol(target), level, xoffset, yoffset, width, height, GL_Symbol(format), GL_Symbol(type), pixels);
            // WebGL does not support GL_UNPACK_ROW_LENGTH, GL_UNPACK_SKIP_ROWS, GL_UNPACK_SKIP_PIXELS
            // emulate GL_UNPACK_SKIP_ROWS
            var pixelsOffset = gl.pixelStoreUnpackSkipRows * gl.texture.width; // to be multiplied by pixel size below
            // assume GL_UNPACK_ROW_LENGTH is full width (which is the case when uploading part of a bitmap in Squeak)
            if (gl.pixelStoreUnpackRowLength !== 0 && gl.pixelStoreUnpackRowLength !== gl.texture.width) {
                if (DEBUG) console.warn("UNIMPLEMENTED glTexSubImage2D GL_UNPACK_ROW_LENGTH " + gl.pixelStoreUnpackRowLength);
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexSubImage2D GL_UNPACK_ROW_LENGTH");
            }
            // WebGL does not support GL_UNPACK_SKIP_PIXELS to allow different width
            if (width !== gl.texture.width) {
                // we could either
                // 1. call texSubImage2D for each row
                // 2. copy subimage pixels into a new buffer
                // 3. call texSubImage2D for the whole width so we don't need to skip pixels
                // we choose 3. for now
                width = gl.texture.width;
                xoffset = 0;
            }
            // WebGL only supports RGB not BGR
            switch (format) {
                case webgl.RGBA:
                    pixelsOffset *= 4;
                    break;
                case GL.BGRA:
                    pixelsOffset *= 4;
                    format = webgl.RGBA;
                    break;
                default:
                    if (DEBUG) console.warn("UNIMPLEMENTED glTexSubImage2D format " + GL_Symbol(format));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexSubImage2D format " + GL_Symbol(format));
                    return;
            }
            // pixels are coming in via FFI as void* (ArrayBuffer)
            // convert to appropriate typed array
            switch (type) {
                case webgl.UNSIGNED_BYTE:
                    pixels = new Uint8Array(pixels, pixelsOffset);
                    break;
                default:
                    if (DEBUG) console.warn("UNIMPLEMENTED glTexSubImage2D type " + GL_Symbol(type));
                    else this.vm.warnOnce("OpenGL: UNIMPLEMENTED glTexSubImage2D type " + GL_Symbol(type));
                    return;
            }
            webgl.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels);
        },

        glVertex2f: function(x, y) {
            if (gl.listMode && this.addToList("glVertex2f", [x, y])) return;
            DEBUG > 1 && console.log("glVertex2f", x, y);
            var position = [x, y];
            this.pushVertex(position);
        },

        glVertex3f: function(x, y, z) {
            if (gl.listMode && this.addToList("glVertex3f", [x, y, z])) return;
            DEBUG > 1 && console.log("glVertex3f", x, y, z);
            var position = [x, y, z];
            this.pushVertex(position);
        },

        glVertex3fv: function(v) {
            if (gl.listMode && this.addToList("glVertex3fv", [v.slice()])) return;
            DEBUG > 1 && console.log("glVertex3fv", Array.from(v));
            this.pushVertex(v);
        },

        glVertex2i: function(x, y) {
            if (gl.listMode && this.addToList("glVertex2i", [x, y])) return;
            DEBUG > 1 && console.log("glVertex2i", x, y);
            var position = [x, y];
            this.pushVertex(position);
        },

        glVertexPointer: function(size, type, stride, pointer) {
            if (gl.listMode && this.addToList("glVertexPointer", [size, type, stride, pointer])) return;
            DEBUG > 1 && console.log("glVertexPointer", size, GL_Symbol(type), stride, pointer);
            gl.clientState.vertexArray.size = size;
            gl.clientState.vertexArray.type = type;
            gl.clientState.vertexArray.stride = stride;
            gl.clientState.vertexArray.pointer = pointer;
        },

        glViewport: function(x, y, width, height) {
            if (gl.listMode && this.addToList("glViewport", [x, y, width, height])) return;
            DEBUG > 1 && console.log("glViewport", x, y, width, height);
            webgl.viewport(x, y, width, height);
            gl.viewport[0] = x;
            gl.viewport[1] = y;
            gl.viewport[2] = width;
            gl.viewport[3] = height;
        },

        glXGetProcAddressARB: function(procName) {
            procName = Squeak.bytesAsString(procName);
            DEBUG > 1 && console.log("glXGetProcAddressARB", procName);
            var handle = this.ffi.ffiLookupFunc(this, procName);
            if (!handle) {
                if (DEBUG) console.warn("UNIMPLEMENTED EXT FUNC", procName);
                else this.vm.warnOnce("OpenGL: UNIMPLEMENTED EXT FUNC" + procName);
            }
            return handle;
        },

        pushVertex: function(position) {
            var primitive = gl.primitive;
            if (!primitive) throw Error("OpenGL: glBegin not called");
            if (!primitive.vertexSize) {
                var vertexSize = 3;
                if (gl.primitiveAttrs & HAS_NORMAL) vertexSize += 3;
                if (gl.primitiveAttrs & HAS_COLOR) vertexSize += 4;
                if (gl.primitiveAttrs & HAS_TEXCOORD) vertexSize += 2;
                primitive.vertexSize = vertexSize;
                primitive.vertexAttrs = gl.primitiveAttrs;
            }
            var vertex = new Float32Array(primitive.vertexSize);
            var offset = 0;
            vertex.set(position, offset); offset += 3;
            if (primitive.vertexAttrs & HAS_NORMAL) {
                vertex.set(gl.normal, offset); offset += 3;
            }
            if (primitive.vertexAttrs & HAS_COLOR) {
                vertex.set(gl.color, offset); offset += 4;
            }
            if (primitive.vertexAttrs & HAS_TEXCOORD) {
                vertex.set(gl.texCoord, offset); offset += 2;
            }
            primitive.vertices.push(vertex);
        },

        // Shader source code

        // Note: we could take a look at Emscripten's glemu to add some more features
        // https://github.com/emscripten-core/emscripten/blob/cb99414efed02dc61d04315d3e3cf5ad3180e56f/src/library_glemu.js#L2170
        // The structure is a bit different but applicable

        vertexShaderSource: function(shaderFlags) {
            var src = [];
            src.push("uniform mat4 uModelView;");
            src.push("uniform mat4 uProjection;");
            src.push("attribute vec3 aPosition;");
            if (shaderFlags & HAS_COLOR) {
                src.push("attribute vec4 aColor;");
            } else if (shaderFlags & ANY_LIGHTS) {
                src.push("uniform vec4 uColor;");
            }
            if (shaderFlags & (HAS_COLOR | ANY_LIGHTS)) {
                src.push("varying vec4 vColor;");
            }
            if (shaderFlags & HAS_TEXCOORD) {
                src.push("attribute vec2 aTexCoord;");
                src.push("varying vec2 vTexCoord;");
            }
            if (shaderFlags & USE_POINT_SIZE) {
                src.push("uniform float uPointSize;");
            }
            var numLights = (shaderFlags & NUM_LIGHTS_MASK) >> NUM_LIGHTS_SHIFT;
            if (numLights > 0) {
                if (shaderFlags & HAS_NORMAL) {
                    src.push("attribute vec3 aNormal;");
                } else {
                    src.push("uniform vec3 uNormal;");
                }
                src.push("uniform mat3 uNormalMatrix;");
                src.push("uniform vec4 uLightModelAmbient;");
                src.push("uniform vec4 uMaterialAmbient;");
                src.push("uniform vec4 uMaterialDiffuse;");
                src.push("uniform vec4 uMaterialSpecular;");
                src.push("uniform vec4 uMaterialEmission;");
                src.push("uniform float uMaterialShininess;");
                src.push("struct Light {");
                src.push("  vec4 position;");
                src.push("  vec4 ambient;");
                src.push("  vec4 diffuse;");
                src.push("  vec4 specular;");
                src.push("};");
                src.push("uniform Light uLights[" + numLights + "];");
            }
            var numClipPlanes = (shaderFlags & NUM_CLIP_PLANES_MASK) >> NUM_CLIP_PLANES_SHIFT;
            if (numClipPlanes > 0) {
                src.push("uniform vec4 uClipPlanes[" + numClipPlanes + "];");
                src.push("varying float vClipDist[" + numClipPlanes + "];");
            }
            var fog = (shaderFlags & FOG_MASK) >> FOG_SHIFT;
            if (fog !== NO_FOG) {
                if (fog === LINEAR_FOG) {
                    src.push("uniform float uFogEnd;");
                    src.push("uniform float uFogRange;");
                } else {
                    src.push("uniform float uFogDensity;");
                }
                src.push("varying float vFogDist;");
            }

            src.push("void main(void) {");
            if (shaderFlags & HAS_COLOR) {
                src.push("  vColor = aColor;");
            } else if (shaderFlags & ANY_LIGHTS) {
                src.push("  vColor = uColor;");
            }
            src.push("  vec4 position = uModelView * vec4(aPosition, 1.0);");
            if (numLights > 0) {
                if (shaderFlags & HAS_NORMAL) {
                    src.push("  vec3 normal = normalize(uNormalMatrix * aNormal);");
                } else {
                    src.push("  vec3 normal = normalize(uNormalMatrix * uNormal);");
                }
                src.push("  vec4 lighting = uMaterialEmission;");
                src.push("  lighting += uMaterialAmbient * uLightModelAmbient;");
                src.push("  vec3 eyeDir = normalize(-position.xyz);");
                src.push("  for (int i = 0; i < " + numLights + "; i++) {");
                src.push("    Light light = uLights[i];");
                src.push("    vec3 lightDir;");
                src.push("    if (light.position.w == 0.0) {");
                src.push("      lightDir = normalize(light.position.xyz);");
                src.push("    } else {");
                src.push("      lightDir = normalize(light.position.xyz - position.xyz);");
                src.push("    }");
                src.push("    float nDotL = max(dot(normal, lightDir), 0.0);");
                src.push("    vec4 ambient = uMaterialAmbient * light.ambient;");
                src.push("    vec4 diffuse = uMaterialDiffuse * light.diffuse * nDotL;");
                src.push("    vec4 specular = vec4(0.0);");
                src.push("    if (nDotL > 0.0) {");
                src.push("      vec3 halfVector = normalize(lightDir + eyeDir);");
                src.push("      float nDotHV = max(dot(normal, halfVector), 0.0);");
                src.push("      specular = uMaterialSpecular * light.specular * pow(nDotHV, uMaterialShininess);");
                src.push("    }");
                src.push("    lighting += ambient + diffuse + specular;");
                src.push("  }");
                src.push("  vColor = clamp(lighting, 0.0, 1.0);");
                src.push("  vColor.a = uMaterialDiffuse.a;");
            }
            if (numClipPlanes > 0) {
                src.push("  for (int i = 0; i < " + numClipPlanes + "; i++) {");
                src.push("    vClipDist[i] = dot(position, uClipPlanes[i]);");
                src.push("  }");
            }
            if (shaderFlags & HAS_TEXCOORD) {
                src.push("  vTexCoord = aTexCoord;");
            }
            if (fog !== NO_FOG) {
                src.push("  vFogDist = -position.z;");
            }
            if (shaderFlags & USE_POINT_SIZE) {
                src.push("  gl_PointSize = uPointSize;");
            }
            src.push("  gl_Position = uProjection * position;");
            src.push("}");
            var src = src.join("\n");
            DEBUG > 1 && console.log(src);
            return src;
        },

        fragmentShaderSource: function(shaderFlags) {
            var src = [];
            src.push("precision mediump float;");
            var numClipPlanes = (shaderFlags & NUM_CLIP_PLANES_MASK) >> NUM_CLIP_PLANES_SHIFT;
            if (numClipPlanes > 0) {
                src.push("varying float vClipDist[" + numClipPlanes + "];");
            }
            if (shaderFlags & (HAS_COLOR | ANY_LIGHTS)) {
                src.push("varying vec4 vColor;");
            } else {
                src.push("uniform vec4 uColor;");
            }
            if (shaderFlags & USE_TEXTURE) {
                if (shaderFlags & HAS_TEXCOORD) {
                    src.push("varying vec2 vTexCoord;");
                } else {
                    src.push("uniform vec2 uTexCoord;");
                }
                src.push("uniform sampler2D uSampler;");
            }
            var fog = (shaderFlags & FOG_MASK) >> FOG_SHIFT;
            if (fog !== NO_FOG) {
                if (fog === LINEAR_FOG) {
                    src.push("uniform float uFogEnd;");
                    src.push("uniform float uFogRange;");
                } else {
                    src.push("uniform float uFogDensity;");
                }
                src.push("uniform vec4 uFogColor;");
                src.push("varying float vFogDist;");
            }
            src.push("void main(void) {");
            if (numClipPlanes > 0) {
                src.push("  bool clipped = false;");
                src.push("  for (int i = 0; i < " + numClipPlanes + "; i++) {");
                src.push("    if (vClipDist[i] < 0.0) clipped = true;");
                src.push("  }");
                src.push("  if (clipped) discard;");
            }
            if (shaderFlags & (HAS_COLOR | ANY_LIGHTS)) {
                src.push("  vec4 color = vColor;");
            } else {
                src.push("  vec4 color = uColor;");
            }
            if (shaderFlags & USE_TEXTURE) {
                if (shaderFlags & HAS_TEXCOORD) {
                    src.push("  vec2 texCord = vTexCoord;");
                } else {
                    src.push("  vec2 texCord = uTexCoord;");
                }
                src.push("  color *= texture2D(uSampler, texCord).bgra;");
            }
            if (fog !== NO_FOG) {
                switch (fog) {
                    case LINEAR_FOG:
                        src.push("  float fogAmount = (uFogEnd - vFogDist) / uFogRange;");
                        break;
                    case EXP_FOG:
                        src.push("  float fogAmount = exp(-uFogDensity * vFogDist);");
                        break;
                    case EXP2_FOG:
                        src.push("  float fogAmount = exp(-uFogDensity * uFogDensity * vFogDist * vFogDist);");
                        break;
                }
                src.push("  color.rgb = mix(uFogColor.rgb, color.rgb, clamp(fogAmount, 0.0, 1.0));");
            }
            src.push("  gl_FragColor = color;");
            src.push("}");
            var src = src.join("\n");
            DEBUG > 1 && console.log(src);
            return src;
        },

        getLocations: function(program, shaderFlags) {
            var locations = {};
            locations.uModelView = webgl.getUniformLocation(program, "uModelView");
            locations.uProjection = webgl.getUniformLocation(program, "uProjection");
            locations.aPosition = webgl.getAttribLocation(program, "aPosition");
            if (shaderFlags & USE_TEXTURE) {
                if (shaderFlags & HAS_TEXCOORD) {
                    locations.aTexCoord = webgl.getAttribLocation(program, "aTexCoord");
                } else {
                    locations.uTexCoord = webgl.getUniformLocation(program, "uTexCoord");
                }
                locations.uSampler = webgl.getUniformLocation(program, "uSampler");
            }
            if (shaderFlags & HAS_COLOR) {
                locations.aColor = webgl.getAttribLocation(program, "aColor");
            } else {
                locations.uColor = webgl.getUniformLocation(program, "uColor");
            }
            if (shaderFlags & USE_POINT_SIZE) {
                locations.uPointSize = webgl.getUniformLocation(program, "uPointSize");
            }
            var numLights = (shaderFlags & NUM_LIGHTS_MASK) >> NUM_LIGHTS_SHIFT;
            if (numLights > 0) {
                if (shaderFlags & HAS_NORMAL) {
                    locations.aNormal = webgl.getAttribLocation(program, "aNormal");
                } else{
                    locations.uNormal = webgl.getUniformLocation(program, "uNormal");
                }
                locations.uNormalMatrix = webgl.getUniformLocation(program, "uNormalMatrix");
                locations.uLightModelAmbient = webgl.getUniformLocation(program, "uLightModelAmbient");
                locations.uMaterialAmbient = webgl.getUniformLocation(program, "uMaterialAmbient");
                locations.uMaterialDiffuse = webgl.getUniformLocation(program, "uMaterialDiffuse");
                locations.uMaterialSpecular = webgl.getUniformLocation(program, "uMaterialSpecular");
                locations.uMaterialEmission = webgl.getUniformLocation(program, "uMaterialEmission");
                locations.uMaterialShininess = webgl.getUniformLocation(program, "uMaterialShininess");
                locations.uLights = [];
                for (var i = 0; i < numLights; i++) {
                    var light = {};
                    light.position = webgl.getUniformLocation(program, "uLights[" + i + "].position");
                    light.ambient = webgl.getUniformLocation(program, "uLights[" + i + "].ambient");
                    light.diffuse = webgl.getUniformLocation(program, "uLights[" + i + "].diffuse");
                    light.specular = webgl.getUniformLocation(program, "uLights[" + i + "].specular");
                    locations.uLights.push(light);
                }
            }
            var numClipPlanes = (shaderFlags & NUM_CLIP_PLANES_MASK) >> NUM_CLIP_PLANES_SHIFT;
            if (numClipPlanes > 0) {
                locations.uClipPlanes = [];
                for (var i = 0; i < numClipPlanes; i++) {
                    locations.uClipPlanes.push(webgl.getUniformLocation(program, "uClipPlanes[" + i + "]"));
                }
            }
            var fog = (shaderFlags & FOG_MASK) >> FOG_SHIFT;
            if (fog !== NO_FOG) {
                if (fog === LINEAR_FOG) {
                    locations.uFogEnd = webgl.getUniformLocation(program, "uFogEnd");
                    locations.uFogRange = webgl.getUniformLocation(program, "uFogRange");
                } else {
                    locations.uFogDensity = webgl.getUniformLocation(program, "uFogDensity");
                }
                locations.uFogColor = webgl.getUniformLocation(program, "uFogColor");
            }

            DEBUG > 1 && console.log(locations);
            return locations;
        },

        executeList: function(listId) {
            var list = gl.lists[listId];
            if (!list) {
                DEBUG > 0 && console.warn("OpenGL: display list not found " + listId);
                return;
            }
            for (var i = 0; i < list.commands.length; i++) {
                var cmd = list.commands[i];
                this[cmd.name].apply(this, cmd.args);
            }
        },
    };
}

function transformDirection(matrix, src, dst) {
    var x = src[0];
    var y = src[1];
    var z = src[2];
    var rx = matrix[0] * x + matrix[4] * y + matrix[8] * z;
    var ry = matrix[1] * x + matrix[5] * y + matrix[9] * z;
    var rz = matrix[2] * x + matrix[6] * y + matrix[10] * z;
    dst[0] = rx;
    dst[1] = ry;
    dst[2] = rz;
    dst[3] = src[3];
}

function transformPoint(matrix, src, dst) {
    var x = src[0];
    var y = src[1];
    var z = src[2];
    var rx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    var ry = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    var rz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    var rw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    if (rw === 1) {
        dst[0] = rx;
        dst[1] = ry;
        dst[2] = rz;
    } else {
        if (rw !== 0) rw = 1 / rw;
        dst[0] = rx * rw;
        dst[1] = ry * rw;
        dst[2] = rz * rw;
    }
    dst[3] = src[3];
}

function multVec4(matrix, src, dst) {
    var x = src[0];
    var y = src[1];
    var z = src[2];
    var w = src[3];
    dst[0] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
    dst[1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
    dst[2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
    dst[3] = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;
}

function multMatrix(m1, m2) {
    var m00 = m1[0] * m2[0] + m1[4] * m2[1] + m1[8] * m2[2] + m1[12] * m2[3];
    var m01 = m1[1] * m2[0] + m1[5] * m2[1] + m1[9] * m2[2] + m1[13] * m2[3];
    var m02 = m1[2] * m2[0] + m1[6] * m2[1] + m1[10] * m2[2] + m1[14] * m2[3];
    var m03 = m1[3] * m2[0] + m1[7] * m2[1] + m1[11] * m2[2] + m1[15] * m2[3];
    var m10 = m1[0] * m2[4] + m1[4] * m2[5] + m1[8] * m2[6] + m1[12] * m2[7];
    var m11 = m1[1] * m2[4] + m1[5] * m2[5] + m1[9] * m2[6] + m1[13] * m2[7];
    var m12 = m1[2] * m2[4] + m1[6] * m2[5] + m1[10] * m2[6] + m1[14] * m2[7];
    var m13 = m1[3] * m2[4] + m1[7] * m2[5] + m1[11] * m2[6] + m1[15] * m2[7];
    var m20 = m1[0] * m2[8] + m1[4] * m2[9] + m1[8] * m2[10] + m1[12] * m2[11];
    var m21 = m1[1] * m2[8] + m1[5] * m2[9] + m1[9] * m2[10] + m1[13] * m2[11];
    var m22 = m1[2] * m2[8] + m1[6] * m2[9] + m1[10] * m2[10] + m1[14] * m2[11];
    var m23 = m1[3] * m2[8] + m1[7] * m2[9] + m1[11] * m2[10] + m1[15] * m2[11];
    var m30 = m1[0] * m2[12] + m1[4] * m2[13] + m1[8] * m2[14] + m1[12] * m2[15];
    var m31 = m1[1] * m2[12] + m1[5] * m2[13] + m1[9] * m2[14] + m1[13] * m2[15];
    var m32 = m1[2] * m2[12] + m1[6] * m2[13] + m1[10] * m2[14] + m1[14] * m2[15];
    var m33 = m1[3] * m2[12] + m1[7] * m2[13] + m1[11] * m2[14] + m1[15] * m2[15];
    m1[0] = m00; m1[1] = m01; m1[2] = m02; m1[3] = m03;
    m1[4] = m10; m1[5] = m11; m1[6] = m12; m1[7] = m13;
    m1[8] = m20; m1[9] = m21; m1[10] = m22; m1[11] = m23;
    m1[12] = m30; m1[13] = m31; m1[14] = m32; m1[15] = m33;
}

function translateMatrix(m, x, y, z) {
    m[12] += x * m[0] + y * m[4] + z * m[8];
    m[13] += x * m[1] + y * m[5] + z * m[9];
    m[14] += x * m[2] + y * m[6] + z * m[10];
    m[15] += x * m[3] + y * m[7] + z * m[11];
}

function rotateMatrix(m, angle, x, y, z) {
    // normalize axis vector
    var len = Math.sqrt(x * x + y * y + z * z);
    if (len === 0) return;
    if (len !== 1) {
        len = 1 / len;
        x *= len;
        y *= len;
        z *= len;
    }
    // create rotation matrix
    var degrees = Math.PI / 180;
    var c = Math.cos(angle * degrees);
    var s = Math.sin(angle * degrees);
    var t = 1 - c;
    var m00 = x * x * t + c;
    var m01 = x * y * t - z * s;
    var m02 = x * z * t + y * s;
    var m10 = y * x * t + z * s;
    var m11 = y * y * t + c;
    var m12 = y * z * t - x * s;
    var m20 = z * x * t - y * s;
    var m21 = z * y * t + x * s;
    var m22 = z * z * t + c;
    // multiply rotation matrix
    var m0 = m[0] * m00 + m[4] * m01 + m[8] * m02;
    var m1 = m[1] * m00 + m[5] * m01 + m[9] * m02;
    var m2 = m[2] * m00 + m[6] * m01 + m[10] * m02;
    var m3 = m[3] * m00 + m[7] * m01 + m[11] * m02;
    var m4 = m[0] * m10 + m[4] * m11 + m[8] * m12;
    var m5 = m[1] * m10 + m[5] * m11 + m[9] * m12;
    var m6 = m[2] * m10 + m[6] * m11 + m[10] * m12;
    var m7 = m[3] * m10 + m[7] * m11 + m[11] * m12;
    m[8] = m[0] * m20 + m[4] * m21 + m[8] * m22;
    m[9] = m[1] * m20 + m[5] * m21 + m[9] * m22;
    m[10] = m[2] * m20 + m[6] * m21 + m[10] * m22;
    m[11] = m[3] * m20 + m[7] * m21 + m[11] * m22;
    m[0] = m0; m[1] = m1; m[2] = m2; m[3] = m3;
    m[4] = m4; m[5] = m5; m[6] = m6; m[7] = m7;
}

function scaleMatrix(m, x, y, z) {
    m[0] *= x; m[1] *= x; m[2] *= x; m[3] *= x;
    m[4] *= y; m[5] *= y; m[6] *= y; m[7] *= y;
    m[8] *= z; m[9] *= z; m[10] *= z; m[11] *= z;
}

function transposeMatrix(m) {
    var m01 = m[1], m02 = m[2], m03 = m[3],
        m12 = m[6], m13 = m[7],
        m23 = m[11];
    m[1] = m[4]; m[2] = m[8]; m[3] = m[12];
    m[4] = m01; m[6] = m[9]; m[7] = m[13];
    m[8] = m02; m[9] = m12; m[11] = m[14];
    m[12] = m03; m[13] = m13; m[14] = m23;
}

function invertMatrix(src, dst) {
    if (!dst) dst = src;

    var m00 = src[0], m01 = src[1], m02 = src[2], m03 = src[3],
        m10 = src[4], m11 = src[5], m12 = src[6], m13 = src[7],
        m20 = src[8], m21 = src[9], m22 = src[10], m23 = src[11],
        m30 = src[12], m31 = src[13], m32 = src[14], m33 = src[15];

    var t00 = m00 * m11 - m01 * m10,
        t01 = m00 * m12 - m02 * m10,
        t02 = m00 * m13 - m03 * m10,
        t03 = m01 * m12 - m02 * m11,
        t04 = m01 * m13 - m03 * m11,
        t05 = m02 * m13 - m03 * m12,
        t06 = m20 * m31 - m21 * m30,
        t07 = m20 * m32 - m22 * m30,
        t08 = m20 * m33 - m23 * m30,
        t09 = m21 * m32 - m22 * m31,
        t10 = m21 * m33 - m23 * m31,
        t11 = m22 * m33 - m23 * m32;

    var det = t00 * t11 - t01 * t10 + t02 * t09 + t03 * t08 - t04 * t07 + t05 * t06;

    if (det === 0) return;

    var invDet = 1 / det;

    dst[0] = (m11 * t11 - m12 * t10 + m13 * t09) * invDet;
    dst[1] = (-m01 * t11 + m02 * t10 - m03 * t09) * invDet;
    dst[2] = (m31 * t05 - m32 * t04 + m33 * t03) * invDet;
    dst[3] = (-m21 * t05 + m22 * t04 - m23 * t03) * invDet;
    dst[4] = (-m10 * t11 + m12 * t08 - m13 * t07) * invDet;
    dst[5] = (m00 * t11 - m02 * t08 + m03 * t07) * invDet;
    dst[6] = (-m30 * t05 + m32 * t02 - m33 * t01) * invDet;
    dst[7] = (m20 * t05 - m22 * t02 + m23 * t01) * invDet;
    dst[8] = (m10 * t10 - m11 * t08 + m13 * t06) * invDet;
    dst[9] = (-m00 * t10 + m01 * t08 - m03 * t06) * invDet;
    dst[10] = (m30 * t04 - m31 * t02 + m33 * t00) * invDet;
    dst[11] = (-m20 * t04 + m21 * t02 - m23 * t00) * invDet;
    dst[12] = (-m10 * t09 + m11 * t07 - m12 * t06) * invDet;
    dst[13] = (m00 * t09 - m01 * t07 + m02 * t06) * invDet;
    dst[14] = (-m30 * t03 + m31 * t01 - m32 * t00) * invDet;
    dst[15] = (m20 * t03 - m21 * t01 + m22 * t00) * invDet;
}

function asNormalMatrix(m) {
    // inverse transpose of upper-left 3x3 matrix
    var out = new Float32Array(9);
    var m11 = m[0], m21 = m[1], m31 = m[2],
        m12 = m[4], m22 = m[5], m32 = m[6],
        m13 = m[8], m23 = m[9], m33 = m[10];
    var t11 = m33 * m22 - m32 * m23,
        t12 = m32 * m13 - m33 * m12,
        t13 = m23 * m12 - m22 * m13;
    var det = m11 * t11 + m21 * t12 + m31 * t13;
    if (det !== 0 ) {
        const s = 1 / det;
        // store in transposed order
        out[0] = t11 * s; out[3] = (m31 * m23 - m33 * m21) * s; out[6] = (m32 * m21 - m31 * m22) * s;
        out[1] = t12 * s; out[4] = (m33 * m11 - m31 * m13) * s; out[7] = (m31 * m12 - m32 * m11) * s;
        out[2] = t13 * s; out[5] = (m21 * m13 - m23 * m11) * s; out[8] = (m22 * m11 - m21 * m12) * s;
    }
    return out;
}

var GL_Symbols; // reverse mapping for debug printing
function GL_Symbol(constant, rangeStart) {
    if (constant === undefined) { debugger; return /* should not happen */}
    if (rangeStart !== undefined) {
        // rangeStart is e.g. "FALSE" or "POINTS" which are both 0
        var all = Object.keys(GL); // we're relying on insertion order here
        var start = all.indexOf(rangeStart);
        return all[start + constant - GL[rangeStart]];
    }
    else return GL_Symbols[constant] || constant;
}

function initGLConstants() {
    GL = {
        DEPTH_BUFFER_BIT:            0x00000100,
        STENCIL_BUFFER_BIT:          0x00000400,
        COLOR_BUFFER_BIT:            0x00004000,
        FALSE:                       0,
        TRUE:                        1,
        POINTS:                      0x0000,
        LINES:                       0x0001,
        LINE_LOOP:                   0x0002,
        LINE_STRIP:                  0x0003,
        TRIANGLES:                   0x0004,
        TRIANGLE_STRIP:              0x0005,
        TRIANGLE_FAN:                0x0006,
        QUADS:                       0x0007,
        QUAD_STRIP:                  0x0008,
        POLYGON:                     0x0009,
        NEVER:                       0x0200,
        LESS:                        0x0201,
        EQUAL:                       0x0202,
        LEQUAL:                      0x0203,
        GREATER:                     0x0204,
        NOTEQUAL:                    0x0205,
        GEQUAL:                      0x0206,
        ALWAYS:                      0x0207,
        SRC_COLOR:                   0x0300,
        ONE_MINUS_SRC_COLOR:         0x0301,
        SRC_ALPHA:                   0x0302,
        ONE_MINUS_SRC_ALPHA:         0x0303,
        DST_ALPHA:                   0x0304,
        ONE_MINUS_DST_ALPHA:         0x0305,
        DST_COLOR:                   0x0306,
        ONE_MINUS_DST_COLOR:         0x0307,
        SRC_ALPHA_SATURATE:          0x0308,
        NONE:                        0,
        FRONT_LEFT:                  0x0400,
        FRONT_RIGHT:                 0x0401,
        BACK_LEFT:                   0x0402,
        BACK_RIGHT:                  0x0403,
        FRONT:                       0x0404,
        BACK:                        0x0405,
        LEFT:                        0x0406,
        RIGHT:                       0x0407,
        FRONT_AND_BACK:              0x0408,
        NO_ERROR:                    0,
        INVALID_ENUM:                0x0500,
        INVALID_VALUE:               0x0501,
        INVALID_OPERATION:           0x0502,
        OUT_OF_MEMORY:               0x0505,
        EXP:                         0x0800,
        EXP2:                        0x0801,
        CW:                          0x0900,
        CCW:                         0x0901,
        POINT_SIZE:                  0x0B11,
        POINT_SIZE_RANGE:            0x0B12,
        POINT_SIZE_GRANULARITY:      0x0B13,
        LINE_SMOOTH:                 0x0B20,
        LINE_WIDTH:                  0x0B21,
        LINE_WIDTH_RANGE:            0x0B22,
        LINE_WIDTH_GRANULARITY:      0x0B23,
        LIST_INDEX:                  0x0B33,
        LIGHTING:                    0x0B50,
        ALPHA_TEST:                  0x0BC0,
        POLYGON_MODE:                0x0B40,
        POLYGON_SMOOTH:              0x0B41,
        CULL_FACE:                   0x0B44,
        CULL_FACE_MODE:              0x0B45,
        FRONT_FACE:                  0x0B46,
        COLOR_MATERIAL:              0x0B57,
        FOG:                         0x0B60,
        FOG_DENSITY:                 0x0B62,
        FOG_START:                   0x0B63,
        FOG_END:                     0x0B64,
        FOG_MODE:                    0x0B65,
        FOG_COLOR:                   0x0B66,
        DEPTH_RANGE:                 0x0B70,
        DEPTH_TEST:                  0x0B71,
        DEPTH_WRITEMASK:             0x0B72,
        DEPTH_CLEAR_VALUE:           0x0B73,
        DEPTH_FUNC:                  0x0B74,
        STENCIL_TEST:                0x0B90,
        STENCIL_CLEAR_VALUE:         0x0B91,
        STENCIL_FUNC:                0x0B92,
        STENCIL_VALUE_MASK:          0x0B93,
        STENCIL_FAIL:                0x0B94,
        STENCIL_PASS_DEPTH_FAIL:     0x0B95,
        STENCIL_PASS_DEPTH_PASS:     0x0B96,
        STENCIL_REF:                 0x0B97,
        STENCIL_WRITEMASK:           0x0B98,
        MATRIX_MODE:                 0x0BA0,
        NORMALIZE:                   0x0BA1,
        VIEWPORT:                    0x0BA2,
        MODELVIEW_STACK_DEPTH:       0x0BA3,
        PROJECTION_STACK_DEPTH:      0x0BA4,
        TEXTURE_STACK_DEPTH:         0x0BA5,
        MODELVIEW_MATRIX:            0x0BA6,
        PROJECTION_MATRIX:           0x0BA7,
        TEXTURE_MATRIX:              0x0BA8,
        ATTRIB_STACK_DEPTH:          0x0BB0,
        CLIENT_ATTRIB_STACK_DEPTH:   0x0BB1,
        ALPHA_TEST:                  0x0BC0,
        ALPHA_TEST_FUNC:             0x0BC1,
        ALPHA_TEST_REF:              0x0BC2,
        DITHER:                      0x0BD0,
        BLEND_DST:                   0x0BE0,
        BLEND_SRC:                   0x0BE1,
        BLEND:                       0x0BE2,
        LOGIC_OP_MODE:               0x0BF0,
        DRAW_BUFFER:                 0x0C01,
        READ_BUFFER:                 0x0C02,
        SCISSOR_BOX:                 0x0C10,
        SCISSOR_TEST:                0x0C11,
        COLOR_CLEAR_VALUE:           0x0C22,
        COLOR_WRITEMASK:             0x0C23,
        DOUBLEBUFFER:                0x0C32,
        STEREO:                      0x0C33,
        PERSPECTIVE_CORRECTION_HINT: 0x0C50,
        LINE_SMOOTH_HINT:            0x0C52,
        POLYGON_SMOOTH_HINT:         0x0C53,
        FOG_HINT:                    0x0C54,
        TEXTURE_GEN_S:               0x0C60,
        TEXTURE_GEN_T:               0x0C61,
        TEXTURE_GEN_R:               0x0C62,
        TEXTURE_GEN_Q:               0x0C63,
        PIXEL_MAP_I_TO_I:            0x0C70,
        PIXEL_MAP_S_TO_S:            0x0C71,
        PIXEL_MAP_I_TO_R:            0x0C72,
        PIXEL_MAP_I_TO_G:            0x0C73,
        PIXEL_MAP_I_TO_B:            0x0C74,
        PIXEL_MAP_I_TO_A:            0x0C75,
        PIXEL_MAP_R_TO_R:            0x0C76,
        PIXEL_MAP_G_TO_G:            0x0C77,
        PIXEL_MAP_B_TO_B:            0x0C78,
        PIXEL_MAP_A_TO_A:            0x0C79,
        PIXEL_MAP_I_TO_I_SIZE:       0x0CB0,
        PIXEL_MAP_S_TO_S_SIZE:       0x0CB1,
        PIXEL_MAP_I_TO_R_SIZE:       0x0CB2,
        PIXEL_MAP_I_TO_G_SIZE:       0x0CB3,
        PIXEL_MAP_I_TO_B_SIZE:       0x0CB4,
        PIXEL_MAP_I_TO_A_SIZE:       0x0CB5,
        PIXEL_MAP_R_TO_R_SIZE:       0x0CB6,
        PIXEL_MAP_G_TO_G_SIZE:       0x0CB7,
        PIXEL_MAP_B_TO_B_SIZE:       0x0CB8,
        PIXEL_MAP_A_TO_A_SIZE:       0x0CB9,
        UNPACK_SWAP_BYTES:           0x0CF0,
        UNPACK_LSB_FIRST:            0x0CF1,
        UNPACK_ROW_LENGTH:           0x0CF2,
        UNPACK_SKIP_ROWS:            0x0CF3,
        UNPACK_SKIP_PIXELS:          0x0CF4,
        UNPACK_ALIGNMENT:            0x0CF5,
        PACK_SWAP_BYTES:             0x0D00,
        PACK_LSB_FIRST:              0x0D01,
        PACK_ROW_LENGTH:             0x0D02,
        PACK_SKIP_ROWS:              0x0D03,
        PACK_SKIP_PIXELS:            0x0D04,
        PACK_ALIGNMENT:              0x0D05,
        MAX_TEXTURE_SIZE:            0x0D33,
        MAX_VIEWPORT_DIMS:           0x0D3A,
        SUBPIXEL_BITS:               0x0D50,
        TEXTURE_1D:                  0x0DE0,
        TEXTURE_2D:                  0x0DE1,
        TEXTURE_WIDTH:               0x1000,
        TEXTURE_HEIGHT:              0x1001,
        TEXTURE_BORDER_COLOR:        0x1004,
        DONT_CARE:                   0x1100,
        FASTEST:                     0x1101,
        NICEST:                      0x1102,
        AMBIENT:                     0x1200,
        DIFFUSE:                     0x1201,
        SPECULAR:                    0x1202,
        POSITION:                    0x1203,
        SPOT_CUTOFF:                 0x1206,
        COMPILE:                     0x1300,
        COMPILE_AND_EXECUTE:         0x1301,
        BYTE:                        0x1400,
        UNSIGNED_BYTE:               0x1401,
        SHORT:                       0x1402,
        UNSIGNED_SHORT:              0x1403,
        INT:                         0x1404,
        UNSIGNED_INT:                0x1405,
        FLOAT:                       0x1406,
        STACK_OVERFLOW:              0x0503,
        STACK_UNDERFLOW:             0x0504,
        CLEAR:                       0x1500,
        AND:                         0x1501,
        AND_REVERSE:                 0x1502,
        COPY:                        0x1503,
        AND_INVERTED:                0x1504,
        NOOP:                        0x1505,
        XOR:                         0x1506,
        OR:                          0x1507,
        NOR:                         0x1508,
        EQUIV:                       0x1509,
        INVERT:                      0x150A,
        OR_REVERSE:                  0x150B,
        COPY_INVERTED:               0x150C,
        OR_INVERTED:                 0x150D,
        NAND:                        0x150E,
        SET:                         0x150F,
        EMISSION:                    0x1600,
        SHININESS:                   0x1601,
        AMBIENT_AND_DIFFUSE:         0x1602,
        COLOR_INDEXES:               0x1603,
        MODELVIEW:                   0x1700,
        PROJECTION:                  0x1701,
        TEXTURE:                     0x1702,
        COLOR:                       0x1800,
        DEPTH:                       0x1801,
        STENCIL:                     0x1802,
        STENCIL_INDEX:               0x1901,
        DEPTH_COMPONENT:             0x1902,
        RED:                         0x1903,
        GREEN:                       0x1904,
        BLUE:                        0x1905,
        ALPHA:                       0x1906,
        RGB:                         0x1907,
        RGBA:                        0x1908,
        POINT:                       0x1B00,
        LINE:                        0x1B01,
        FILL:                        0x1B02,
        FLAT:                        0x1D00,
        SMOOTH:                      0x1D01,
        KEEP:                        0x1E00,
        REPLACE:                     0x1E01,
        INCR:                        0x1E02,
        DECR:                        0x1E03,
        VENDOR:                      0x1F00,
        RENDERER:                    0x1F01,
        VERSION:                     0x1F02,
        EXTENSIONS:                  0x1F03,
        S:                           0x2000,
        T:                           0x2001,
        R:                           0x2002,
        Q:                           0x2003,
        MODULATE:                    0x2100,
        DECAL:                       0x2101,
        TEXTURE_ENV_MODE:            0x2200,
        TEXTURE_ENV:                 0x2300,
        EYE_LINEAR:                  0x2400,
        OBJECT_LINEAR:               0x2401,
        SPHERE_MAP:                  0x2402,
        TEXTURE_GEN_MODE:            0x2500,
        OBJECT_PLANE:                0x2501,
        EYE_PLANE:                   0x2502,
        SPHERE_MAP:                  0x2402,
        NEAREST:                     0x2600,
        LINEAR:                      0x2601,
        NEAREST_MIPMAP_NEAREST:      0x2700,
        LINEAR_MIPMAP_NEAREST:       0x2701,
        NEAREST_MIPMAP_LINEAR:       0x2702,
        LINEAR_MIPMAP_LINEAR:        0x2703,
        TEXTURE_MAG_FILTER:          0x2800,
        TEXTURE_MIN_FILTER:          0x2801,
        TEXTURE_WRAP_S:              0x2802,
        TEXTURE_WRAP_T:              0x2803,
        REPEAT:                      0x2901,
        CLIP_PLANE0:                 0x3000,
        CLIP_PLANE1:                 0x3001,
        CLIP_PLANE2:                 0x3002,
        CLIP_PLANE3:                 0x3003,
        CLIP_PLANE4:                 0x3004,
        CLIP_PLANE5:                 0x3005,
        CLIP_PLANE6:                 0x3006,
        CLIP_PLANE7:                 0x3007,
        LIGHT0:                      0x4000,
        LIGHT1:                      0x4001,
        LIGHT2:                      0x4002,
        LIGHT3:                      0x4003,
        LIGHT4:                      0x4004,
        LIGHT5:                      0x4005,
        LIGHT6:                      0x4006,
        LIGHT7:                      0x4007,
        BGRA:                        0x80E1,
        CLAMP_TO_EDGE:               0x812F,
        VERTEX_ARRAY:                0x8074,
        NORMAL_ARRAY:                0x8075,
        COLOR_ARRAY:                 0x8076,
        INDEX_ARRAY:                 0x8077,
        TEXTURE_COORD_ARRAY:         0x8078,
        TEXTURE_COMPRESSED:          0x86A1,
        CURRENT_BIT:                0x00001,
        POINT_BIT:                  0x00002,
        LINE_BIT:                   0x00004,
        POLYGON_BIT:                0x00008,
        POLYGON_STIPPLE_BIT:        0x00010,
        PIXEL_MODE_BIT:             0x00020,
        LIGHTING_BIT:               0x00040,
        FOG_BIT:                    0x00080,
        DEPTH_BUFFER_BIT:           0x00100,
        ACCUM_BUFFER_BIT:           0x00200,
        STENCIL_BUFFER_BIT:         0x00400,
        VIEWPORT_BIT:               0x00800,
        TRANSFORM_BIT:              0x01000,
        ENABLE_BIT:                 0x02000,
        COLOR_BUFFER_BIT:           0x04000,
        HINT_BIT:                   0x08000,
        EVAL_BIT:                   0x10000,
        LIST_BIT:                   0x20000,
        TEXTURE_BIT:                0x40000,
        SCISSOR_BIT:                0x80000,
        ALL_ATTRIB_BITS:            0xFFFFF,
        ZERO:                             0,
        ONE:                              1,
    };
    GL_Symbols = {};
    for (var name in GL) {
        var value = GL[name];
        GL_Symbols[value] = name;
    }
}

function registerOpenGL() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule('libGL.so', OpenGL());
    } else self.setTimeout(registerOpenGL, 100);
};

registerOpenGL();
