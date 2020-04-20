"use strict";
/*
 * Copyright (c) 2013-2020 Vanessa Freudenberg
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

Object.extend(Squeak.Primitives.prototype,
'ScratchPluginAdditions', {
    // methods not handled by generated ScratchPlugin
    scratch_primitiveOpenURL: function(argCount) {
        var url = this.stackNonInteger(0).bytesAsString();
        if (url == "") return false;
        if (/^\/SqueakJS\//.test(url)) {
            url = url.slice(10);     // remove file root
            var path = Squeak.splitFilePath(url),
                template = Squeak.Settings["squeak-template:" + path.dirname];
            if (template) url = JSON.parse(template).url + "/" + path.basename;
        }
        window.open(url, "_blank"); // likely blocked as pop-up, but what can we do?
        return this.popNIfOK(argCount);
    },
    scratch_primitiveGetFolderPath: function(argCount) {
        var index = this.stackInteger(0);
        if (!this.success) return false;
        var path;
        switch (index) {
            case 1: path = '/'; break;              // home dir
            // case 2: path = '/desktop'; break;    // desktop
            // case 3: path = '/documents'; break;  // documents
            // case 4: path = '/pictures'; break;   // my pictures
            // case 5: path = '/music'; break;      // my music
        }
        if (!path) return false;
        this.vm.popNandPush(argCount + 1, this.makeStString(this.filenameToSqueak(path)));
        return true;
    },
});
