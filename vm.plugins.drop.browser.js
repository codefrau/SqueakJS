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
'DropPlugin', {
    primitiveDropRequestFileHandle: function(argCount) {
        var index = this.stackInteger(0),
            fileNames = this.display.droppedFiles || [];
        if (index < 1 || index > fileNames.length) return false;
        // same code as primitiveFileOpen()
        var fileName = fileNames[index - 1],
            file = this.fileOpen(fileName, false);
        if (!file) return false;
        var handle = this.makeFileHandle(fileName, file, false);
        this.popNandPushIfOK(argCount+1, handle);
        return true;
    },
    primitiveDropRequestFileName: function(argCount) {
        var index = this.stackInteger(0),
            fileNames = this.display.droppedFiles || [];
        if (index < 1 || index > fileNames.length) return false;
        var result = this.makeStString(this.filenameToSqueak(fileNames[index - 1]));
        return this.popNandPushIfOK(argCount+1, result);
    },
});
