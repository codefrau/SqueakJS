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
    var canvas = document.getElementsByTagName("canvas")[0];
    if (fullscreen) {
        document.body.style.margin = 0;
        document.body.style.backgroundColor = 'black';
        ['h1','p','div'].forEach(function(n){document.getElementsByTagName(n)[0].style.display="none"});
        var scale = screen.width / canvas.width;
        var head = document.getElementsByTagName("head")[0];
        head.innerHTML += '<meta name="viewport" content="initial-scale=' + scale + '">';
    } else {
        canvas.style.width = "80%";
    }
    var display = this.createSqueakDisplay(canvas);
    function loadAndRunImage(url) {
        var imageName = Squeak.splitFilePath(url).basename;
        display.showBanner("Downloading " + imageName);
        var progress = document.getElementsByTagName("progress")[0];
        var rq = new XMLHttpRequest();
        rq.open('GET', url);
        rq.responseType = 'arraybuffer';
        rq.onprogress = function(e) {
            if (e.lengthComputable) progress.value = 100 * e.loaded / e.total;
        }
        rq.onload = function(e) {
            progress.style.display = "none";
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
                                canvas.style.webkitTransition = "-webkit-transform 0.5s";
                                canvas.style.webkitTransform = "scale(0)";
                                window.setTimeout(function(){
									canvas.style.display = 'none';
									// When come from Sugarizer, go back home
									if (typeof(Storage)!=="undefined" && typeof(window.localStorage)!=="undefined") {
										try {
											if (window.localStorage.getItem('sugar_settings') !== null)
												window.location = "../../index.html";
										} catch(err) {
										}
									}									
								}, 500);
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
