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
'initialization', {
    initPlugins: function() {
        Object.extend(this.builtinModules, {
            JavaScriptPlugin:       this.findPluginFunctions("js_"),
            FilePlugin:             this.findPluginFunctions("", "primitive(Disable)?(File|Directory)"),
            DropPlugin:             this.findPluginFunctions("", "primitiveDropRequest"),
            SoundPlugin:            this.findPluginFunctions("snd_"),
            JPEGReadWriter2Plugin:  this.findPluginFunctions("jpeg2_"),
            SqueakFFIPrims:         this.findPluginFunctions("ffi_", "", true),
            SecurityPlugin: {
                primitiveDisableImageWrite: this.fakePrimitive.bind(this, "SecurityPlugin.primitiveDisableImageWrite", 0),
            },
            LocalePlugin: {
                primitiveTimezoneOffset: this.fakePrimitive.bind(this, "LocalePlugin.primitiveTimezoneOffset", 0),
            },
        });
        Object.extend(this.patchModules, {
            ScratchPlugin:          this.findPluginFunctions("scratch_"),
        });
    },
    findPluginFunctions: function(prefix, match, bindLate) {
        match = match || "(initialise|shutdown|prim)";
        var plugin = {},
            regex = new RegExp("^" + prefix + match, "i");
        for (var funcName in this)
            if (regex.test(funcName) && typeof this[funcName] == "function") {
                var primName = funcName;
                if (prefix) primName = funcName[prefix.length].toLowerCase() + funcName.slice(prefix.length + 1);
                plugin[primName] = bindLate ? funcName : this[funcName].bind(this);
            }
        return plugin;
    },
});
