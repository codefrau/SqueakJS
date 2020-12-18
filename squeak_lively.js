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

"use strict";

//////////////////////////////////////////////////////////////////////////////
// This loads SqueakJS as a Lively module
// Refer to lively/README.md for running the visual VM debugger
//////////////////////////////////////////////////////////////////////////////

module('users.SqueakJS.squeak_lively').requires().toRun(function() {
    Object.extend(users.SqueakJS.squeak_lively, {
        loadSqueak: function(thenDo) {
            // bail out if loaded already
            if (Global.Squeak) return thenDo && thenDo();
            // otherwise, load all
            var files = [
                "globals.js",
                "vm.js",
                "vm.object.js",
                "vm.object.spur.js",
                "vm.image.js",
                "vm.interpreter.js",
                "vm.interpreter.proxy.js",
                "vm.instruction.stream.js",
                "vm.instruction.stream.sista.js",
                "vm.instruction.printer.js",
                "vm.primitives.js",
                "jit.js",
                "vm.audio.browser.js",
                "vm.display.js",
                "vm.display.browser.js",
                "vm.files.browser.js",
                "vm.input.js",
                "vm.input.browser.js",
                "vm.plugins.js",
                "vm.plugins.ffi.js",
                "vm.plugins.javascript.js",
                "vm.plugins.obsolete.js",
                "vm.plugins.drop.browser.js",
                "vm.plugins.file.browser.js",
                "vm.plugins.jpeg2.browser.js",
                "vm.plugins.scratch.browser.js",
                "vm.plugins.sound.browser.js",
                "plugins/ADPCMCodecPlugin.js",
                "plugins/B2DPlugin.js",
                "plugins/BitBltPlugin.js",
                "plugins/CroquetPlugin.js",
                "plugins/FFTPlugin.js",
                "plugins/FloatArrayPlugin.js",
                "plugins/GeniePlugin.js",
                "plugins/JPEGReaderPlugin.js",
                "plugins/KedamaPlugin.js",
                "plugins/KedamaPlugin2.js",
                "plugins/Klatt.js",
                "plugins/LargeIntegers.js",
                "plugins/Matrix2x3Plugin.js",
                "plugins/MiscPrimitivePlugin.js",
                "plugins/ScratchPlugin.js",
                "plugins/SocketPlugin.js",
                "plugins/SpeechPlugin.js",
                "plugins/SqueakSSL.js",
                "plugins/SoundGenerationPlugin.js",
                "plugins/StarSqueakPlugin.js",
                "plugins/ZipPlugin.js",
                "lib/lz-string.js",
                "lib/jszip.js",
                "lib/FileSaver.js",
                "lib/sha1.js",
            ];
            var base = URL.root.withFilename("users/SqueakJS/");
            JSLoader.resolveAndLoadAll(base, files, function() {
                Object.extend(Squeak, {
                    vmPath: "/",
                    platformSubtype: "Browser",
                    osVersion: navigator.userAgent,     // might want to parse
                    windowSystem: "HTML",
                });
                if (thenDo) thenDo();
            });
        },
    });
});
