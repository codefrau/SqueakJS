/*
 * SimplePlugin.js: Example for an external Squeak VM module
 *
 * primNavigatorInfo: anInteger
 *     <primitive: 'primitiveNavigatorInfo' module: 'SimplePlugin'>
 *     ^ self primitiveFailed
 */
 
function SimplePlugin() {
    var interpreterProxy,
        primHandler;

    function setInterpreter(anInterpreterProxy) {
        // Slang interface
        interpreterProxy = anInterpreterProxy;
        // PrimHandler methods for convenience
        primHandler = interpreterProxy.vm.primHandler;
        // success
        return true;
    };

    function primitiveNavigatorInfo(argCount) {
        if (argCount !== 1) return false; // fail
        var which = interpreterProxy.stackIntegerValue(0);
        if (interpreterProxy.failed()) return false; // fail
        var result = getNavigatorInfo(which);
        if (!result) return false; // fail
        var resultObj = primHandler.makeStString(result);
        interpreterProxy.popthenPush(1 + argCount, resultObj);
        return true; // success
    };

    function getNavigatorInfo(index) {
        switch (index) {
            case 1: return navigator.userAgent;
            case 2: return navigator.language;
        }
    };

    // hide private functions
    return {
        setInterpreter: setInterpreter,
        primitiveNavigatorInfo: primitiveNavigatorInfo,
    }
};

// register plugin in global Squeak object
window.addEventListener("load", function() {
    Squeak.registerExternalModule('SimplePlugin', SimplePlugin());
});

/**********************************
NOTE: the mini.image does not have compiler support for
named primitives, yet. You need to declare it manually 
using prim 117:

primNavigatorInfo: anInteger
    <primitive: 117>
    #(SimplePlugin primitiveNavigatorInfo 0 0) at: 1.
    ^ self primitiveFailed
***********************************/
