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
    var display = createSqueakDisplay(sqCanvas, {fixedWidth: 1200, fixedHeight: 900, fullscreen: fullscreen, header: sqHeader, footer: sqFooter});
    function loadAndRunImage(url) {
        var imageName = Squeak.splitFilePath(url).basename;
        display.showBanner("Downloading " + imageName);
        var rq = new XMLHttpRequest();
        rq.open('GET', url);
        rq.responseType = 'arraybuffer';
        rq.onprogress = function(e) {
            if (e.lengthComputable) display.showProgress(e.loaded / e.total);
        }
        rq.onload = function(e) {
            display.showBanner("Initializing, please wait");
            window.setTimeout(function(){
                var image = new Squeak.Image(rq.response, imageName);
                var vm = new Squeak.Interpreter(image, display);
                display.clear();
                var run = function() {
                    try {
                        vm.interpret(20, function(ms) {
                            if (typeof ms === 'number') { // continue running
                                window.setTimeout(run, ms);
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
        rq.send();
    };
    loadAndRunImage('http://freudenbergs.de/bert/squeakjs/etoys.image');
};

if (addToHomescreen.isStandalone)
    fullscreen = true;
else addToHomescreen({
    appID: 'squeakjs.etoys.add2home',
});
