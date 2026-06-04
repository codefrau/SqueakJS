"use strict";
/*
 * ve-core.js — a faithful JavaScript port of the *fill* path of Cuis Smalltalk's
 * VectorEnginePlugin (sub-pixel anti-aliasing analytic rasterizer by Juan Vuletich).
 *
 * Ported method-for-method from:
 *   Cuis-Smalltalk-Dev/Packages/Features/VectorEnginePlugin.pck.st
 * following the C (`cCode:`) branches. Operates on plain typed arrays — no Squeak
 * VM needed — so we can prove the algorithm runs natively in the browser and measure
 * its speed independently of SqueakJS.
 *
 * Scope: the geometry + fill pipeline (transform, line/quadratic/cubic flattening,
 * coverage accumulation, and blendFillOnly). Stroke and text are intentionally out of
 * scope for this validation; they reuse the very same primitives.
 *
 * Array indexing note: the Smalltalk source uses 1-based `at:`. This port keeps the
 * exact index arithmetic but treats the typed arrays as 0-based throughout — the
 * algorithm is internally consistent (it reads and writes the same indices), so the
 * rendered result is identical.
 */

function VectorEngineCore() {
    // ---- state (mirrors the plugin instance variables) ----
    this.targetBits = null;   // Uint32Array, 0xAARRGGBB per pixel
    this.morphIds = null;     // Uint32Array
    this.edgeCounts = null;   // Uint32Array (3x 8-bit winding counts packed R/G/B)
    this.alphaMask = null;    // Uint32Array (3x 7-bit edge AA coverage packed)
    this.contour = null;      // Float32Array, 2 per scanline (left,right)
    this.targetWidth = 0;
    this.targetHeight = 0;

    this.antiAliasingWidth = 1.0;
    this.subPixelDelta = 0.0;
    this.hop = 0.75;
    this.strokeWidth = 0.0;
    this.strokeR = this.strokeG = this.strokeB = 0.0; this.strokeA = 0.0;
    this.fillR = this.fillG = this.fillB = 0.0; this.fillA = 1.0;

    this.txA11 = 1; this.txA12 = 0; this.txA13 = 0;
    this.txA21 = 0; this.txA22 = 1; this.txA23 = 0;

    this.currentMorphId = 0;
    this.currentClipsSubmorphs = false;
    this.clipCurrentMorph = false;
    this.clipLeft = 0; this.clipTop = 0; this.clipRight = 0; this.clipBottom = 0;

    this.auxAntiAliasingWidthScaledInverse = 127.0;
    this.auxStrokeWidthDilatedHalf = 0.5;
    this.auxStrokeWidthDilatedHalfSquared = 0.25;
    this.auxStrokeWidthErodedHalfSquared = 0.25;

    this.spanLeft = 0; this.spanTop = 0; this.spanRight = 0; this.spanBottom = 0;
    this.prevYTruncated = 0x7FFFFFFF;
    this.prevYRounded = 0x7FFFFFFF;
    this.leftAtThisY = 0; this.rightAtThisY = 0;
}

