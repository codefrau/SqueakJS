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

// Create Squeak VM namespace
if (!self.Squeak) self.Squeak = {};

// Setup a storage for settings
if (!Squeak.Settings) {
    // Try (a working) localStorage and fall back to regular dictionary otherwise
    var settings;
    try {
        // fails in restricted iframe
        settings = self.localStorage;
        settings["squeak-foo:"] = "bar";
        if (settings["squeak-foo:"] !== "bar") throw Error();
        delete settings["squeak-foo:"];
    } catch(e) {
        settings = {};
    }
    Squeak.Settings = settings;
}

if (!Object.extend) {
    // Extend object by adding specified properties
    Object.extend = function(obj /* + more args */ ) {
        // skip arg 0, copy properties of other args to obj
        for (var i = 1; i < arguments.length; i++)
            if (typeof arguments[i] == 'object')
                for (var name in arguments[i])
                    obj[name] = arguments[i][name];
    };
}


// This mimics the Lively Kernel's subclassing scheme.
// When running there, Lively's subclasses and modules are used.
// Modules serve as namespaces in Lively. SqueakJS uses a flat namespace
// named "Squeak", but the code below still supports hierarchical names.
if (!Function.prototype.subclass) {
    // Create subclass using specified class path and given properties
    Function.prototype.subclass = function(classPath /* + more args */ ) {
        // create subclass
        var subclass = function() {
            if (this.initialize) this.initialize.apply(this, arguments);
            return this;
        };
        // set up prototype
        var protoclass = function() { };
        protoclass.prototype = this.prototype;
        subclass.prototype = new protoclass();
        // skip arg 0, copy properties of other args to prototype
        for (var i = 1; i < arguments.length; i++)
            Object.extend(subclass.prototype, arguments[i]);
        // add class to namespace
        var path = classPath.split("."),
            className = path.pop(),
            // Walk path starting at the global namespace (self)
            // creating intermediate namespaces if necessary
            namespace = path.reduce(function(namespace, path) {
                if (!namespace[path]) namespace[path] = {};
                return namespace[path];
            }, self);
        namespace[className] = subclass;
        return subclass;
    };

}
