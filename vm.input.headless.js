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

// Fake input primitives for headless usage
// Most primitives simply fail, some require answering a value to keep images working
Object.extend(Squeak.Primitives.prototype,
'input', {
	primitiveMouseButtons: function() { return false; },
	primitiveMousePoint: function() { return false; },
	primitiveKeyboardNext: function() { return false; },
	primitiveKeyboardPeek: function() { return false; },
	primitiveInputSemaphore: function(argCount) {
		this.vm.popNandPush(argCount + 1, this.vm.nilObj);
		return true;
	},
	primitiveInputWord: function() { return false; },
	primitiveGetNextEvent: function() { return false; },
	primitiveBeep: function() { return false; },
	primitiveClipboardText: function() { return false; },
});
