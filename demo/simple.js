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


var fullscreen = navigator.standalone;

window.onload = function() {
    if (fullscreen) {
        document.body.style.margin = 0;
        document.body.style.backgroundColor = 'black';
        sqHeader.style.display = 'none';
        sqFooter.style.display = 'none';
    }
    var display = createSqueakDisplay(sqCanvas, {fullscreen: fullscreen, header: sqHeader, footer: sqFooter, swapButtons: true});
    var loop;
    function runImage(buffer, name) {
        window.clearTimeout(loop);
        display.clear();
        display.showBanner("Initializing, please wait");
        window.setTimeout(function() {
            var image = new Squeak.Image(buffer, name);
            var vm = new Squeak.Interpreter(image, display);
            display.clear();
            function run() {
                try {
                    vm.interpret(20, function(ms) {
                        if (typeof ms === 'number') { // continue running
                            loop = window.setTimeout(run, ms);
                        } else { // quit
                            sqCanvas.style.webkitTransition = "-webkit-transform 0.5s";
                            sqCanvas.style.webkitTransform = "scale(0)";
                            window.setTimeout(function(){sqCanvas.style.display = 'none'}, 500);
                        }
                    });
                } catch(error) {
                    console.error(error);
                    alert(error);
                }
            };
            run();
        }, 0);
    };
    document.body.addEventListener('dragover', function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
        return false;
    });
    document.body.addEventListener('drop', function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        var files = evt.dataTransfer.files,
            names = [];
        for (var i = 0, f; f = files[i]; i++)
            names.push(f.name);
        display.showBanner("Loading " + names.join(', '));
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
        display.showBanner("Downloading " + url);
        var rq = new XMLHttpRequest();
        rq.open('GET', url);
        rq.responseType = 'arraybuffer';
        rq.onprogress = function(e) {
            if (e.lengthComputable) display.showProgress(e.loaded / e.total);
        }
        rq.onload = function(e) {
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
