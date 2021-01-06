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
'input', {
    primitiveClipboardText: function(argCount) {
        if (argCount === 0) { // read from clipboard
            if (typeof(this.display.clipboardString) !== 'string') return false;
            this.vm.popNandPush(1, this.makeStString(this.display.clipboardString));
        } else if (argCount === 1) { // write to clipboard
            var stringObj = this.vm.top();
            if (stringObj.bytes) {
                this.display.clipboardString = stringObj.bytesAsString();
                this.display.clipboardStringChanged = true;
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
