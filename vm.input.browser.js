"use strict";
/*
 * Copyright (c) 2013-2024 Vanessa Freudenberg
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
'input', {
    primitiveClipboardText: function(argCount) {
        // There are two ways this primitive is invoked:
        // 1: via the DOM keyboard event thandler in squeak.js that intercepts cmd-c/cmd-v,
        //    reads/writes the system clipboard from/to display.clipboardString
        //    and then the interpreter calls the primitive
        // 2: via the image code e.g. a menu copy/paste item, which calls the primitive
        //    and we try to read/write the system clipboard directly.
        //    To support this, squeak.js keeps running the interpreter for 100 ms within
        //    the DOM event 'mouseup' handler so the code below runs in the click-handler context,
        //    (otherwise the browser would block access to the clipboard)
        if (argCount === 0) { // read from clipboard
            // Try to read from system clipboard, which is async if available.
            // It will likely fail outside of an event handler.
            var clipBoardPromise = null;
            if (this.display.readFromSystemClipboard) clipBoardPromise = this.display.readFromSystemClipboard();
            if (clipBoardPromise) {
                var unfreeze = this.vm.freeze();
                clipBoardPromise
                    .then(() => this.vm.popNandPush(1, this.makeStString(this.display.clipboardString)))
                    .catch(() => this.vm.popNandPush(1, this.vm.nilObj))
                    .finally(unfreeze);
            } else {
                if (typeof(this.display.clipboardString) !== 'string') return false;
                this.vm.popNandPush(1, this.makeStString(this.display.clipboardString));
            }
        } else if (argCount === 1) { // write to clipboard
            var stringObj = this.vm.top();
            if (stringObj.bytes) {
                this.display.clipboardString = stringObj.bytesAsString();
                this.display.clipboardStringChanged = true; // means it should be written to system clipboard
                if (this.display.writeToSystemClipboard) {
                    // no need to wait for the promise
                    this.display.writeToSystemClipboard();
                }
            }
            this.vm.pop();
        }
        return true;
    },
    primitiveKeyboardNext: function(argCount) {
        return this.popNandPushIfOK(argCount+1, this.ensureSmallInt(this.display.keys.shift()));
    },
    primitiveKeyboardPeek: function(argCount) {
        var length = this.display.keys.length;
        return this.popNandPushIfOK(argCount+1, length ? this.ensureSmallInt(this.display.keys[0] || 0) : this.vm.nilObj);
    },
    primitiveMouseButtons: function(argCount) {
        // only used in non-event based (old MVC) images
        this.popNandPushIfOK(argCount+1, this.ensureSmallInt(this.display.buttons));
        // if the image calls this primitive it means it's done displaying
        // we break out of the VM so the browser shows it quickly
        this.vm.breakOut();
        // if nothing was drawn but the image looks at the buttons rapidly,
        // it must be idle.
        if (this.display.idle++ > 20)
            this.vm.goIdle(); // might switch process, so must be after pop
        return true;
    },
    primitiveMousePoint: function(argCount) {
        var x = this.ensureSmallInt(this.display.mouseX),
            y = this.ensureSmallInt(this.display.mouseY);
        return this.popNandPushIfOK(argCount+1, this.makePointWithXandY(x, y));
    },
    primitiveInputSemaphore: function(argCount) {
        var semaIndex = this.stackInteger(0);
        if (!this.success) return false;
        this.inputEventSemaIndex = semaIndex;
        this.display.signalInputEvent = function() {
            this.signalSemaphoreWithIndex(this.inputEventSemaIndex);
        }.bind(this);
        this.display.signalInputEvent();
        return this.popNIfOK(argCount);
    },
    primitiveInputWord: function(argCount) {
        // Return an integer indicating the reason for the most recent input interrupt
        return this.popNandPushIfOK(1, 0);      // noop for now
    },
    primitiveGetNextEvent: function(argCount) {
        this.display.idle++;
        var evtBuf = this.stackNonInteger(0);
        if (!this.display.getNextEvent) return false;
        this.display.getNextEvent(evtBuf.pointers, this.vm.startupTime);
        return this.popNIfOK(argCount);
    },
});
