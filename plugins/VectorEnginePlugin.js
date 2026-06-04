"use strict";
/*
 * VectorEnginePlugin.js — a SqueakJS port of Cuis Smalltalk's VectorEnginePlugin
 * (sub-pixel anti-aliasing analytic vector rasterizer by Juan Vuletich).
 *
 * Ported method-for-method from the generated C of the **plugin API v7**:
 *   OpenSmalltalk-vm/src/plugins/VectorEnginePlugin/VectorEnginePlugin.c
 *   (VectorEnginePlugin-jmv.26, pluginApiVersion = 7)
 *
 * Implements both the SubPixel and WholePixel (…WP) primitive sets. Cuis 7.9 drives the
 * main Display through the WholePixel engine, so the WP path carries the C optimizations:
 *   - `affectedBits` 16-pixel "dirty segment" skip in the blend loops,
 *   - the opaque-fill fast-path (direct color write when targetAssumedOpaque & fillA=1),
 *   - the dedicated zero-stroke 2x2 text path (updateAlphasWPZeroStroke).
 * Per-scanline clipping (primSetClippingSpec) and clip-edge anti-aliasing are honored.
 *
 * Remaining simplification: the SubPixel blend loops still scan the full [l..r] span
 * (pixel-identical output, just not affectedBits-accelerated); SubPixel is only used for
 * small off-screen glyph caches, so it isn't on the hot path.
 *
 * Squeak arrays are 0-based typed arrays here; the C uses 0-based pointer indexing, so the
 * index arithmetic is copied verbatim.
 */

