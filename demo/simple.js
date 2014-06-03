/*
 * Copyright (c) 2013 Bert Freudenberg
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

module = function(moduleName) {
    // actual module hierarchy is implicitly created by subclass() below
    return {
        requires: function(ignored) { return this; },
        toRun: function(code) { code(); }
    };
};

Object.subclass = function(classPath /* + more args */ ) {
    // create module hierarchy and new class
    var path = classPath.split("."),
        className = path.pop(),
        submodule = window;
    for (var i = 0; i < path.length; i++)
        submodule = submodule[path[i]] = submodule[path[i]] || {};
    var aClass = function() {
        if (this.initialize) this.initialize.apply(this, arguments);
        return this;
    };
    // skip arg 0, copy properties of other args to class proto
    for (var i = 1; i < arguments.length; i++)
        for (name in arguments[i])
            aClass.prototype[name] = arguments[i][name];
    submodule[className] = aClass;
};

Object.extend = function(obj /* + more args */ ) {
    // skip arg 0, copy properties of other args to obj
    for (var i = 1; i < arguments.length; i++)
        for (name in arguments[i])
            obj[name] = arguments[i][name];
};

//////////////////////////////////////////////////////////////////////////////
// now for the good stuff
//////////////////////////////////////////////////////////////////////////////


window.onload = function() {
    var canvas = document.getElementsByTagName("canvas")[0];
    if (navigator.standalone) {
        document.body.style.margin = 0;
        document.body.style.backgroundColor = 'black';
        ['h1','p','div'].forEach(function(n){document.getElementsByTagName(n)[0].style.display="none"});
        var scale = screen.width / canvas.width;
        var head = document.getElementsByTagName("head")[0];
        head.innerHTML += '<meta name="viewport" content="initial-scale=' + scale + '">';
    }
    function createDisplay() {
        var display = {
            ctx: canvas.getContext("2d"),
            width: canvas.width,
            height: canvas.height,
            mouseX: 0,
            mouseY: 0,
            buttons: 0,
            keys: [],
            clipboardString: '',
            clipboardStringChanged: false,
        };
        canvas.onmousedown = function(evt) {
            canvas.focus();
            display.buttons = display.buttons & ~7 | (4 >> evt.button);
        };
        canvas.onmouseup = function(evt) {
            display.buttons = display.buttons & ~7;
        };
        canvas.onmousemove = function(evt) {
            display.mouseX = evt.pageX - this.offsetLeft;
            display.mouseY = evt.pageY - this.offsetTop;
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
        };
        canvas.onkeydown = function(evt) {
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
    function loadAndRunImage(url) {
        var progress = document.getElementsByTagName("progress")[0];
        var rq = new XMLHttpRequest();
        rq.open('GET', url);
        rq.responseType = 'arraybuffer';
        rq.onprogress = function(e) {
            if (e.lengthComputable) progress.value = 100 * e.loaded / e.total;
        }
        rq.onload = function(e) {
            progress.style.display = "none";
            canvas.focus();
            var image = new users.bert.SqueakJS.vm.Image(rq.response, url);
            var vm = new users.bert.SqueakJS.vm.Interpreter(image, createDisplay());
            var run = function() {
                var ms = vm.interpret(20);
                if (typeof ms === 'number') { // continue running
                    window.setTimeout(run, ms);
                } else { // quit
                    canvas.style.webkitTransition = "-webkit-transform 0.5s";
                    canvas.style.webkitTransform = "scale(0)";
                    window.setTimeout(function(){canvas.style.display = 'none'}, 500);
                }
            };
            run();
        };
        rq.send();
    };
    loadAndRunImage('mini.image');
};

var addToHomeConfig = {touchIcon: true};
