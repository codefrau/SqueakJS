"use strict";
/*
 * Copyright (c) 2013-2024 Vanessa Freudenberg
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

// This is a minimal libc module for SqueakJS
// serving mostly as a demo for FFI

function libc() {
    return {
        // LIBC module
        getModuleName() { return "libc (SqueakJS)"; },
        setInterpreter(proxy) { this.vm = proxy.vm; return true; },

        // helper functions
        bytesToString(bytes) {
            const zero = bytes.indexOf(0);
            if (zero >= 0) bytes = bytes.subarray(0, zero);
            return String.fromCharCode.apply(null, bytes);
        },
        stringToBytes(string, bytes) {
            for (let i = 0; i < string.length; i++) bytes[i] = string.charCodeAt(i);
            bytes[string.length] = 0;
            return bytes;
        },

        // LIBC emulation functions called via FFI
        getenv(v) {
            v = this.bytesToString(v);
            switch (v) {
                case "USER": return this.vm.options.user || "squeak";
                case "HOME": return this.vm.options.root || "/";
            }
            this.vm.warnOnce("UNIMPLEMENTED getenv: " + v);
            return null;
        },
        getcwd(buf, size) {
            const cwd = this.vm.options.root || "/";
            if (!buf) buf = new Uint8Array(cwd.length + 1);
            if (size < cwd.length + 1) return 0; // should set errno to ERANGE
            this.stringToBytes(cwd, buf);
            return buf; // converted to Smalltalk String by FFI if declared as char*
        },
    };
}

function registerLibC() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule('libc', libc());
    } else self.setTimeout(registerLibC, 100);
};

registerLibC();
