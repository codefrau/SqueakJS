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

window.stopVM = false;

window.onload = function() {

    // Wrap the file close primitive to stop after the benchmark
    // output file has been written
    var origFileClose = Squeak.Primitives.prototype.fileClose
    Squeak.Primitives.prototype.fileClose = (function (file) {
        var contents = Squeak.bytesAsString(new Uint8Array(file.contents.buffer));
        var r = document.getElementById("results");
        r.innerHTML = "Your machine: " + navigator.userAgent + "<br>" +
            "Your results:<br>" + contents.replace(/\r/g, "<br>") + "<br>"
        saveToLively(contents);
        window.stopVM = true;
        return origFileClose.apply(this, arguments);
    });

    if (!Date.now) {
        Date.now = function now() {
            return new Date().getTime();
        };
    }

    function saveToLively(contents) {
        var address = (window.google && 
            google.loader &&
            google.loader.ClientLocation &&
            google.loader.ClientLocation.address) || {city: "unknown city", country: "unknown country"};
        contents = navigator.userAgent + "\n" +
            address.city + "\n" +
            address.country + "\n" +
            Date.now() + "\n" +
            Squeak.vmVersion + "\n" +
            contents;
        var oReq = new XMLHttpRequest();
        oReq.open(
            "get",
            "http://www.lively-kernel.org/babelsberg/nodejs/SqueakJSServer/?benchmarkResults=" +
                encodeURIComponent(contents),
            true);
        oReq.send();
    };

    var canvas = document.getElementsByTagName("canvas")[0],
        display = createSqueakDisplay(canvas);

    function loadAndRunImage(url) {
        var rq = new XMLHttpRequest();
        rq.open('GET', url);
        rq.responseType = 'arraybuffer';
        rq.onload = function(e) {
            var image = new Squeak.Image(rq.response, url);
            var vm = new Squeak.Interpreter(image, display);
            var run = function() {
                try {
                    vm.interpret(200, function(ms) {
                        if (!window.stopVM && (typeof ms === 'number')) { // continue running
                            window.setTimeout(run, ms);
                        } else { // quit
                            canvas.style.display = 'none';
                        }
                    });
                } catch(error) {
                    console.error(error);
                    alert(error);
                }
            };
            run();
        };
        rq.send();
    };
    loadAndRunImage('benchmark.image');
};
