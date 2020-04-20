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

Object.extend(Squeak,
"known classes", {
    // BitBlt layout:
    BitBlt_dest: 0,
    BitBlt_source: 1,
    BitBlt_halftone: 2,
    BitBlt_combinationRule: 3,
    BitBlt_destX: 4,
    BitBlt_destY: 5,
    BitBlt_width: 6,
    BitBlt_height: 7,
    BitBlt_sourceX: 8,
    BitBlt_sourceY: 9,
    BitBlt_clipX: 10,
    BitBlt_clipY: 11,
    BitBlt_clipW: 12,
    BitBlt_clipH: 13,
    BitBlt_colorMap: 14,
    BitBlt_warpBase: 15,
    // Form layout:
    Form_bits: 0,
    Form_width: 1,
    Form_height: 2,
    Form_depth: 3,
    Form_offset: 4,
});

Object.extend(Squeak.Primitives.prototype,
'display', {
    displayDirty: function() {},
});
