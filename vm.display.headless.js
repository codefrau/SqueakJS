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

// Fake display primitives for headless usage in node
// Most primitives simply fail, some require answering a value to keep images working
Object.extend(Squeak.Primitives.prototype,
'display', {
	primitiveScreenSize: function() { return false; },
	primitiveScreenDepth: function() { return false; },
	primitiveTestDisplayDepth: function() { return false; },
	primitiveBeDisplay: function(argCount) {
		this.vm.popN(argCount);	// Answer self
		return true;
	},
	primitiveReverseDisplay: function() { return false; },
	primitiveDeferDisplayUpdates: function() { return false; },
	primitiveForceDisplayUpdate: function() { return false; },
	primitiveScanCharacters: function() { return false; },
	primitiveSetFullScreen: function() { return false; },
	primitiveShowDisplayRect: function() { return false; },
	primitiveBeCursor: function(argCount) {
		this.vm.popN(argCount);	// Answer self
		return true;
	},
});
