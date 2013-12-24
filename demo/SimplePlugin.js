/*
 * SimplePlugin.js: Example for an external Squeak VM module
 *
 * primNavigatorInfo: anInteger
 *     <primitive: 'primitiveNavigatorInfo' module: 'SimplePlugin'>
 *     ^ self primitiveFailed
 */
 
var SimplePlugin = function() {
    var proxy;

    function initializeModule(interpreterProxy) {
        // interpreterProxy is vm.primHandler - might change to a real proxy later?
        proxy = interpreterProxy;
    };

    function primitiveNavigatorInfo(argCount) {
        if (argCount !== 1) return false; // fail
        var which = proxy.stackInteger(0);
        if (!proxy.success) return false; // fail
        var result;
        switch (which) {
            case 1: result = navigator.userAgent; break;
            case 2: result = navigator.language; break;
        }
        if (!result) return false; // fail
        var resultObj = proxy.makeStString(result);
        proxy.vm.popNandPush(1 + argCount, resultObj);
        return true; // success
    };

    return {
        exports: {
            initializeModule: initializeModule,
            primitiveNavigatorInfo: primitiveNavigatorInfo,
        }
    }
};

// register plugin in global Squeak object
Squeak.registerExternalModule('SimplePlugin', SimplePlugin());


/**********************************
NOTE: the mini.image does not have compiler support for
named primitives, yet. You need to declare it manually 
using prim 117:

primNavigatorInfo: anInteger
    <primitive: 117>
    #(SimplePlugin primitiveNavigatorInfo 0 0).
    ^ self primitiveFailed
***********************************/