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
'Obsolete', {
    primitiveFloatArrayAt: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAt", argCount);
    },
    primitiveFloatArrayMulFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveMulFloatArray", argCount);
    },
    primitiveFloatArrayAddScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAddScalar", argCount);
    },
    primitiveFloatArrayDivFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDivFloatArray", argCount);
    },
    primitiveFloatArrayDivScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDivScalar", argCount);
    },
    primitiveFloatArrayHash: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveHash", argCount);
    },
    primitiveFloatArrayAtPut: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAtPut", argCount);
    },
    primitiveFloatArrayMulScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveMulScalar", argCount);
    },
    primitiveFloatArrayAddFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveAddFloatArray", argCount);
    },
    primitiveFloatArraySubScalar: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveSubScalar", argCount);
    },
    primitiveFloatArraySubFloatArray: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveSubFloatArray", argCount);
    },
    primitiveFloatArrayEqual: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveEqual", argCount);
    },
    primitiveFloatArrayDotProduct: function(argCount) {
        return this.namedPrimitive("FloatArrayPlugin", "primitiveDotProduct", argCount);
    },
    m23PrimitiveInvertRectInto: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveInvertRectInto", argCount);
    },
    m23PrimitiveTransformPoint: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveTransformPoint", argCount);
    },
    m23PrimitiveIsPureTranslation: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveIsPureTranslation", argCount);
    },
    m23PrimitiveComposeMatrix: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveComposeMatrix", argCount);
    },
    m23PrimitiveTransformRectInto: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveTransformRectInto", argCount);
    },
    m23PrimitiveIsIdentity: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveIsIdentity", argCount);
    },
    m23PrimitiveInvertPoint: function(argCount) {
        return this.namedPrimitive("Matrix2x3Plugin", "primitiveInvertPoint", argCount);
    },
    primitiveDeflateBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveDeflateBlock", argCount);
    },
    primitiveDeflateUpdateHashTable: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveDeflateUpdateHashTable", argCount);
    },
    primitiveUpdateGZipCrc32: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveUpdateGZipCrc32", argCount);
    },
    primitiveInflateDecompressBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveInflateDecompressBlock", argCount);
    },
    primitiveZipSendBlock: function(argCount) {
        return this.namedPrimitive("ZipPlugin", "primitiveZipSendBlock", argCount);
    },
    primitiveFFTTransformData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTTransformData", argCount);
    },
    primitiveFFTScaleData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTScaleData", argCount);
    },
    primitiveFFTPermuteData: function(argCount) {
        return this.namedPrimitive("FFTPlugin", "primitiveFFTPermuteData", argCount);
    },
    gePrimitiveMergeFillFrom: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveMergeFillFrom", argCount);
    },
    gePrimitiveCopyBuffer: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveCopyBuffer", argCount);
    },
    gePrimitiveAddRect: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddRect", argCount);
    },
    gePrimitiveAddGradientFill: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddGradientFill", argCount);
    },
    gePrimitiveSetClipRect: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveSetClipRect", argCount);
    },
    gePrimitiveSetBitBltPlugin: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveSetBitBltPlugin", argCount);
    },
    gePrimitiveRegisterExternalEdge: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveRegisterExternalEdge", argCount);
    },
    gePrimitiveGetClipRect: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveGetClipRect", argCount);
    },
    gePrimitiveAddBezier: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddBezier", argCount);
    },
    gePrimitiveInitializeProcessing: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveInitializeProcessing", argCount);
    },
    gePrimitiveRenderImage: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveRenderImage", argCount);
    },
    gePrimitiveGetOffset: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveGetOffset", argCount);
    },
    gePrimitiveSetDepth: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveSetDepth", argCount);
    },
    gePrimitiveAddBezierShape: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddBezierShape", argCount);
    },
    gePrimitiveSetEdgeTransform: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveSetEdgeTransform", argCount);
    },
    gePrimitiveGetTimes: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveGetTimes", argCount);
    },
    gePrimitiveNextActiveEdgeEntry: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveNextActiveEdgeEntry", argCount);
    },
    gePrimitiveAddBitmapFill: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddBitmapFill", argCount);
    },
    gePrimitiveGetDepth: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveGetDepth", argCount);
    },
    gePrimitiveAbortProcessing: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAbortProcessing", argCount);
    },
    gePrimitiveNextGlobalEdgeEntry: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveNextGlobalEdgeEntry", argCount);
    },
    gePrimitiveGetFailureReason: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveGetFailureReason", argCount);
    },
    gePrimitiveDisplaySpanBuffer: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveDisplaySpanBuffer", argCount);
    },
    gePrimitiveGetCounts: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveGetCounts", argCount);
    },
    gePrimitiveChangedActiveEdgeEntry: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveChangedActiveEdgeEntry", argCount);
    },
    gePrimitiveRenderScanline: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveRenderScanline", argCount);
    },
    gePrimitiveGetBezierStats: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveGetBezierStats", argCount);
    },
    gePrimitiveFinishedProcessing: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveFinishedProcessing", argCount);
    },
    gePrimitiveNeedsFlush: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveNeedsFlush", argCount);
    },
    gePrimitiveAddLine: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddLine", argCount);
    },
    gePrimitiveSetOffset: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveSetOffset", argCount);
    },
    gePrimitiveNextFillEntry: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveNextFillEntry", argCount);
    },
    gePrimitiveInitializeBuffer: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveInitializeBuffer", argCount);
    },
    gePrimitiveDoProfileStats: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveDoProfileStats", argCount);
    },
    gePrimitiveAddActiveEdgeEntry: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddActiveEdgeEntry", argCount);
    },
    gePrimitiveSetAALevel: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveSetAALevel", argCount);
    },
    gePrimitiveNeedsFlushPut: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveNeedsFlushPut", argCount);
    },
    gePrimitiveAddCompressedShape: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddCompressedShape", argCount);
    },
    gePrimitiveSetColorTransform: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveSetColorTransform", argCount);
    },
    gePrimitiveAddOval: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddOval", argCount);
    },
    gePrimitiveRegisterExternalFill: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveRegisterExternalFill", argCount);
    },
    gePrimitiveAddPolygon: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveAddPolygon", argCount);
    },
    gePrimitiveGetAALevel: function(argCount) {
        return this.namedPrimitive("B2DPlugin", "primitiveGetAALevel", argCount);
    },
});