VectorEngineCore.prototype = {

    // ---------- accessors ----------
    setTarget: function(targetBits, morphIds, edgeCounts, alphaMask, contour, w, h) {
        this.targetBits = targetBits; this.morphIds = morphIds;
        this.edgeCounts = edgeCounts; this.alphaMask = alphaMask; this.contour = contour;
        this.targetWidth = w; this.targetHeight = h;
        this.clipLeft = 0; this.clipTop = 0; this.clipRight = w - 1; this.clipBottom = h - 1;
    },
    antiAliasingWidthSubPixelDeltaHopLength: function(aa, spd, hopLen) {
        this.antiAliasingWidth = aa;
        this.auxAntiAliasingWidthScaledInverse = 127.0 / aa;
        this.subPixelDelta = spd;
        this.hop = hopLen;
    },
    fillRGBA: function(r, g, b, a) { this.fillR = r*255.0; this.fillG = g*255.0; this.fillB = b*255.0; this.fillA = a; },
    strokeRGBA: function(r, g, b, a) { this.strokeR = r*255.0; this.strokeG = g*255.0; this.strokeB = b*255.0; this.strokeA = a; },
    setStrokeWidth: function(w) {
        this.strokeWidth = w;
        this.auxStrokeWidthDilatedHalf = (w + this.antiAliasingWidth) * 0.5;
        this.auxStrokeWidthDilatedHalfSquared = this.auxStrokeWidthDilatedHalf * this.auxStrokeWidthDilatedHalf;
        var swErodedHalf = (w - this.antiAliasingWidth) * 0.5;
        this.auxStrokeWidthErodedHalfSquared = swErodedHalf * Math.abs(swErodedHalf);
    },
    geometryTx: function(a11,a12,a13,a21,a22,a23) {
        this.txA11=a11; this.txA12=a12; this.txA13=a13; this.txA21=a21; this.txA22=a22; this.txA23=a23;
    },
    setClip: function(l,t,r,b) { this.clipLeft=l; this.clipTop=t; this.clipRight=r; this.clipBottom=b; },
    currentMorph: function(id, clipsSubmorphs) {
        this.currentMorphId = id;
        if (id === 0) this.clipCurrentMorph = false;
        this.currentClipsSubmorphs = clipsSubmorphs;
    },
    initializePath: function() {
        this.spanLeft = this.targetWidth; this.spanTop = this.targetHeight;
        this.spanRight = 0; this.spanBottom = 0;
        this.prevYRounded = 0x7FFFFFFF;
    },
    initializeTrajectoryFragment: function() { this.prevYTruncated = 0x7FFFFFFF; },
    newTrajectoryFragment: function() { this.initializeTrajectoryFragment(); },
    resetContour: function(t, b) {
        this.leftAtThisY = this.targetWidth; this.rightAtThisY = 0;
        for (var y = t; y <= b; y++) { this.contour[y*2] = this.targetWidth; this.contour[y*2+1] = 0; }
    },
    // span getters (integer pixel bounds, dilated by stroke half-width + AA)
    spanLeftPx:   function() { return (this.spanLeft - this.auxStrokeWidthDilatedHalf - this.subPixelDelta + 1) | 0; },
    spanRightPx:  function() { return ((this.spanRight + this.auxStrokeWidthDilatedHalf + this.subPixelDelta) | 0) + 1; },
    spanTopPx:    function() { return (this.spanTop - this.auxStrokeWidthDilatedHalf + 1) | 0; },
    spanBottomPx: function() { return (this.spanBottom + this.auxStrokeWidthDilatedHalf) | 0; },

    // ---------- path flattening ----------
    pvt_lineFromXY: function(xFrom, yFrom, xTo, yTo) {
        var txFrom = xFrom*this.txA11 + yFrom*this.txA12 + this.txA13;
        var tyFrom = xFrom*this.txA21 + yFrom*this.txA22 + this.txA23;
        var txTo = xTo*this.txA11 + yTo*this.txA12 + this.txA13;
        var tyTo = xTo*this.txA21 + yTo*this.txA22 + this.txA23;
        var dx = Math.abs(txTo-txFrom), dy = Math.abs(tyTo-tyFrom);
        var hops = ((Math.max(dx,dy)/this.hop)|0) + 1;
        if (txFrom < txTo) { if (txFrom<this.spanLeft) this.spanLeft=txFrom; if (txTo>this.spanRight) this.spanRight=txTo; }
        else { if (txTo<this.spanLeft) this.spanLeft=txTo; if (txFrom>this.spanRight) this.spanRight=txFrom; }
        if (tyFrom < tyTo) { if (tyFrom<this.spanTop) this.spanTop=tyFrom; if (tyTo>this.spanBottom) this.spanBottom=tyTo; }
        else { if (tyTo<this.spanTop) this.spanTop=tyTo; if (tyFrom>this.spanBottom) this.spanBottom=tyFrom; }
        var t = 0.0, increment = 1.0/hops, x, y, oneLessT;
        while (t < 1.0) {
            oneLessT = 1.0 - t;
            x = oneLessT*txFrom + t*txTo;
            y = oneLessT*tyFrom + t*tyTo;
            this.updateAlphas(x, y);
            if (this.fillA !== 0.0) this.updateEdgeCount(x, y);
            this.updateContour(x, y);
            t += increment;
        }
        this.updateAlphas(txTo, tyTo);
        if (this.fillA !== 0.0) this.updateEdgeCount(txTo, tyTo);
        this.updateContour(txTo, tyTo);
    },
    pvt_quadraticBezierFromXY: function(xFrom,yFrom,xTo,yTo,xControl,yControl) {
        if ((xControl===xTo && yControl===yTo) || (xControl===xFrom && yControl===yFrom))
            return this.pvt_lineFromXY(xFrom,yFrom,xTo,yTo);
        var txFrom = xFrom*this.txA11+yFrom*this.txA12+this.txA13, tyFrom = xFrom*this.txA21+yFrom*this.txA22+this.txA23;
        var txTo = xTo*this.txA11+yTo*this.txA12+this.txA13, tyTo = xTo*this.txA21+yTo*this.txA22+this.txA23;
        var txControl = xControl*this.txA11+yControl*this.txA12+this.txA13, tyControl = xControl*this.txA21+yControl*this.txA22+this.txA23;
        var dx = Math.abs(txTo-txFrom), dx2 = Math.abs(txControl-txFrom);
        var dy = Math.abs(tyTo-tyFrom), dy2 = Math.abs(tyControl-tyFrom);
        if (dx < 1.0 && dx2 < 1.0) return this.pvt_lineFromXY(xFrom,yFrom,xTo,yTo);
        if (dy < 1.0 && dy2 < 1.0) return this.pvt_lineFromXY(xFrom,yFrom,xTo,yTo);
        var xMinEnd = Math.min(txFrom,txTo), xMaxEnd = Math.max(txFrom,txTo);
        var yMinEnd = Math.min(tyFrom,tyTo), yMaxEnd = Math.max(tyFrom,tyTo);
        this.spanLeft = Math.min(this.spanLeft, Math.min(xMinEnd, (xMinEnd+txControl)/2.0));
        this.spanRight = Math.max(this.spanRight, Math.max(xMaxEnd, (xMaxEnd+txControl)/2.0));
        this.spanTop = Math.min(this.spanTop, Math.min(yMinEnd, (yMinEnd+tyControl)/2.0));
        this.spanBottom = Math.max(this.spanBottom, Math.max(yMaxEnd, (yMaxEnd+tyControl)/2.0));
        var x = txFrom, y = tyFrom;
        this.updateAlphas(x,y); if (this.fillA!==0.0) this.updateEdgeCount(x,y); this.updateContour(x,y);
        var increment = Math.min(0.5/Math.max(dx,dy), 0.5), t = 0.0, t0,x0,y0,oneLessT,f1,f2,f3,len,correction;
        do {
            t0=t; x0=x; y0=y;
            t = t0+increment; oneLessT = 1.0-t;
            f1=oneLessT*oneLessT; f2=2.0*oneLessT*t; f3=t*t;
            x = f1*txFrom + f2*txControl + f3*txTo; y = f1*tyFrom + f2*tyControl + f3*tyTo;
            dx=x-x0; dy=y-y0; len=Math.sqrt(dx*dx+dy*dy); correction=this.hop/len;
            do {
                increment = increment/len*this.hop;
                t = t0+increment; oneLessT=1.0-t;
                f1=oneLessT*oneLessT; f2=2.0*oneLessT*t; f3=t*t;
                x = f1*txFrom + f2*txControl + f3*txTo; y = f1*tyFrom + f2*tyControl + f3*tyTo;
                dx=x-x0; dy=y-y0; len=Math.sqrt(dx*dx+dy*dy); correction=this.hop/len;
            } while (correction < 1.0);
            if (t < 1.0) {
                this.updateAlphas(x,y); if (this.fillA!==0.0) this.updateEdgeCount(x,y); this.updateContour(x,y);
            }
        } while (t < 1.0);
        this.updateAlphas(txTo,tyTo); if (this.fillA!==0.0) this.updateEdgeCount(txTo,tyTo); this.updateContour(txTo,tyTo);
    },
    pvt_cubicBezierFromXY: function(xFrom,yFrom,xTo,yTo,xC1,yC1,xC2,yC2) {
        var txFrom=xFrom*this.txA11+yFrom*this.txA12+this.txA13, tyFrom=xFrom*this.txA21+yFrom*this.txA22+this.txA23;
        var txTo=xTo*this.txA11+yTo*this.txA12+this.txA13, tyTo=xTo*this.txA21+yTo*this.txA22+this.txA23;
        var txC1=xC1*this.txA11+yC1*this.txA12+this.txA13, tyC1=xC1*this.txA21+yC1*this.txA22+this.txA23;
        var txC2=xC2*this.txA11+yC2*this.txA12+this.txA13, tyC2=xC2*this.txA21+yC2*this.txA22+this.txA23;
        var dx=Math.abs(txC1-txFrom), dx2=Math.abs(txTo-txC2), dx3=Math.abs(txC2-txC1);
        var dy=Math.abs(tyC1-tyFrom), dy2=Math.abs(tyTo-tyC2), dy3=Math.abs(tyC2-tyC1);
        dx = Math.max(Math.max(dx,dx2)*3, dx3*1.5);
        dy = Math.max(Math.max(dy,dy2)*3, dy3*1.5);
        var hops = ((Math.max(dx,dy)/this.hop)|0) + 1;
        var xMinEnd=Math.min(txFrom,txTo), xMaxEnd=Math.max(txFrom,txTo);
        var yMinEnd=Math.min(tyFrom,tyTo), yMaxEnd=Math.max(tyFrom,tyTo);
        this.spanLeft = Math.min(this.spanLeft, Math.min(xMinEnd, xMinEnd*0.25 + Math.min(txC1,txC2)*0.75));
        this.spanRight = Math.max(this.spanRight, Math.max(xMaxEnd, xMaxEnd*0.25 + Math.max(txC1,txC2)*0.75));
        this.spanTop = Math.min(this.spanTop, Math.min(yMinEnd, yMinEnd*0.25 + Math.min(tyC1,tyC2)*0.75));
        this.spanBottom = Math.max(this.spanBottom, Math.max(yMaxEnd, yMaxEnd*0.25 + Math.max(tyC1,tyC2)*0.75));
        var t=0.0, increment=1.0/hops, oneLessT,f1,f23,f2,f3,f4,x,y;
        while (t < 1.0) {
            oneLessT=1.0-t;
            f1=oneLessT*oneLessT*oneLessT; f23=3.0*oneLessT*t; f2=f23*oneLessT; f3=f23*t; f4=t*t*t;
            x = f1*txFrom + f2*txC1 + f3*txC2 + f4*txTo;
            y = f1*tyFrom + f2*tyC1 + f3*tyC2 + f4*tyTo;
            this.updateAlphas(x,y); if (this.fillA!==0.0) this.updateEdgeCount(x,y); this.updateContour(x,y);
            t += increment;
        }
        this.updateAlphas(txTo,tyTo); if (this.fillA!==0.0) this.updateEdgeCount(txTo,tyTo); this.updateContour(txTo,tyTo);
    },

    // ---------- coverage accumulation ----------
    updateAlphas: function(x, y) {
        var t = (y - this.auxStrokeWidthDilatedHalf + 1)|0; if (t < this.clipTop) t = this.clipTop;
        var b = (y + this.auxStrokeWidthDilatedHalf)|0; if (b > this.clipBottom) b = this.clipBottom;
        var l = (x - this.auxStrokeWidthDilatedHalf - this.subPixelDelta + 1)|0; if (l < this.clipLeft) l = this.clipLeft;
        var r = (x + this.auxStrokeWidthDilatedHalf + this.subPixelDelta)|0; if (r > this.clipRight) r = this.clipRight;
        var W=this.targetWidth, am=this.alphaMask, spd=this.subPixelDelta;
        var dilHalf=this.auxStrokeWidthDilatedHalf, dilHalfSq=this.auxStrokeWidthDilatedHalfSquared;
        var erHalfSq=this.auxStrokeWidthErodedHalfSquared, aaInv=this.auxAntiAliasingWidthScaledInverse;
        for (var displayY = t; displayY <= b; displayY++) {
            var pixelIndex = displayY*W + l - 1;
            var dy = displayY - y, dySquared = dy*dy;
            for (var displayX = l; displayX <= r; displayX++) {
                pixelIndex++;
                var alphaWord = am[pixelIndex];
                if (alphaWord === 0x007F7F7F) continue;
                var redAlpha = alphaWord & 0x7F0000, greenAlpha = alphaWord & 0x7F00, blueAlpha = alphaWord & 0x7F;
                var doUpdate = false, dx = displayX - x, dxp, dist, cand;
                // Red
                dxp = dx - spd; dist = dxp*dxp + dySquared;
                if (dist < dilHalfSq) {
                    if (dist <= erHalfSq) cand = 0x7F0000;
                    else cand = (((dilHalf - Math.sqrt(dist))*aaInv)>>>0) << 16;
                    if (cand > redAlpha) { doUpdate = true; redAlpha = cand; }
                }
                // Green
                dist = dx*dx + dySquared;
                if (dist < dilHalfSq) {
                    if (dist <= erHalfSq) cand = 0x7F00;
                    else cand = (((dilHalf - Math.sqrt(dist))*aaInv)>>>0) << 8;
                    if (cand > greenAlpha) { doUpdate = true; greenAlpha = cand; }
                }
                // Blue
                dxp = dx + spd; dist = dxp*dxp + dySquared;
                if (dist < dilHalfSq) {
                    if (dist <= erHalfSq) cand = 0x7F;
                    else cand = ((dilHalf - Math.sqrt(dist))*aaInv)>>>0;
                    if (cand > blueAlpha) { doUpdate = true; blueAlpha = cand; }
                }
                if (doUpdate) am[pixelIndex] = (redAlpha | greenAlpha) | blueAlpha;
            }
        }
    },
    updateContour: function(x, y) {
        var thisYRounded = (y + 0.5)|0;
        if (thisYRounded >= 0 && thisYRounded <= this.targetHeight-1) {
            if (thisYRounded !== this.prevYRounded) {
                if (this.prevYRounded !== 0x7FFFFFFF) {
                    this.contour[this.prevYRounded*2] = this.leftAtThisY;
                    this.contour[this.prevYRounded*2+1] = this.rightAtThisY;
                }
                this.leftAtThisY = this.contour[thisYRounded*2];
                this.rightAtThisY = this.contour[thisYRounded*2+1];
                this.prevYRounded = thisYRounded;
            }
            if (x < this.leftAtThisY) this.leftAtThisY = x;
            if (x > this.rightAtThisY) this.rightAtThisY = x;
        }
    },
    updateContourLastLine: function() {
        if (this.prevYRounded !== 0x7FFFFFFF) {
            this.contour[this.prevYRounded*2] = this.leftAtThisY;
            this.contour[this.prevYRounded*2+1] = this.rightAtThisY;
        }
    },
    updateEdgeCount: function(x, y) {
        var thisYTruncated = y|0;
        if (thisYTruncated === this.prevYTruncated) return;
        if (!(thisYTruncated >= this.clipTop-1 && thisYTruncated <= this.clipBottom)) return;
        if (this.prevYTruncated === 0x7FFFFFFF) { this.prevYTruncated = thisYTruncated; return; }
        var pixelY, redInc, greenInc, blueInc;
        if (thisYTruncated > this.prevYTruncated) { pixelY = thisYTruncated; redInc=0x010000; greenInc=0x0100; blueInc=0x01; }
        else { pixelY = this.prevYTruncated; redInc=0xFF0000; greenInc=0xFF00; blueInc=0xFF; }
        this.prevYTruncated = thisYTruncated;
        var ec = this.edgeCounts, W = this.targetWidth, spd = this.subPixelDelta, cl = this.clipLeft, cr = this.clipRight;
        var base = pixelY*W;
        var redOffset = Math.max((x+spd+1)|0, cl);
        var greenOffset = Math.max((x+1)|0, cl);
        var blueOffset = Math.max((x-spd+1)|0, cl);
        var rIdx = base+redOffset, gIdx = base+greenOffset, bIdx = base+blueOffset;
        var cw, rc, gc, bc, rest;
        if (rIdx === bIdx) {
            if (redOffset <= cr) {
                cw = ec[rIdx];
                rc = (cw+redInc)&0xFF0000; gc = (cw+greenInc)&0xFF00; bc = (cw+blueInc)&0xFF;
                ec[rIdx] = (rc|gc)|bc;
            }
        } else if (rIdx === gIdx) {
            if (redOffset <= cr) { cw=ec[rIdx]; rc=(cw+redInc)&0xFF0000; gc=(cw+greenInc)&0xFF00; rest=cw&0xFF; ec[rIdx]=(rc|gc)|rest; }
            if (blueOffset <= cr) { cw=ec[bIdx]; rest=cw&0xFFFF00; bc=(cw+blueInc)&0xFF; ec[bIdx]=rest|bc; }
        } else {
            if (redOffset <= cr) { cw=ec[rIdx]; rc=(cw+redInc)&0xFF0000; rest=cw&0xFFFF; ec[rIdx]=rc|rest; }
            if (blueOffset <= cr) { cw=ec[bIdx]; rest=cw&0xFF0000; gc=(cw+greenInc)&0xFF00; bc=(cw+blueInc)&0xFF; ec[bIdx]=(rest|gc)|bc; }
        }
    },

    // ---------- blend fill over background ----------
    blendFillOnly: function(l, t, r, b) {
        var W=this.targetWidth, ec=this.edgeCounts, am=this.alphaMask;
        for (var displayY = t; displayY <= b; displayY++) {
            var eR=0, eG=0, eB=0;
            var pixelIndex = displayY*W + l - 1;
            for (var displayX = l; displayX <= r; displayX++) {
                pixelIndex++;
                var ew = ec[pixelIndex];
                if (ew !== 0) ec[pixelIndex] = 0;
                // 8-bit wraparound counts, signed
                var er = (ew & 0xFF0000) >>> 16; if (er > 127) er -= 256;
                var eg = (ew & 0xFF00) >>> 8;    if (eg > 127) eg -= 256;
                var eb = (ew & 0xFF);            if (eb > 127) eb -= 256;
                eR = (eR + er) & 0xFF; eG = (eG + eg) & 0xFF; eB = (eB + eb) & 0xFF;
                var isR = (eR << 24) !== 0, isG = (eG << 24) !== 0, isB = (eB << 24) !== 0; // nonzero as int8
                var aaw = am[pixelIndex];
                if (aaw !== 0) am[pixelIndex] = 0;
                if (aaw !== 0 || isR || isG || isB)
                    this.blendFillOnlyAt(pixelIndex, isR, isG, isB, aaw);
            }
        }
    },
    blendFillOnlyAt: function(pixelIndex, isRedInside, isGreenInside, isBlueInside, antiAliasAlphasWord) {
        var aRBits = antiAliasAlphasWord & 0x7F0000, aGBits = antiAliasAlphasWord & 0x7F00, aBBits = antiAliasAlphasWord & 0x7F;
        if (isRedInside) aRBits = 0x7F0000 - aRBits;
        if (isGreenInside) aGBits = 0x7F00 - aGBits;
        if (isBlueInside) aBBits = 0x7F - aBBits;
        var alphaR = (aRBits * (1.0/(127.0*256*256))) * this.fillA;
        var alphaG = (aGBits * (1.0/(127.0*256))) * this.fillA;
        var alphaB = (aBBits * (1.0/127.0)) * this.fillA;
        var clippingAntiAliasBits = 0, morphIdWord;
        if (this.currentClipsSubmorphs) {
            morphIdWord = this.morphIds[pixelIndex];
            clippingAntiAliasBits = morphIdWord & 0x7F;
            var shifted = aGBits >>> 8;
            if (shifted > clippingAntiAliasBits) clippingAntiAliasBits = shifted;
        } else if (this.clipCurrentMorph) {
            morphIdWord = this.morphIds[pixelIndex];
            clippingAntiAliasBits = morphIdWord & 0x7F;
            var caa = clippingAntiAliasBits * (1.0/127.0);
            alphaR *= caa; alphaG *= caa; alphaB *= caa;
        }
        if (alphaR + alphaG + alphaB === 0.0) return;
        var targetWord = this.targetBits[pixelIndex];
        var resultAlphaBits = targetWord & 0xFF000000;
        var resultRBits = targetWord & 0xFF0000, resultGBits = targetWord & 0xFF00, resultBBits = targetWord & 0xFF;
        var targetAlpha = (resultAlphaBits>>>0) * (1.0/(255.0*256*256*256));
        var unAlpha, resultAlpha, resultC;
        if (alphaR !== 0.0) {
            unAlpha = 1.0-alphaR; resultAlpha = alphaR + unAlpha*targetAlpha;
            resultC = alphaR*this.fillR + (unAlpha*(resultRBits>>>16))*targetAlpha;
            resultRBits = ((resultC/resultAlpha + 0.5)>>>0) << 16;
        }
        if (alphaG !== 0.0) {
            unAlpha = 1.0-alphaG; resultAlpha = alphaG + unAlpha*targetAlpha;
            resultC = alphaG*this.fillG + (unAlpha*(resultGBits>>>8))*targetAlpha;
            resultGBits = ((resultC/resultAlpha + 0.5)>>>0) << 8;
            resultAlphaBits = ((resultAlpha*255.0 + 0.5)>>>0) << 24;
        }
        if (alphaB !== 0.0) {
            unAlpha = 1.0-alphaB; resultAlpha = alphaB + unAlpha*targetAlpha;
            resultC = alphaB*this.fillB + (unAlpha*resultBBits)*targetAlpha;
            resultBBits = (resultC/resultAlpha + 0.5)>>>0;
        }
        this.targetBits[pixelIndex] = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
        this.morphIds[pixelIndex] = ((this.currentMorphId << 8) + clippingAntiAliasBits) >>> 0;
    },

    // ---------- blend stroke (+ fill) over background ----------
    blendStrokeAndFill: function(l, t, r, b) {
        var W=this.targetWidth, ec=this.edgeCounts, am=this.alphaMask;
        for (var displayY = t; displayY <= b; displayY++) {
            var eR=0, eG=0, eB=0;
            var pixelIndex = displayY*W + l - 1;
            for (var displayX = l; displayX <= r; displayX++) {
                pixelIndex++;
                var ew = ec[pixelIndex];
                if (ew !== 0) ec[pixelIndex] = 0;
                var er = (ew & 0xFF0000) >>> 16; if (er > 127) er -= 256;
                var eg = (ew & 0xFF00) >>> 8;    if (eg > 127) eg -= 256;
                var eb = (ew & 0xFF);            if (eb > 127) eb -= 256;
                eR = (eR + er) & 0xFF; eG = (eG + eg) & 0xFF; eB = (eB + eb) & 0xFF;
                var aaw = am[pixelIndex];
                if (aaw !== 0) am[pixelIndex] = 0;
                if (aaw !== 0 || eR !== 0 || eG !== 0 || eB !== 0)
                    this.blendStrokeAndFillAt(pixelIndex, eR!==0, eG!==0, eB!==0, aaw);
            }
        }
    },
    blendStrokeAndFillAt: function(pixelIndex, isRedInside, isGreenInside, isBlueInside, antiAliasAlphasWord) {
        var aRBits = antiAliasAlphasWord & 0x7F0000, aGBits = antiAliasAlphasWord & 0x7F00, aBBits = antiAliasAlphasWord & 0x7F;
        var aRA = aRBits * (1.0/(127.0*256*256)), aGA = aGBits * (1.0/(127.0*256)), aBA = aBBits * (1.0/127.0);
        var alphaR, alphaG, alphaB, foreR, foreG, foreB;
        if (isRedInside)   { alphaR = aRA*this.strokeA + (1.0-aRA)*this.fillA; foreR = aRA*this.strokeR + (1.0-aRA)*this.fillR; }
        else               { alphaR = aRA*this.strokeA; foreR = this.strokeR; }
        if (isGreenInside) { alphaG = aGA*this.strokeA + (1.0-aGA)*this.fillA; foreG = aGA*this.strokeG + (1.0-aGA)*this.fillG; }
        else               { alphaG = aGA*this.strokeA; foreG = this.strokeG; }
        if (isBlueInside)  { alphaB = aBA*this.strokeA + (1.0-aBA)*this.fillA; foreB = aBA*this.strokeB + (1.0-aBA)*this.fillB; }
        else               { alphaB = aBA*this.strokeA; foreB = this.strokeB; }
        var clippingAntiAliasBits = 0, morphIdWord;
        if (this.currentClipsSubmorphs) {
            if (isGreenInside) clippingAntiAliasBits = 0x7F;
            else {
                morphIdWord = this.morphIds[pixelIndex]; clippingAntiAliasBits = morphIdWord & 0x7F;
                var shifted = aGBits >>> 8; if (shifted > clippingAntiAliasBits) clippingAntiAliasBits = shifted;
            }
        } else if (this.clipCurrentMorph) {
            morphIdWord = this.morphIds[pixelIndex]; clippingAntiAliasBits = morphIdWord & 0x7F;
            var caa = clippingAntiAliasBits * (1.0/127.0); alphaR*=caa; alphaG*=caa; alphaB*=caa;
        }
        if (alphaR + alphaG + alphaB === 0.0) return;
        this.composite(pixelIndex, alphaR, alphaG, alphaB, foreR, foreG, foreB, clippingAntiAliasBits);
    },
    blendStrokeOnly: function(l, t, r, b) {
        var W=this.targetWidth, am=this.alphaMask;
        for (var displayY = t; displayY <= b; displayY++) {
            var pixelIndex = displayY*W + l - 1;
            for (var displayX = l; displayX <= r; displayX++) {
                pixelIndex++;
                var aaw = am[pixelIndex];
                if (aaw !== 0) { am[pixelIndex] = 0; this.blendStrokeOnlyAt(pixelIndex, aaw); }
            }
        }
    },
    blendStrokeOnlyAt: function(pixelIndex, antiAliasAlphasWord) {
        var aRA = (antiAliasAlphasWord & 0x7F0000) * (1.0/(127.0*256*256));
        var aGA = (antiAliasAlphasWord & 0x7F00) * (1.0/(127.0*256));
        var aBA = (antiAliasAlphasWord & 0x7F) * (1.0/127.0);
        var alphaR = aRA*this.strokeA, alphaG = aGA*this.strokeA, alphaB = aBA*this.strokeA;
        var clippingAntiAliasBits = 0, morphIdWord;
        if (this.currentClipsSubmorphs) {
            morphIdWord = this.morphIds[pixelIndex]; clippingAntiAliasBits = morphIdWord & 0x7F;
            var shifted = (antiAliasAlphasWord & 0x7F00) >>> 8; if (shifted > clippingAntiAliasBits) clippingAntiAliasBits = shifted;
        } else if (this.clipCurrentMorph) {
            morphIdWord = this.morphIds[pixelIndex]; clippingAntiAliasBits = morphIdWord & 0x7F;
            var caa = clippingAntiAliasBits * (1.0/127.0); alphaR*=caa; alphaG*=caa; alphaB*=caa;
        }
        if (alphaR + alphaG + alphaB === 0.0) return;
        this.composite(pixelIndex, alphaR, alphaG, alphaB, this.strokeR, this.strokeG, this.strokeB, clippingAntiAliasBits);
    },
    // shared per-channel "over" compositing with correct target translucency
    composite: function(pixelIndex, alphaR, alphaG, alphaB, foreR, foreG, foreB, clippingAntiAliasBits) {
        var targetWord = this.targetBits[pixelIndex];
        var resultAlphaBits = targetWord & 0xFF000000;
        var resultRBits = targetWord & 0xFF0000, resultGBits = targetWord & 0xFF00, resultBBits = targetWord & 0xFF;
        var targetAlpha = (resultAlphaBits>>>0) * (1.0/(255.0*256*256*256));
        var unAlpha, resultAlpha, resultC;
        if (alphaR !== 0.0) {
            unAlpha = 1.0-alphaR; resultAlpha = alphaR + unAlpha*targetAlpha;
            resultC = alphaR*foreR + (unAlpha*(resultRBits>>>16))*targetAlpha;
            resultRBits = ((resultC/resultAlpha + 0.5)>>>0) << 16;
        }
        if (alphaG !== 0.0) {
            unAlpha = 1.0-alphaG; resultAlpha = alphaG + unAlpha*targetAlpha;
            resultC = alphaG*foreG + (unAlpha*(resultGBits>>>8))*targetAlpha;
            resultGBits = ((resultC/resultAlpha + 0.5)>>>0) << 8;
            resultAlphaBits = ((resultAlpha*255.0 + 0.5)>>>0) << 24;
        }
        if (alphaB !== 0.0) {
            unAlpha = 1.0-alphaB; resultAlpha = alphaB + unAlpha*targetAlpha;
            resultC = alphaB*foreB + (unAlpha*resultBBits)*targetAlpha;
            resultBBits = (resultC/resultAlpha + 0.5)>>>0;
        }
        this.targetBits[pixelIndex] = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
        this.morphIds[pixelIndex] = ((this.currentMorphId << 8) + clippingAntiAliasBits) >>> 0;
    },
};

if (typeof module === "object" && module.exports) module.exports = VectorEngineCore;
