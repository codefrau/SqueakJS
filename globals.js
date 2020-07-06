"use strict";

// Create Squeak VM namespace
if (!self.Squeak) self.Squeak = {};

// Setup a storage for settings
// Try (a working) localStorage and fall back to regular dictionary otherwise
var localStorage;
try {
    // fails in restricted iframe
    localStorage = self.localStorage;
    localStorage["squeak-foo:"] = "bar";
    if (localStorage["squeak-foo:"] !== "bar") throw Error();
    delete localStorage["squeak-foo:"];
} catch(e) {
    localStorage = {};
}
self.Squeak.Settings = localStorage;

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
        // add class to superclass
        var superclassPath = classPath.split("."),
            className = superclassPath.pop(),
            superclass = superclassPath.length > 0 ?
                // Walk classes 'path' (if non-empty class path)
                superclassPath.reduce(function(superclass, path) {
                    return superclass[path];
                }, self) :
                // A root class is installed (if empty class path)
                self;
        superclass[className] = subclass;
        return subclass;
    };

}