function VectorEnginePlugin() {

  var ip = null;               // interpreterProxy

  // ---- engine state (mirrors the C module globals) ----
  var targetBits=null, morphIds=null, edgeCounts=null, alphaMask=null, contour=null;
  var edgeCountsWP=null, alphaMaskWP=null;   // whole-pixel engine: 8-bit ByteArray coverage
  var affectedBits=null;       // 1 byte per 16 pixels: "this 16-px segment was touched" (blend-skip)
  var wpMode=false;            // true when Cuis' WholePixel engine is active (vs SubPixel)
  var clippingSpec=null;       // Int32Array of 2*height [left,right] per scanline, or null
  var targetWidth=0, targetHeight=0, targetAssumedOpaque=0;
  var antiAliasingWidth=1, auxAAInv=127, subPixelDelta=0, hop=0.75, strokeWidth=0;
  var auxDilHalf=0.5, auxDilHalfSq=0.25, auxErHalfSq=0.25;
  var strokeR=0,strokeG=0,strokeB=0,strokeA=0, fillR=0,fillG=0,fillB=0,fillA=1;
  var txA11=1,txA12=0,txA13=0, txA21=0,txA22=1,txA23=0;
  var currentMorphId=0;
  var clipLeft=0, clipTop=0, clipRight=0, clipBottom=0;
  var spanLeft=0, spanTop=0, spanRight=0, spanBottom=0;
  var prevYTruncated=0x7FFFFFFF, prevYRounded=0x7FFFFFFF, leftAtThisY=0, rightAtThisY=0;
  // dashed strokes
  var dashedStrokeBits=0, dashBitCount=0, dashBitLength=0.0, dashBitOffset=0, trajectoryLength=0.0;

  // ===== path flattening =====
  function pvt_line(xFrom,yFrom,xTo,yTo) {
    var tfx=xFrom*txA11+yFrom*txA12+txA13, tfy=xFrom*txA21+yFrom*txA22+txA23;
    var ttx=xTo*txA11+yTo*txA12+txA13,     tty=xTo*txA21+yTo*txA22+txA23;
    var dx=Math.abs(ttx-tfx), dy=Math.abs(tty-tfy);
    var hops=((Math.max(dx,dy)/hop)|0)+1;
    if (tfx<ttx){ if(tfx<spanLeft)spanLeft=tfx; if(ttx>spanRight)spanRight=ttx; } else { if(ttx<spanLeft)spanLeft=ttx; if(tfx>spanRight)spanRight=tfx; }
    if (tfy<tty){ if(tfy<spanTop)spanTop=tfy; if(tty>spanBottom)spanBottom=tty; } else { if(tty<spanTop)spanTop=tty; if(tfy>spanBottom)spanBottom=tfy; }
    var t=0.0, inc=1.0/hops, x,y,o;
    while (t<1.0){ o=1.0-t; x=o*tfx+t*ttx; y=o*tfy+t*tty; updateAlphas(x,y); if(fillA!==0.0)updateEdgeCount(x,y); updateContour(x,y); t+=inc; }
    updateAlphas(ttx,tty); if(fillA!==0.0)updateEdgeCount(ttx,tty); updateContour(ttx,tty);
  }
  function pvt_quad(xFrom,yFrom,xTo,yTo,xC,yC) {
    if ((xC===xTo&&yC===yTo)||(xC===xFrom&&yC===yFrom)) return pvt_line(xFrom,yFrom,xTo,yTo);
    var tfx=xFrom*txA11+yFrom*txA12+txA13, tfy=xFrom*txA21+yFrom*txA22+txA23;
    var ttx=xTo*txA11+yTo*txA12+txA13,     tty=xTo*txA21+yTo*txA22+txA23;
    var tcx=xC*txA11+yC*txA12+txA13,       tcy=xC*txA21+yC*txA22+txA23;
    var dx=Math.abs(ttx-tfx), dx2=Math.abs(tcx-tfx), dy=Math.abs(tty-tfy), dy2=Math.abs(tcy-tfy);
    if (dx<1.0&&dx2<1.0) return pvt_line(xFrom,yFrom,xTo,yTo);
    if (dy<1.0&&dy2<1.0) return pvt_line(xFrom,yFrom,xTo,yTo);
    var xMin=Math.min(tfx,ttx),xMax=Math.max(tfx,ttx),yMin=Math.min(tfy,tty),yMax=Math.max(tfy,tty);
    spanLeft=Math.min(spanLeft,Math.min(xMin,(xMin+tcx)/2.0)); spanRight=Math.max(spanRight,Math.max(xMax,(xMax+tcx)/2.0));
    spanTop=Math.min(spanTop,Math.min(yMin,(yMin+tcy)/2.0)); spanBottom=Math.max(spanBottom,Math.max(yMax,(yMax+tcy)/2.0));
    var x=tfx,y=tfy; updateAlphas(x,y); if(fillA!==0.0)updateEdgeCount(x,y); updateContour(x,y);
    var inc=Math.min(0.5/Math.max(dx,dy),0.5), t=0.0,t0,x0,y0,o,f1,f2,f3,len;
    do {
      t0=t;x0=x;y0=y; t=t0+inc;o=1.0-t; f1=o*o;f2=2.0*o*t;f3=t*t;
      x=f1*tfx+f2*tcx+f3*ttx; y=f1*tfy+f2*tcy+f3*tty; dx=x-x0;dy=y-y0; len=Math.sqrt(dx*dx+dy*dy);
      do { inc=inc/len*hop; t=t0+inc;o=1.0-t; f1=o*o;f2=2.0*o*t;f3=t*t;
        x=f1*tfx+f2*tcx+f3*ttx; y=f1*tfy+f2*tcy+f3*tty; dx=x-x0;dy=y-y0; len=Math.sqrt(dx*dx+dy*dy);
      } while (hop/len < 1.0);
      if (t<1.0){ updateAlphas(x,y); if(fillA!==0.0)updateEdgeCount(x,y); updateContour(x,y); }
    } while (t<1.0);
    updateAlphas(ttx,tty); if(fillA!==0.0)updateEdgeCount(ttx,tty); updateContour(ttx,tty);
  }
  function pvt_cubic(xFrom,yFrom,xTo,yTo,xC1,yC1,xC2,yC2) {
    var tfx=xFrom*txA11+yFrom*txA12+txA13, tfy=xFrom*txA21+yFrom*txA22+txA23;
    var ttx=xTo*txA11+yTo*txA12+txA13,     tty=xTo*txA21+yTo*txA22+txA23;
    var c1x=xC1*txA11+yC1*txA12+txA13, c1y=xC1*txA21+yC1*txA22+txA23;
    var c2x=xC2*txA11+yC2*txA12+txA13, c2y=xC2*txA21+yC2*txA22+txA23;
    var dx=Math.abs(c1x-tfx),dx2=Math.abs(ttx-c2x),dx3=Math.abs(c2x-c1x);
    var dy=Math.abs(c1y-tfy),dy2=Math.abs(tty-c2y),dy3=Math.abs(c2y-c1y);
    dx=Math.max(Math.max(dx,dx2)*3,dx3*1.5); dy=Math.max(Math.max(dy,dy2)*3,dy3*1.5);
    var hops=((Math.max(dx,dy)/hop)|0)+1;
    var xMin=Math.min(tfx,ttx),xMax=Math.max(tfx,ttx),yMin=Math.min(tfy,tty),yMax=Math.max(tfy,tty);
    spanLeft=Math.min(spanLeft,Math.min(xMin,xMin*0.25+Math.min(c1x,c2x)*0.75));
    spanRight=Math.max(spanRight,Math.max(xMax,xMax*0.25+Math.max(c1x,c2x)*0.75));
    spanTop=Math.min(spanTop,Math.min(yMin,yMin*0.25+Math.min(c1y,c2y)*0.75));
    spanBottom=Math.max(spanBottom,Math.max(yMax,yMax*0.25+Math.max(c1y,c2y)*0.75));
    var t=0.0,inc=1.0/hops,o,f1,f23,f2,f3,f4,x,y;
    while (t<1.0){ o=1.0-t; f1=o*o*o; f23=3.0*o*t; f2=f23*o; f3=f23*t; f4=t*t*t;
      x=f1*tfx+f2*c1x+f3*c2x+f4*ttx; y=f1*tfy+f2*c1y+f3*c2y+f4*tty;
      updateAlphas(x,y); if(fillA!==0.0)updateEdgeCount(x,y); updateContour(x,y); t+=inc; }
    updateAlphas(ttx,tty); if(fillA!==0.0)updateEdgeCount(ttx,tty); updateContour(ttx,tty);
  }

  function arcImpl(cX,cY,rX,rY,start,sweep,rc,rs) {
    var tcx=cX*txA11+cY*txA12+txA13, tcy=cX*txA21+cY*txA22+txA23;
    var scale=Math.sqrt(txA11*txA11+txA21*txA21), trx=rX*scale, try_=rY*scale;
    var hops=((Math.max(trx,try_)*Math.abs(sweep)/hop)|0)+2, d=hops;
    for (var h=0; h<=hops; h++){
      var ang=(h/d)*sweep+start, xp=Math.cos(ang)*trx, yp=Math.sin(ang)*try_;
      var x=rc*xp-rs*yp+tcx, y=rs*xp+rc*yp+tcy;
      if(x<spanLeft)spanLeft=x; if(y<spanTop)spanTop=y; if(x>spanRight)spanRight=x; if(y>spanBottom)spanBottom=y;
      updateAlphas(x,y); if(fillA!==0.0)updateEdgeCount(x,y); updateContour(x,y);
    }
  }

  // ===== coverage accumulation =====
  function updateAlphas(x,y) {
    if (wpMode) return updateAlphasWP(x,y);
    if (dashBitLength !== 0.0) {
      trajectoryLength += hop;
      var bit = (((trajectoryLength/dashBitLength)|0) + dashBitOffset) % dashBitCount;
      if (!(dashedStrokeBits & (1 << ((dashBitCount-bit)-1)))) return;
    }
    var t=((y-auxDilHalf)+1)|0; if(t<clipTop)t=clipTop;
    var b=(y+auxDilHalf)|0; if(b>clipBottom)b=clipBottom;
    var l=(((x-auxDilHalf)-subPixelDelta)+1)|0; if(l<clipLeft)l=clipLeft;
    var r=((x+auxDilHalf)+subPixelDelta)|0; if(r>clipRight)r=clipRight;
    for (var displayY=t; displayY<=b; displayY++) {
      var pi=(displayY*targetWidth+l)-1, dy=displayY-y, dySq=dy*dy;
      for (var displayX=l; displayX<=r; displayX++) {
        pi++;
        var aw=alphaMask[pi];
        if (aw===0x7F7F7F) continue;
        var dx=displayX-x, redA=aw&0x7F0000, grnA=aw&0x7F00, bluA=aw&0x7F, upd=false, dxp, dist, cand;
        dxp=dx-subPixelDelta; dist=dxp*dxp+dySq;
        if (dist<auxDilHalfSq){ cand=(((auxDilHalf-Math.sqrt(dist))*auxAAInv)|0)<<16; if(cand>redA){upd=true; redA=cand<0x7F0000?cand:0x7F0000;} }
        dist=dx*dx+dySq;
        if (dist<auxDilHalfSq){ cand=(((auxDilHalf-Math.sqrt(dist))*auxAAInv)|0)<<8; if(cand>grnA){upd=true; grnA=cand<0x7F00?cand:0x7F00;} }
        dxp=dx+subPixelDelta; dist=dxp*dxp+dySq;
        if (dist<auxDilHalfSq){ cand=((auxDilHalf-Math.sqrt(dist))*auxAAInv)|0; if(cand>bluA){upd=true; bluA=cand<0x7F?cand:0x7F;} }
        if (upd) alphaMask[pi]=(redA|grnA)|bluA;
      }
    }
  }
  function updateContour(x,y) {
    var yr=(y+0.5)|0;
    if (yr>=0 && yr<=targetHeight-1) {
      if (yr!==prevYRounded) {
        if (prevYRounded!==0x7FFFFFFF){ contour[prevYRounded*2]=leftAtThisY; contour[prevYRounded*2+1]=rightAtThisY; }
        leftAtThisY=contour[yr*2]; rightAtThisY=contour[yr*2+1]; prevYRounded=yr;
      }
      if (x<leftAtThisY)leftAtThisY=x; if (x>rightAtThisY)rightAtThisY=x;
    }
  }
  function updateEdgeCount(x,y) {
    if (wpMode) return updateEdgeCountWP(x,y);
    var yt=y|0;
    if (yt===prevYTruncated) return;
    if (!(yt>=clipTop-1 && yt<=clipBottom)) return;
    if (prevYTruncated===0x7FFFFFFF){ prevYTruncated=yt; return; }
    var pixelY, rInc,gInc,bInc;
    if (yt>prevYTruncated){ pixelY=yt; rInc=0x010000;gInc=0x0100;bInc=0x01; } else { pixelY=prevYTruncated; rInc=0xFF0000;gInc=0xFF00;bInc=0xFF; }
    prevYTruncated=yt;
    var base=pixelY*targetWidth;
    var rOff=Math.max((x+subPixelDelta+1)|0,clipLeft), gOff=Math.max((x+1)|0,clipLeft), bOff=Math.max((x-subPixelDelta+1)|0,clipLeft);
    var rIdx=base+rOff, gIdx=base+gOff, bIdx=base+bOff, cw,rc,gc,bc,rest;
    if (rIdx===bIdx){ if(rOff<=clipRight){ cw=edgeCounts[rIdx]; rc=(cw+rInc)&0xFF0000;gc=(cw+gInc)&0xFF00;bc=(cw+bInc)&0xFF; edgeCounts[rIdx]=(rc|gc)|bc; } }
    else if (rIdx===gIdx){
      if(rOff<=clipRight){ cw=edgeCounts[rIdx]; rc=(cw+rInc)&0xFF0000;gc=(cw+gInc)&0xFF00;rest=cw&0xFF; edgeCounts[rIdx]=(rc|gc)|rest; }
      if(bOff<=clipRight){ cw=edgeCounts[bIdx]; rest=cw&0xFFFF00;bc=(cw+bInc)&0xFF; edgeCounts[bIdx]=rest|bc; }
    } else {
      if(rOff<=clipRight){ cw=edgeCounts[rIdx]; rc=(cw+rInc)&0xFF0000;rest=cw&0xFFFF; edgeCounts[rIdx]=rc|rest; }
      if(bOff<=clipRight){ cw=edgeCounts[bIdx]; rest=cw&0xFF0000;gc=(cw+gInc)&0xFF00;bc=(cw+bInc)&0xFF; edgeCounts[bIdx]=(rest|gc)|bc; }
    }
  }

  // ===== blend loops (full-span; honors clippingSpec) =====
  function clipSpanL(y){ return clippingSpec ? clippingSpec[y*2] : 0; }
  function clipSpanR(y){ return clippingSpec ? clippingSpec[y*2+1] : targetWidth-1; }

  function blendFillOnly(l,t,r,b) {
    for (var dY=t; dY<=b; dY++) {
      var eR=0,eG=0,eB=0, csL=clipSpanL(dY), csR=clipSpanR(dY);
      var pi=dY*targetWidth+l-1;
      for (var dX=l; dX<=r; dX++) {
        pi++;
        var ew=edgeCounts[pi]; if(ew!==0)edgeCounts[pi]=0;
        var er=(ew&0xFF0000)>>>16; if(er>127)er-=256;
        var eg=(ew&0xFF00)>>>8; if(eg>127)eg-=256;
        var eb=(ew&0xFF); if(eb>127)eb-=256;
        eR=(eR+er)&0xFF; eG=(eG+eg)&0xFF; eB=(eB+eb)&0xFF;
        var aw=alphaMask[pi]; if(aw!==0)alphaMask[pi]=0;
        if (dX<csL||dX>csR) continue;
        if (aw!==0 || eR!==0 || eG!==0 || eB!==0)
          blendFillOnlyAt(pi, eR!==0, eG!==0, eB!==0, aw);
      }
    }
  }
  function blendStrokeAndFill(l,t,r,b) {
    for (var dY=t; dY<=b; dY++) {
      var eR=0,eG=0,eB=0, csL=clipSpanL(dY), csR=clipSpanR(dY);
      var pi=dY*targetWidth+l-1;
      for (var dX=l; dX<=r; dX++) {
        pi++;
        var ew=edgeCounts[pi]; if(ew!==0)edgeCounts[pi]=0;
        var er=(ew&0xFF0000)>>>16; if(er>127)er-=256;
        var eg=(ew&0xFF00)>>>8; if(eg>127)eg-=256;
        var eb=(ew&0xFF); if(eb>127)eb-=256;
        eR=(eR+er)&0xFF; eG=(eG+eg)&0xFF; eB=(eB+eb)&0xFF;
        var aw=alphaMask[pi]; if(aw!==0)alphaMask[pi]=0;
        if (dX<csL||dX>csR) continue;
        if (aw!==0 || eR!==0 || eG!==0 || eB!==0)
          blendStrokeAndFillAt(pi, eR!==0, eG!==0, eB!==0, aw);
      }
    }
  }
  function blendStrokeOnly(l,t,r,b) {
    for (var dY=t; dY<=b; dY++) {
      var csL=clipSpanL(dY), csR=clipSpanR(dY), pi=dY*targetWidth+l-1;
      for (var dX=l; dX<=r; dX++) {
        pi++;
        var aw=alphaMask[pi];
        if (aw!==0){ alphaMask[pi]=0; if(dX>=csL&&dX<=csR) blendStrokeOnlyAt(pi, aw); }
      }
    }
  }

  // ===== per-pixel "over" compositing (v7: no submorph-clip; morphIds = currentMorphId) =====
  function composite(pi, alphaR,alphaG,alphaB, foreR,foreG,foreB) {
    if (alphaR+alphaG+alphaB===0.0) return;
    var tw=targetBits[pi];
    var aBits=tw&0xFF000000, rBits=tw&0xFF0000, gBits=tw&0xFF00, bBits=tw&0xFF;
    var tA=(aBits>>>0)*(1.0/(255.0*256*256*256)), un,ra,rc;
    if (alphaR!==0.0){ un=1.0-alphaR; ra=alphaR+un*tA; rc=alphaR*foreR+(un*(rBits>>>16))*tA; rBits=((rc/ra+0.5)>>>0)<<16; }
    if (alphaG!==0.0){ un=1.0-alphaG; ra=alphaG+un*tA; rc=alphaG*foreG+(un*(gBits>>>8))*tA; gBits=((rc/ra+0.5)>>>0)<<8; aBits=((ra*255.0+0.5)>>>0)<<24; }
    if (alphaB!==0.0){ un=1.0-alphaB; ra=alphaB+un*tA; rc=alphaB*foreB+(un*bBits)*tA; bBits=(rc/ra+0.5)>>>0; }
    targetBits[pi]=(((aBits|rBits)|gBits)|bBits)>>>0;
    morphIds[pi]=currentMorphId>>>0;
  }
  function blendFillOnlyAt(pi, isR,isG,isB, aaw) {
    var aR=aaw&0x7F0000, aG=aaw&0x7F00, aB=aaw&0x7F;
    if(isR)aR=0x7F0000-aR; if(isG)aG=0x7F00-aG; if(isB)aB=0x7F-aB;
    composite(pi, aR*(1.0/8323072.0)*fillA, aG*(1.0/32512.0)*fillA, aB*(1.0/127.0)*fillA, fillR,fillG,fillB);
  }
  function blendStrokeAndFillAt(pi, isR,isG,isB, aaw) {
    var aRA=(aaw&0x7F0000)*(1.0/8323072.0), aGA=(aaw&0x7F00)*(1.0/32512.0), aBA=(aaw&0x7F)*(1.0/127.0);
    var alphaR,alphaG,alphaB,foreR,foreG,foreB;
    if(isR){alphaR=aRA*strokeA+(1.0-aRA)*fillA; foreR=aRA*strokeR+(1.0-aRA)*fillR;} else {alphaR=aRA*strokeA; foreR=strokeR;}
    if(isG){alphaG=aGA*strokeA+(1.0-aGA)*fillA; foreG=aGA*strokeG+(1.0-aGA)*fillG;} else {alphaG=aGA*strokeA; foreG=strokeG;}
    if(isB){alphaB=aBA*strokeA+(1.0-aBA)*fillA; foreB=aBA*strokeB+(1.0-aBA)*fillB;} else {alphaB=aBA*strokeA; foreB=strokeB;}
    composite(pi, alphaR,alphaG,alphaB, foreR,foreG,foreB);
  }
  function blendStrokeOnlyAt(pi, aaw) {
    composite(pi, (aaw&0x7F0000)*(1.0/8323072.0)*strokeA, (aaw&0x7F00)*(1.0/32512.0)*strokeA, (aaw&0x7F)*(1.0/127.0)*strokeA, strokeR,strokeG,strokeB);
  }

  // ===== WholePixel (single 8-bit channel) coverage + blend =====
  // Optimized path used by Cuis for text/fills: strokeWidth 0, AA 1.6. Processes the 2x2
  // cell around the pen point (matches C's updateAlphasWPZeroStroke exactly — the earlier
  // general-bbox approximation lost AA pixels at integer coords, causing crunchy glyphs).
  function updateAlphasWPZeroStroke(x,y) {
    var t=y|0, b=t+1, l=x|0, r=l+1;
    if(t<clipTop)t=clipTop; if(b>clipBottom)b=clipBottom; if(l<clipLeft)l=clipLeft; if(r>clipRight)r=clipRight;
    for (var dY=t; dY<=b; dY++) {
      var dy=dY-y, dySq=dy*dy, pi=dY*targetWidth+l-1;
      for (var dX=l; dX<=r; dX++) {
        pi++;
        var dx=dX-x, dist=dx*dx+dySq;
        if (dist < auxDilHalfSq) {
          var ab=alphaMaskWP[pi];
          if (ab !== 0x7F) {
            var cand=((auxDilHalf-Math.sqrt(dist))*auxAAInv)|0;
            if (cand>ab) { alphaMaskWP[pi]=cand; affectedBits[pi>>4]=1; }
          }
        }
      }
    }
  }
  function updateAlphasWP(x,y) {
    if (strokeWidth===0.0 && Math.abs(antiAliasingWidth-1.6)<1e-6) return updateAlphasWPZeroStroke(x,y);
    if (dashBitLength !== 0.0) {
      trajectoryLength += hop;
      var bit = (((trajectoryLength/dashBitLength)|0) + dashBitOffset) % dashBitCount;
      if (!(dashedStrokeBits & (1 << ((dashBitCount-bit)-1)))) return;
    }
    var t=((y-auxDilHalf)+1)|0; if(t<clipTop)t=clipTop;
    var b=(y+auxDilHalf)|0; if(b>clipBottom)b=clipBottom;
    var l=((x-auxDilHalf)+1)|0; if(l<clipLeft)l=clipLeft;       // note: no subPixelDelta in WP
    var r=(x+auxDilHalf)|0; if(r>clipRight)r=clipRight;
    for (var displayY=t; displayY<=b; displayY++) {
      var pi=(displayY*targetWidth+l)-1, dy=displayY-y, dySq=dy*dy;
      for (var displayX=l; displayX<=r; displayX++) {
        pi++;
        var dx=displayX-x, dist=dx*dx+dySq;
        if (dist < auxDilHalfSq) {
          var ab=alphaMaskWP[pi];
          if (ab !== 0x7F) {
            var aux1=auxDilHalf-Math.sqrt(dist);
            var cand=((aux1<antiAliasingWidth?aux1:antiAliasingWidth)*auxAAInv)|0;
            if (cand>ab) { alphaMaskWP[pi]=(cand<0x7F?cand:0x7F); affectedBits[pi>>4]=1; }
          }
        }
      }
    }
  }
  function updateEdgeCountWP(x,y) {
    var yt=y|0;
    if (yt===prevYTruncated) return;
    if (!(yt>=clipTop-1 && yt<=clipBottom)) return;
    if (prevYTruncated===0x7FFFFFFF){ prevYTruncated=yt; return; }
    var pixelY, inc;
    if (yt>prevYTruncated){ pixelY=yt; inc=1; } else { pixelY=prevYTruncated; inc=0xFF; }
    prevYTruncated=yt;
    var off=Math.max((x+1)|0,clipLeft);
    if (off<=clipRight){ var pi=pixelY*targetWidth+off; edgeCountsWP[pi]=(edgeCountsWP[pi]+inc)&0xFF; affectedBits[pi>>4]=1; }
  }
  function compositeWP(pi, alpha, foreR,foreG,foreB) {
    if (alpha===0.0) return;
    var un=1.0-alpha, tw=targetBits[pi], aBits=tw&0xFF000000;
    var tA=(aBits>>>0)*(1.0/(255.0*256*256*256));
    var ra=alpha+un*tA;
    var rB=(((alpha*foreR+(un*((tw&0xFF0000)>>>16))*tA)/ra+0.5)>>>0)<<16;
    var gB=(((alpha*foreG+(un*((tw&0xFF00)>>>8))*tA)/ra+0.5)>>>0)<<8;
    var bB=((alpha*foreB+(un*(tw&0xFF))*tA)/ra+0.5)>>>0;
    var aB2=((ra*255.0+0.5)>>>0)<<24;
    targetBits[pi]=(((aB2|rB)|gB)|bB)>>>0;
    morphIds[pi]=currentMorphId>>>0;
  }
  function blendFillOnlyWP(l,t,r,b) {
    var opaque = (targetAssumedOpaque && fillA===1.0)
      ? ((0xFF000000 | ((((fillR+0.5)|0)>>>0)<<16) | ((((fillG+0.5)|0)>>>0)<<8) | (((fillB+0.5)|0)>>>0))>>>0) : 0;
    var lastSeg=-1, affected=false;
    for (var dY=t; dY<=b; dY++) {
      var csL=0, csR=targetWidth-1, aaL=targetWidth, aaR=targetWidth;
      if (clippingSpec){ csL=clippingSpec[dY*2]; csR=clippingSpec[dY*2+1]; aaL=(csL>=l?csL:targetWidth); aaR=(csR<=r?csR:targetWidth); }
      var e=0, pi=dY*targetWidth+l, dX=l;
      while (dX<=r) {
        var seg=pi>>4;
        if (lastSeg!==seg){ affected=affectedBits[seg]===1; lastSeg=seg; if(affected)affectedBits[seg]=0; }
        var segLen=((seg+1)<<4)-pi;
        if (affected || e!==0) {
          var toDo=segLen<(r-dX+1)?segLen:(r-dX+1);
          for (var k=0;k<toDo;k++){
            var ab=0;
            if (affected){ var et=edgeCountsWP[pi]; if(et){edgeCountsWP[pi]=0; e=(e+et)&0xFF;} ab=alphaMaskWP[pi]; if(ab)alphaMaskWP[pi]=0; }
            if (dX>=csL && dX<=csR){
              var fA=fillA, opq=opaque;
              if (dX===aaL||dX===aaR){ fA=fillA*0.25; opq=0; }
              else if (dX-1===aaL||dX+1===aaR){ fA=fillA*0.75; opq=0; }
              if (e!==0){
                if (opq!==0 && ab===0){ targetBits[pi]=opq; morphIds[pi]=currentMorphId>>>0; }
                else compositeWP(pi, (0x7F-ab)*(1.0/127.0)*fA, fillR,fillG,fillB);
              } else if (ab!==0) compositeWP(pi, ab*(1.0/127.0)*fA, fillR,fillG,fillB);
            }
            dX++; pi++;
          }
        } else { dX+=segLen; pi+=segLen; }
      }
    }
  }
  function blendStrokeAndFillWP(l,t,r,b) {
    var lastSeg=-1, affected=false;
    for (var dY=t; dY<=b; dY++) {
      var csL=clipSpanL(dY), csR=clipSpanR(dY);
      var e=0, pi=dY*targetWidth+l, dX=l;
      while (dX<=r) {
        var seg=pi>>4;
        if (lastSeg!==seg){ affected=affectedBits[seg]===1; lastSeg=seg; if(affected)affectedBits[seg]=0; }
        var segLen=((seg+1)<<4)-pi;
        if (affected || e!==0) {
          var toDo=segLen<(r-dX+1)?segLen:(r-dX+1);
          for (var k=0;k<toDo;k++){
            var ab=0;
            if (affected){ var et=edgeCountsWP[pi]; if(et){edgeCountsWP[pi]=0; e=(e+et)&0xFF;} ab=alphaMaskWP[pi]; if(ab)alphaMaskWP[pi]=0; }
            if (dX>=csL && dX<=csR){
              if (ab!==0){
                if (ab===0x7F) compositeWP(pi, strokeA, strokeR,strokeG,strokeB);
                else if (e!==0){ var sa=ab*(1.0/127.0), ua=1.0-sa;
                  compositeWP(pi, sa*strokeA+ua*fillA, sa*strokeR+ua*fillR, sa*strokeG+ua*fillG, sa*strokeB+ua*fillB); }
                else compositeWP(pi, ab*(1.0/127.0)*strokeA, strokeR,strokeG,strokeB);
              } else if (e!==0) compositeWP(pi, fillA, fillR,fillG,fillB);
            }
            dX++; pi++;
          }
        } else { dX+=segLen; pi+=segLen; }
      }
    }
  }
  function blendStrokeOnlyWP(l,t,r,b) {
    var lastSeg=-1, affected=false;
    for (var dY=t; dY<=b; dY++) {
      var csL=clipSpanL(dY), csR=clipSpanR(dY);
      var pi=dY*targetWidth+l, dX=l;
      while (dX<=r) {
        var seg=pi>>4;
        if (lastSeg!==seg){ affected=affectedBits[seg]===1; lastSeg=seg; if(affected)affectedBits[seg]=0; }
        var segLen=((seg+1)<<4)-pi;
        if (affected) {
          var toDo=segLen<(r-dX+1)?segLen:(r-dX+1);
          for (var k=0;k<toDo;k++){
            var ab=alphaMaskWP[pi]; if(ab){ alphaMaskWP[pi]=0; if(dX>=csL&&dX<=csR) compositeWP(pi, ab*(1.0/127.0)*strokeA, strokeR,strokeG,strokeB); }
            dX++; pi++;
          }
        } else { dX+=segLen; pi+=segLen; }
      }
    }
  }

  // ===== text: render one glyph's contours at (nextGlyphX,nextGlyphY); returns advanceWidth =====
  function renderGlyph(contourData, gi, nextGlyphX, nextGlyphY) {
    var i = gi - 1;
    var advanceWidth = contourData[i];
    i += 5;
    var numContours = contourData[i]|0; i += 1;
    for (var c=0; c<numContours; c++) {
      var numBeziers = contourData[i]|0;
      var ttX = contourData[i+1]+nextGlyphX, ttY = contourData[i+2]+nextGlyphY; i += 3;
      var startX = ttX*txA11+ttY*txA12+txA13, startY = ttX*txA21+ttY*txA22+txA23;
      var contourStartX = startX, contourStartY = startY;
      prevYTruncated = 0x7FFFFFFF;
      for (var bz=0; bz<numBeziers; bz++) {
        ttX=contourData[i]; ttY=contourData[i+1];
        var endX=ttX*txA11+ttY*txA12+startX, endY=ttX*txA21+ttY*txA22+startY;
        ttX=contourData[i+2]; ttY=contourData[i+3]; i += 4;
        var ctrlX=ttX*txA11+ttY*txA12+startX, ctrlY=ttX*txA21+ttY*txA22+startY;
        var xMin=Math.min(startX,endX),xMax=Math.max(startX,endX),yMin=Math.min(startY,endY),yMax=Math.max(startY,endY);
        spanLeft=Math.min(spanLeft,Math.min(xMin,(xMin+ctrlX)/2.0)); spanRight=Math.max(spanRight,Math.max(xMax,(xMax+ctrlX)/2.0));
        spanTop=Math.min(spanTop,Math.min(yMin,(yMin+ctrlY)/2.0)); spanBottom=Math.max(spanBottom,Math.max(yMax,(yMax+ctrlY)/2.0));
        var x=startX,y=startY; updateAlphas(x,y); updateEdgeCount(x,y);
        var dx=Math.abs(endX-startX),dy=Math.abs(endY-startY);
        var inc=Math.min(0.5/Math.max(dx,dy),0.5), t=0.0,t0,x0,y0,o,f1,f2,f3,len;
        do {
          t0=t;x0=x;y0=y; t=t0+inc;o=1.0-t; f1=o*o;f2=2.0*o*t;f3=t*t;
          x=f1*startX+f2*ctrlX+f3*endX; y=f1*startY+f2*ctrlY+f3*endY; dx=x-x0;dy=y-y0; len=Math.sqrt(dx*dx+dy*dy);
          do { inc=inc/len*hop; t=t0+inc;o=1.0-t; f1=o*o;f2=2.0*o*t;f3=t*t;
            x=f1*startX+f2*ctrlX+f3*endX; y=f1*startY+f2*ctrlY+f3*endY; dx=x-x0;dy=y-y0; len=Math.sqrt(dx*dx+dy*dy);
          } while (hop/len < 1.0);
          if (t<1.0){ updateAlphas(x,y); updateEdgeCount(x,y); }
        } while (t<1.0);
        updateAlphas(endX,endY); updateEdgeCount(endX,endY);
        startX=endX; startY=endY;
      }
      // close the contour: count the edge crossing back to the contour start (matches C).
      // Without this, a contour whose last point != first point leaves the winding open,
      // producing fill notches/leaks on glyphs like "B".
      updateEdgeCount(contourStartX, contourStartY);
    }
    return advanceWidth;
  }
  // shared display driver. charAt(i) -> code; lookup maps code -> glyph index (<1 => glyph 1)
  function displayLoop(len, charAt, contourData, contourDataIndexes, start, stop, destX, destY, sx, sy) {
    trajectoryLength = 0.0;
    txA11*=sx; txA12*=sy; txA21*=sx; txA22*=sy;
    var nextGlyphX = destX/sx, nextGlyphY = destY/sy;
    for (var k=start-1; k<stop; k++) {
      var code = charAt(k);
      var gi = contourDataIndexes[code]; if (gi<1) gi=1;
      var advanceWidth = renderGlyph(contourData, gi, nextGlyphX, nextGlyphY);
      nextGlyphX += advanceWidth;
    }
    txA11/=sx; txA12/=sy; txA21/=sx; txA22/=sy;
    return nextGlyphX*sx;
  }

  // ===== primitive dispatch helpers =====
  function f(d){ return ip.stackFloatValue(d); }
  function n(d){ return ip.stackIntegerValue(d); }
  function w32(d){ var o=ip.stackObjectValue(d); return o.words; }
  function f32(d){ var o=ip.stackObjectValue(d); return o.wordsAsFloat32Array(); }
  function i32(d){ var o=ip.stackObjectValue(d); return o.wordsAsInt32Array(); }
  function bytes(d){ var o=ip.stackObjectValue(d); return o.bytes; }
  function bool(d){ return ip.booleanValueOf(ip.stackObjectValue(d)); }
  function self(ac){ ip.pop(ac); return true; }
  function retInt(ac,v){ ip.popthenPush(ac+1, v|0); return true; }
  function retFloat(ac,v){ ip.popthenPush(ac+1, ip.floatObjectOf(v)); return true; }

  return {
    getModuleName: function(){ return "VectorEnginePlugin (SqueakJS v7 port)"; },
    interpreterProxy: null,
    setInterpreter: function(anInterpreter){ ip = anInterpreter; this.interpreterProxy = anInterpreter; return true; },

    pluginApiVersion: function(ac){ return retInt(ac, 7); },

    // ---- accessors ----
    primAntiAliasingWidthsubPixelDelta: function(ac){ antiAliasingWidth=f(1); subPixelDelta=f(0); auxAAInv=127.0/antiAliasingWidth; return self(ac); },
    primStrokeWidthHop: function(ac){
      strokeWidth=f(1); hop=f(0);
      auxDilHalf=(strokeWidth+antiAliasingWidth)*0.5; auxDilHalfSq=auxDilHalf*auxDilHalf;
      var er=((strokeWidth-antiAliasingWidth)*0.5 - hop) - 2.0; auxErHalfSq=er*Math.abs(er);
      dashedStrokeBits=0; dashBitLength=0.0; return self(ac);
    },
    primStrokeRGBA: function(ac){ strokeR=f(3)*255.0; strokeG=f(2)*255.0; strokeB=f(1)*255.0; strokeA=f(0); return self(ac); },
    primFillRGBA: function(ac){ fillR=f(3)*255.0; fillG=f(2)*255.0; fillB=f(1)*255.0; fillA=f(0); return self(ac); },
    primGeometryTxSet: function(ac){ txA11=f(5);txA12=f(4);txA13=f(3);txA21=f(2);txA22=f(1);txA23=f(0); return self(ac); },
    primClipLeftclipTopclipRightclipBottom: function(ac){ clipLeft=n(3);clipTop=n(2);clipRight=n(1);clipBottom=n(0); return self(ac); },
    primSetClippingSpec: function(ac){ clippingSpec=i32(0); return self(ac); },
    primClearClippingSpec: function(ac){ clippingSpec=null; return self(ac); },
    primCurrentMorphId: function(ac){ currentMorphId=n(0)>>>0; return self(ac); },
    primTargetAssumedOpaque: function(ac){ targetAssumedOpaque=bool(0)?1:0; return self(ac); },
    dashedStrokeBitsSet: function(ac){ dashedStrokeBits=n(3); dashBitCount=n(2); dashBitLength=f(1); dashBitOffset=n(0); return self(ac); },
    primSetTarget: function(ac){
      wpMode=false;
      targetBits=w32(7); morphIds=w32(6); edgeCounts=w32(5); alphaMask=w32(4);
      /* affectedBits = bytes(3) — optimization buffer, unused */ contour=f32(2);
      targetWidth=n(1); targetHeight=n(0);
      clippingSpec=null; clipLeft=0; clipTop=0; clipRight=targetWidth-1; clipBottom=targetHeight-1; return self(ac);
    },
    primSetTargetWP: function(ac){
      wpMode=true;
      targetBits=w32(7); morphIds=w32(6); edgeCountsWP=bytes(5); alphaMaskWP=bytes(4);
      affectedBits=bytes(3); contour=f32(2);
      targetWidth=n(1); targetHeight=n(0);
      clippingSpec=null; clipLeft=0; clipTop=0; clipRight=targetWidth-1; clipBottom=targetHeight-1; return self(ac);
    },
    primInitializePath: function(ac){ spanLeft=targetWidth; spanTop=targetHeight; spanRight=0; spanBottom=0; prevYRounded=0x7FFFFFFF; return self(ac); },
    primNewTrajectoryFragment: function(ac){ prevYTruncated=0x7FFFFFFF; trajectoryLength=0.0; return self(ac); },
    primResetContour: function(ac){
      var t=n(1), b=n(0); leftAtThisY=targetWidth; rightAtThisY=0;
      for (var y=t; y<=b; y++){ contour[y*2]=targetWidth; contour[y*2+1]=0; } return self(ac);
    },
    primUpdateContourLastLine: function(ac){ if(prevYRounded!==0x7FFFFFFF){ contour[prevYRounded*2]=leftAtThisY; contour[prevYRounded*2+1]=rightAtThisY; } return self(ac); },

    primSpanLeft:   function(ac){ return retInt(ac, ((spanLeft-auxDilHalf-subPixelDelta)+1)|0); },
    primSpanRight:  function(ac){ return retInt(ac, (((spanRight+auxDilHalf+subPixelDelta)|0)+1)); },
    primSpanTop:    function(ac){ return retInt(ac, ((spanTop-auxDilHalf)+1)|0); },
    primSpanBottom: function(ac){ return retInt(ac, (spanBottom+auxDilHalf)|0); },

    // ---- path ----
    primLine: function(ac){ pvt_line(f(3),f(2),f(1),f(0)); return self(ac); },
    primQuadraticBezier: function(ac){ pvt_quad(f(5),f(4),f(3),f(2),f(1),f(0)); return self(ac); },
    primCubicBezier: function(ac){ pvt_cubic(f(7),f(6),f(5),f(4),f(3),f(2),f(1),f(0)); return self(ac); },
    primArc: function(ac){ arcImpl(f(7),f(6),f(5),f(4),f(3),f(2),f(1),f(0)); return self(ac); },
    primPathSequence: function(ac){
      var a=f32(1), size=n(0), i=0, sX=0,sY=0,eX,eY,c1X,c1Y,c2X,c2Y;
      while (i<size) {
        var cmd=a[i]|0; i++;
        if (cmd===0){ sX=a[i];sY=a[i+1];i+=2; prevYTruncated=0x7FFFFFFF; }
        else if (cmd===1){ eX=a[i];eY=a[i+1];i+=2; pvt_line(sX,sY,eX,eY); sX=eX;sY=eY; }
        else if (cmd===2){ eX=a[i];eY=a[i+1];c1X=a[i+2];c1Y=a[i+3];i+=4; pvt_quad(sX,sY,eX,eY,c1X,c1Y); sX=eX;sY=eY; }
        else if (cmd===3){ eX=a[i];eY=a[i+1];c1X=a[i+2];c1Y=a[i+3];c2X=a[i+4];c2Y=a[i+5];i+=6; pvt_cubic(sX,sY,eX,eY,c1X,c1Y,c2X,c2Y); sX=eX;sY=eY; }
        else break;
      }
      return self(ac);
    },

    // ---- blend ----
    primBlendFillOnly: function(ac){ blendFillOnly(n(3),n(2),n(1),n(0)); return self(ac); },
    primBlendStrokeAndFill: function(ac){ blendStrokeAndFill(n(3),n(2),n(1),n(0)); return self(ac); },
    primBlendStrokeOnly: function(ac){ blendStrokeOnly(n(3),n(2),n(1),n(0)); return self(ac); },

    // ---- text (9 args: str, from, to, destX, destY, sx, sy, contourData, contourDataIndexes) ----
    primDisplayByteString: function(ac){
      var s=bytes(8), from=n(7), to=n(6), destX=f(5), destY=f(4), sx=f(3), sy=f(2), cd=f32(1), cdi=i32(0);
      return retFloat(ac, displayLoop(s.length, function(k){ return s[k]; }, cd, cdi, from, to, destX, destY, sx, sy));
    },
    primDisplayUtf32: function(ac){
      var s=w32(8), from=n(7), to=n(6), destX=f(5), destY=f(4), sx=f(3), sy=f(2), cd=f32(1), cdi=i32(0);
      return retFloat(ac, displayLoop(s.length, function(k){ return s[k]; }, cd, cdi, from, to, destX, destY, sx, sy));
    },
    primDisplayUtf8: function(ac){
      // UTF-8 multi-byte handled via the trie: contourDataIndexes[base+byte]; negative => continuation
      var s=bytes(8), from=n(7), to=n(6), destX=f(5), destY=f(4), sx=f(3), sy=f(2), cd=f32(1), cdi=i32(0);
      trajectoryLength=0.0; txA11*=sx; txA12*=sy; txA21*=sx; txA22*=sy;
      var nextGlyphX=destX/sx, nextGlyphY=destY/sy, base=0;
      for (var k=from-1; k<to; k++){
        var gi = cdi[base + s[k]];
        if (gi<0){ base = -gi; continue; }
        if (gi<1) gi=1;
        nextGlyphX += renderGlyph(cd, gi, nextGlyphX, nextGlyphY);
        base=0;
      }
      txA11/=sx; txA12/=sy; txA21/=sx; txA22/=sy;
      return retFloat(ac, nextGlyphX*sx);
    },

    // ---- WholePixel variants: path/text reuse the same flatteners (dispatch via wpMode);
    //      only the blend differs (single 8-bit channel) ----
    primLineWP: function(ac){ pvt_line(f(3),f(2),f(1),f(0)); return self(ac); },
    primQuadraticBezierWP: function(ac){ pvt_quad(f(5),f(4),f(3),f(2),f(1),f(0)); return self(ac); },
    primCubicBezierWP: function(ac){ pvt_cubic(f(7),f(6),f(5),f(4),f(3),f(2),f(1),f(0)); return self(ac); },
    primArcWP: function(ac){ arcImpl(f(7),f(6),f(5),f(4),f(3),f(2),f(1),f(0)); return self(ac); },
    primPathSequenceWP: function(ac){ return this.primPathSequence(ac); },
    primBlendFillOnlyWP: function(ac){ blendFillOnlyWP(n(3),n(2),n(1),n(0)); return self(ac); },
    primBlendStrokeAndFillWP: function(ac){ blendStrokeAndFillWP(n(3),n(2),n(1),n(0)); return self(ac); },
    primBlendStrokeOnlyWP: function(ac){ blendStrokeOnlyWP(n(3),n(2),n(1),n(0)); return self(ac); },
    primDisplayByteStringWP: function(ac){ return this.primDisplayByteString(ac); },
    primDisplayUtf32WP: function(ac){ return this.primDisplayUtf32(ac); },
    primDisplayUtf8WP: function(ac){ return this.primDisplayUtf8(ac); },
  };
}

function registerVectorEnginePlugin() {
  if (typeof Squeak === "object" && Squeak.registerExternalModule) {
    Squeak.registerExternalModule('VectorEnginePlugin', VectorEnginePlugin());
  } else self.setTimeout(registerVectorEnginePlugin, 100);
}
registerVectorEnginePlugin();
