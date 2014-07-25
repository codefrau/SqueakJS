/*
 * Copyright (c) 2013,2014 Bert Freudenberg
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


//////////////////////////////////////////////////////////////////////////////
// these functions fake the Lively module and class system
// just enough so the loading of vm.js succeeds
//////////////////////////////////////////////////////////////////////////////

module = function(dottedPath) {
    if (dottedPath == "") return window;
    var path = dottedPath.split("."),
        name = path.pop(),
        parent = module(path.join("."));
    if (!parent[name]) parent[name] = {
        requires: function(ignored) { return this; },
        toRun: function(code) { code(); }
    };
    return parent[name];
};

Object.subclass = function(classPath /* + more args */ ) {
    var path = classPath.split("."),
        className = path.pop();
    var newClass = function() {
        if (this.initialize) this.initialize.apply(this, arguments);
        return this;
    };
    // skip arg 0, copy properties of other args to class proto
    for (var i = 1; i < arguments.length; i++)
        for (name in arguments[i])
            newClass.prototype[name] = arguments[i][name];
    module(path.join('.'))[className] = newClass;
};

Object.extend = function(obj /* + more args */ ) {
    // skip arg 0, copy properties of other args to obj
    for (var i = 1; i < arguments.length; i++)
        for (name in arguments[i])
            obj[name] = arguments[i][name];
};

//////////////////////////////////////////////////////////////////////////////
// display & event setup 
//////////////////////////////////////////////////////////////////////////////

function setupFullscreen(display, canvas) {
    // Fullscreen can only be enabled in an event handler. So we check the
    // fullscreen flag on every mouse down/up and keyboard event.        

    // If the user canceled fullscreen, turn off the fullscreen flag so
    // we don't try to enable it again in the next event
    function fullscreenChange(fullscreenElement) {
        display.fullscreen = canvas == fullscreenElement;
    };

    // Fullscreen support is very browser-dependent
    if (canvas.requestFullscreen) {
        document.addEventListener("fullscreenchange", function(){fullscreenChange(document.fullscreenElement)});
        return function checkFullscreen() {
            if (document.fullscreenEnabled && !document.fullscreenElement == display.fullscreen) {
                if (display.fullscreen) canvas.requestFullscreen();
                else document.exitFullscreen();
            }
        }
    } else if (canvas.webkitRequestFullscreen) {
        document.addEventListener("webkitfullscreenchange", function(){fullscreenChange(document.webkitFullscreenElement)});
        return function checkFullscreen() {
            if (document.webkitFullscreenEnabled && !document.webkitFullscreenElement == display.fullscreen) {
                if (display.fullscreen) canvas.webkitRequestFullscreen();
                else document.webkitExitFullscreen();
            }
        }
    } else if (canvas.mozRequestFullScreen) {
        document.addEventListener("mozfullscreenchange", function(){fullscreenChange(document.mozFullScreenElement)});
        return function checkFullscreen() {
            if (document.mozFullScreenEnabled && !document.mozFullScreenElement == display.fullscreen) {
                if (display.fullscreen) canvas.mozRequestFullScreen();
                else document.mozCancelFullScreen();
            }
        }
    } else if (canvas.msRequestFullscreen) {
        document.addEventListener("MSFullscreenChange", function(){fullscreenChange(document.msFullscreenElement)});
        return function checkFullscreen() {
            if (document.msFullscreenEnabled && !document.msFullscreenElement == display.fullscreen) {
                if (display.fullscreen) canvas.msRequestFullscreen();
                else document.msExitFullscreen();
            }
        }
    } else {
        return function checkFullscreen() {}
    }
}

function createSqueakDisplay(canvas, options) {
    options = options || {};
    var display = {
        context: canvas.getContext("2d"),
        fullscreen: false,
        mouseX: 0,
        mouseY: 0,
        buttons: 0,
        keys: [],
        clipboardString: '',
        clipboardStringChanged: false,
    };
    var checkFullscreen = setupFullscreen(display, canvas);
    display.clear = function() {
        canvas.width = canvas.width;
    };
    display.showBanner = function(msg, style) {
        style = style || {};
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = style.color || "#F90";
        ctx.font = style.font || 'bold 48px sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
    };
    canvas.onmousedown = function(evt) {
        checkFullscreen();
        canvas.focus();
        var button = (options.swapButtons ? [4, 1, 2] : [4, 2, 1])[evt.button];
        display.buttons = display.buttons & ~7 | button;
        evt.preventDefault();
        return false;
    };
    canvas.onmouseup = function(evt) {
        checkFullscreen();
        display.buttons = display.buttons & ~7;
        evt.preventDefault();
    };
    canvas.onmousemove = function(evt) {
        // scale events to actual canvas extent
        display.mouseX = (evt.pageX - this.offsetLeft) * (this.width / this.offsetWidth);
        display.mouseY = (evt.pageY - this.offsetTop) * (this.height / this.offsetHeight);
    };
    canvas.oncontextmenu = function() {
        return false;
    };
    canvas.ontouchstart = function(evt) {
        canvas.focus();
        display.buttons = 4;
        canvas.ontouchmove(evt);
    };
    canvas.ontouchmove = function(evt) {
        canvas.onmousemove(evt.touches[0]);
    };
    canvas.ontouchend = function(evt) {
        display.buttons = 0;
        canvas.ontouchmove(evt);
    };
    canvas.ontouchcancel = function(evt) {
        display.buttons = 0;
    };
    canvas.onkeypress = function(evt) {
        display.keys.push(evt.charCode);
        evt.preventDefault();
    };
    canvas.onkeydown = function(evt) {
        checkFullscreen();
        var code = ({46:127, 8:8, 45:5, 9:9, 13:13, 27:27, 36:1, 35:4,
            33:11, 34:12, 37:28, 39:29, 38:30, 40:31})[evt.keyCode];
        if (code) {display.keys.push(code); return evt.preventDefault()};
        var modifier = ({16:8, 17:16, 91:64, 18:64})[evt.keyCode];
        if (modifier) {
            display.buttons |= modifier;
            if (modifier > 8) display.keys = [];
            return evt.preventDefault();
        }
        if ((evt.metaKey || evt.altKey) && evt.which) {
            code = evt.which;
            if (code >= 65 && code <= 90) if (!evt.shiftKey) code += 32;
            else if (evt.keyIdentifier && evt.keyIdentifier.slice(0,2) == 'U+')
                code = parseInt(evt.keyIdentifier.slice(2), 16);
            display.keys.push(code)
            return evt.preventDefault();
        }
    };
    canvas.onkeyup = function(evt) {
        var modifier = ({16:8, 17:16, 91:64, 18:64})[evt.keyCode];
        if (modifier) { display.buttons &= ~modifier; return evt.preventDefault(); }
    };
    return display;
};

//////////////////////////////////////////////////////////////////////////////
// browser stuff 
//////////////////////////////////////////////////////////////////////////////

if (window.applicationCache) {
    applicationCache.addEventListener('updateready', function() {
        applicationCache.swapCache();
        if (confirm('SqueakJS has been updated. Restart now?')) {
            window.location.reload();
        }
    });
}
