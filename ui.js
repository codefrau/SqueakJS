module('users.bert.SqueakJS.ui').requires("lively.data.FileUpload").toRun(function() {
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

lively.data.FileUpload.Handler.subclass('users.bert.SqueakJS.ui.ImageLoader', {
    handles: function(file) {
        return file.type == 'application/squeak-image' || file.name.match(/\.image$/);
    },
    getUploadSpec: function(evt, file) {
        return {readMethod: "asArrayBuffer"}
    },
    onLoad: function(evt) {
        console.log("Storing " + this.file.name);
        Squeak.filePut(this.file.name, evt.target.result);
        this.openImage(this.file.name, this.file.type, evt.target.result, this.pos);
    },
    openImage: function(name, mime, buffer, pos) {
        var morph = this.findSqueakMorph();
        if (morph) {
            morph.loadImageFromBuffer(buffer, name, function() {
                morph.run();
            });
        } else {
            alert("Please open a Squeak morph first");
        }
    },
    findSqueakMorph: function() {
        return $world.submorphs.detect(function(morph){return !!morph.loadImageFromBuffer});
    },
});

lively.data.FileUpload.Handler.subclass('users.bert.SqueakJS.ui.FileLoader', {
    handles: function(file) {
        return true;
    },
    getUploadSpec: function(evt, file) {
        return {readMethod: "asArrayBuffer"}
    },
    onLoad: function(evt) {
        console.log("Storing " + this.file.name);
        Squeak.filePut(this.file.name, evt.target.result);
    },
});

}) // end of module
