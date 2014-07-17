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
// now for the good stuff
//////////////////////////////////////////////////////////////////////////////

var fullscreen = navigator.standalone;

window.onload = function() {
    var canvas = document.getElementsByTagName("canvas")[0];
    if (fullscreen) {
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
    var loop;
    function runImage(buffer, name) {
        window.clearTimeout(loop);
        canvas.width = canvas.width;
        canvas.focus();
        var image = new Squeak.Image(buffer, name);
        var vm = new Squeak.Interpreter(image, createDisplay());
        var run = function() {
            try {
                vm.interpret(20, function(ms) {
                    if (typeof ms === 'number') { // continue running
                        loop = window.setTimeout(run, ms);
                    } else { // quit
                        canvas.style.webkitTransition = "-webkit-transform 0.5s";
                        canvas.style.webkitTransform = "scale(0)";
                        window.setTimeout(function(){canvas.style.display = 'none'}, 500);
                    }
                });
            } catch(error) {
                console.error(error);
                alert(error);
            }
        };
        run();        
    };
    if (window.applicationCache) {
        applicationCache.addEventListener('updateready', function() {
            applicationCache.swapCache();
            if (confirm('SqueakJS has been updated. Restart now?')) {
                window.location.reload();
            }
        });
    }
    document.body.addEventListener('dragover', function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
        return false;
    });
    document.body.addEventListener('drop', function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        var files = evt.dataTransfer.files;
        for (var i = 0, f; f = files[i]; i++) {
            var reader = new FileReader();
            reader.onload = (function closure(f) {return function onload() {
                var buffer = this.result;
                if (/.*image$/.test(f.name)) {
                    runImage(buffer, f.name);
                } else if (confirm('Got file "' + f.name + '" (' + buffer.byteLength + ' bytes).\nStore for Squeak?')) {
                    Squeak.filePut(f.name, buffer);
                }
            }})(f);
            reader.readAsArrayBuffer(f);
        }
        return false;
    });
    function downloadImage(url) {
        var progress = document.getElementsByTagName("progress")[0];
        var rq = new XMLHttpRequest();
        rq.open('GET', url);
        rq.responseType = 'arraybuffer';
        rq.onprogress = function(e) {
            if (e.lengthComputable) progress.value = 100 * e.loaded / e.total;
        }
        rq.onload = function(e) {
            progress.style.display = "none";
            runImage(rq.response, url);
        };
        rq.send();
    };
    downloadImage('mini.image');
};

if (addToHomescreen.isStandalone)
    fullscreen = true;
else addToHomescreen({
   appID: 'squeakjs.demo.add2home',
});
