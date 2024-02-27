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

"use strict";

//////////////////////////////////////////////////////////////////////////////
// load vm, plugins, and other libraries
//////////////////////////////////////////////////////////////////////////////

import "./globals.js";
import "./vm.js";
import "./vm.object.js";
import "./vm.object.spur.js";
import "./vm.image.js";
import "./vm.interpreter.js";
import "./vm.interpreter.proxy.js";
import "./vm.instruction.stream.js";
import "./vm.instruction.stream.sista.js";
import "./vm.instruction.printer.js";
import "./vm.primitives.js";
import "./jit.js";
import "./vm.audio.browser.js";
import "./vm.display.js";
import "./vm.display.browser.js";
import "./vm.files.browser.js";
import "./vm.input.js";
import "./vm.input.browser.js";
import "./vm.plugins.js";
import "./vm.plugins.ffi.js";
import "./vm.plugins.javascript.js";
import "./vm.plugins.obsolete.js";
import "./vm.plugins.drop.browser.js";
import "./vm.plugins.file.browser.js";
import "./vm.plugins.jpeg2.browser.js";
import "./vm.plugins.scratch.browser.js";
import "./vm.plugins.sound.browser.js";
import "./plugins/ADPCMCodecPlugin.js";
import "./plugins/B2DPlugin.js";
import "./plugins/BitBltPlugin.js";
import "./plugins/CroquetPlugin.js";
import "./plugins/FFTPlugin.js";
import "./plugins/FloatArrayPlugin.js";
import "./plugins/GeniePlugin.js";
import "./plugins/JPEGReaderPlugin.js";
import "./plugins/KedamaPlugin.js";
import "./plugins/KedamaPlugin2.js";
import "./plugins/Klatt.js";
import "./plugins/LargeIntegers.js";
import "./plugins/Matrix2x3Plugin.js";
import "./plugins/MiscPrimitivePlugin.js";
import "./plugins/ScratchPlugin.js";
import "./plugins/SocketPlugin.js";
import "./plugins/SpeechPlugin.js";
import "./plugins/SqueakSSL.js";
import "./plugins/SoundGenerationPlugin.js";
import "./plugins/StarSqueakPlugin.js";
import "./plugins/ZipPlugin.js";
import "./lib/lz-string.js";
import "./lib/jszip.js";
import "./lib/FileSaver.js";
import "./lib/sha1.js";

Object.extend(Squeak, {
    vmPath: "/",
    platformSubtype: "Browser",
    osVersion: navigator.userAgent,     // might want to parse
    windowSystem: "HTML",
});

// UI namespace
window.SqueakJS = {};

//////////////////////////////////////////////////////////////////////////////
// display & event setup
//////////////////////////////////////////////////////////////////////////////

function setupFullscreen(display, canvas, options) {
    // Fullscreen can only be enabled in an event handler. So we check the
    // fullscreen flag on every mouse down/up and keyboard event.
    var box = canvas.parentElement,
        fullscreenEvent = "fullscreenchange",
        fullscreenElement = "fullscreenElement",
        fullscreenEnabled = "fullscreenEnabled";

    if (!box.requestFullscreen) {
        [    // Fullscreen support is still very browser-dependent
            {req: box.webkitRequestFullscreen, exit: document.webkitExitFullscreen,
                evt: "webkitfullscreenchange", elem: "webkitFullscreenElement", enable: "webkitFullscreenEnabled"},
            {req: box.mozRequestFullScreen, exit: document.mozCancelFullScreen,
                evt: "mozfullscreenchange", elem: "mozFullScreenElement", enable: "mozFullScreenEnabled"},
            {req: box.msRequestFullscreen, exit: document.msExitFullscreen,
                evt: "MSFullscreenChange", elem: "msFullscreenElement", enable: "msFullscreenEnabled"},
        ].forEach(function(browser) {
            if (browser.req) {
                box.requestFullscreen = browser.req;
                document.exitFullscreen = browser.exit;
                fullscreenEvent = browser.evt;
                fullscreenElement = browser.elem;
                fullscreenEnabled = browser.enable;
            }
        });
    }

    // If the user canceled fullscreen, turn off the fullscreen flag so
    // we don't try to enable it again in the next event
    function fullscreenChange(fullscreen) {
        display.fullscreen = fullscreen;
        var fullwindow = fullscreen || options.fullscreen;
        box.style.background = fullwindow ? 'black' : '';
        if (options.header) options.header.style.display = fullwindow ? 'none' : '';
        if (options.footer) options.footer.style.display = fullwindow ? 'none' : '';
        if (options.fullscreenCheckbox) options.fullscreenCheckbox.checked = fullscreen;
        setTimeout(onresize, 0);
    }

    var checkFullscreen;

    if (box.requestFullscreen) {
        document.addEventListener(fullscreenEvent, function(){fullscreenChange(box == document[fullscreenElement]);});
        checkFullscreen = function() {
            if (document[fullscreenEnabled] && (box == document[fullscreenElement]) != display.fullscreen) {
                if (display.fullscreen) box.requestFullscreen();
                else document.exitFullscreen();
            }
        };
    } else {
        var isFullscreen = false;
        checkFullscreen = function() {
            if ((options.header || options.footer) && isFullscreen != display.fullscreen) {
                isFullscreen = display.fullscreen;
                fullscreenChange(isFullscreen);
            }
        };
    }

    if (options.fullscreenCheckbox) options.fullscreenCheckbox.onclick = function() {
        display.fullscreen = options.fullscreenCheckbox.checked;
        checkFullscreen();
    };

    return checkFullscreen;
}

function setupSwapButtons(options) {
    if (options.swapCheckbox) {
        var imageName = Squeak.Settings["squeakImageName"] || "default",
            settings = JSON.parse(Squeak.Settings["squeakSettings:" + imageName] || "{}");
        if ("swapButtons" in settings) options.swapButtons = settings.swapButtons;
        options.swapCheckbox.checked = options.swapButtons;
        options.swapCheckbox.onclick = function() {
            options.swapButtons = options.swapCheckbox.checked;
            settings["swapButtons"] = options.swapButtons;
            Squeak.Settings["squeakSettings:" + imageName] = JSON.stringify(settings);
        };
    }
}

function recordModifiers(evt, display) {
    var shiftPressed = evt.shiftKey,
        ctrlPressed = evt.ctrlKey && !evt.altKey,
        cmdPressed = display.isMac ? evt.metaKey : evt.altKey && !evt.ctrlKey,
        modifiers =
            (shiftPressed ? Squeak.Keyboard_Shift : 0) +
            (ctrlPressed ? Squeak.Keyboard_Ctrl : 0) +
            (cmdPressed ? Squeak.Keyboard_Cmd : 0);
    display.buttons = (display.buttons & ~Squeak.Keyboard_All) | modifiers;
    return modifiers;
}

var canUseMouseOffset = navigator.userAgent.match("AppleWebKit/");

function updateMousePos(evt, canvas, display) {
    var evtX = canUseMouseOffset ? evt.offsetX : evt.layerX,
        evtY = canUseMouseOffset ? evt.offsetY : evt.layerY;
    if (display.cursorCanvas) {
        display.cursorCanvas.style.left = (evtX + canvas.offsetLeft + display.cursorOffsetX) + "px";
        display.cursorCanvas.style.top = (evtY + canvas.offsetTop + display.cursorOffsetY) + "px";
    }
    var x = (evtX * canvas.width / canvas.offsetWidth) | 0,
        y = (evtY * canvas.height / canvas.offsetHeight) | 0;
    // clamp to display size
    display.mouseX = Math.max(0, Math.min(display.width, x));
    display.mouseY = Math.max(0, Math.min(display.height, y));
}

function recordMouseEvent(what, evt, canvas, display, options) {
    updateMousePos(evt, canvas, display);
    if (!display.vm) return;
    var buttons = display.buttons & Squeak.Mouse_All;
    switch (what) {
        case 'mousedown':
            switch (evt.button || 0) {
                case 0: buttons = Squeak.Mouse_Red; break;      // left
                case 1: buttons = Squeak.Mouse_Yellow; break;   // middle
                case 2: buttons = Squeak.Mouse_Blue; break;     // right
            }
            if (buttons === Squeak.Mouse_Red && (evt.altKey || evt.metaKey))
                buttons = Squeak.Mouse_Yellow; // emulate middle-click
            if (options.swapButtons)
                if (buttons == Squeak.Mouse_Yellow) buttons = Squeak.Mouse_Blue;
                else if (buttons == Squeak.Mouse_Blue) buttons = Squeak.Mouse_Yellow;
            break;
        case 'mousemove':
            break; // nothing more to do
        case 'mouseup':
            buttons = 0;
            break;
    }
    display.buttons = buttons | recordModifiers(evt, display);
    if (display.eventQueue) {
        display.eventQueue.push([
            Squeak.EventTypeMouse,
            evt.timeStamp,  // converted to Squeak time in makeSqueakEvent()
            display.mouseX,
            display.mouseY,
            display.buttons & Squeak.Mouse_All,
            display.buttons >> 3,
        ]);
        if (display.signalInputEvent)
            display.signalInputEvent();
    }
    display.idle = 0;
    if (what == 'mouseup') {
        if (display.runFor) display.runFor(100); // maybe we catch the fullscreen flag change
    } else {
        if (display.runNow) display.runNow();   // don't wait for timeout to run
    }
}

// Squeak traditional keycodes are MacRoman
var MacRomanToUnicode = [
    0x00C4, 0x00C5, 0x00C7, 0x00C9, 0x00D1, 0x00D6, 0x00DC, 0x00E1,
    0x00E0, 0x00E2, 0x00E4, 0x00E3, 0x00E5, 0x00E7, 0x00E9, 0x00E8,
    0x00EA, 0x00EB, 0x00ED, 0x00EC, 0x00EE, 0x00EF, 0x00F1, 0x00F3,
    0x00F2, 0x00F4, 0x00F6, 0x00F5, 0x00FA, 0x00F9, 0x00FB, 0x00FC,
    0x2020, 0x00B0, 0x00A2, 0x00A3, 0x00A7, 0x2022, 0x00B6, 0x00DF,
    0x00AE, 0x00A9, 0x2122, 0x00B4, 0x00A8, 0x2260, 0x00C6, 0x00D8,
    0x221E, 0x00B1, 0x2264, 0x2265, 0x00A5, 0x00B5, 0x2202, 0x2211,
    0x220F, 0x03C0, 0x222B, 0x00AA, 0x00BA, 0x03A9, 0x00E6, 0x00F8,
    0x00BF, 0x00A1, 0x00AC, 0x221A, 0x0192, 0x2248, 0x2206, 0x00AB,
    0x00BB, 0x2026, 0x00A0, 0x00C0, 0x00C3, 0x00D5, 0x0152, 0x0153,
    0x2013, 0x2014, 0x201C, 0x201D, 0x2018, 0x2019, 0x00F7, 0x25CA,
    0x00FF, 0x0178, 0x2044, 0x20AC, 0x2039, 0x203A, 0xFB01, 0xFB02,
    0x2021, 0x00B7, 0x201A, 0x201E, 0x2030, 0x00C2, 0x00CA, 0x00C1,
    0x00CB, 0x00C8, 0x00CD, 0x00CE, 0x00CF, 0x00CC, 0x00D3, 0x00D4,
    0xF8FF, 0x00D2, 0x00DA, 0x00DB, 0x00D9, 0x0131, 0x02C6, 0x02DC,
    0x00AF, 0x02D8, 0x02D9, 0x02DA, 0x00B8, 0x02DD, 0x02DB, 0x02C7,
];
var UnicodeToMacRoman = {};
for (var i = 0; i < MacRomanToUnicode.length; i++)
    UnicodeToMacRoman[MacRomanToUnicode[i]] = i + 128;

function recordKeyboardEvent(unicode, timestamp, display) {
    if (!display.vm) return;
    var macCode = UnicodeToMacRoman[unicode] || (unicode < 128 ? unicode : 0);
    var modifiersAndKey = (display.buttons >> 3) << 8 | macCode;
    if (display.eventQueue) {
        display.eventQueue.push([
            Squeak.EventTypeKeyboard,
            timestamp,  // converted to Squeak time in makeSqueakEvent()
            macCode, // MacRoman
            Squeak.EventKeyChar,
            display.buttons >> 3,
            unicode,  // Unicode
        ]);
        if (display.signalInputEvent)
            display.signalInputEvent();
        // There are some old images that use both event-based
        // and polling primitives. To make those work, keep the
        // last key event
        display.keys[0] = modifiersAndKey;
    } else if (modifiersAndKey === display.vm.interruptKeycode) {
        display.vm.interruptPending = true;
    } else {
        // no event queue, queue keys the old-fashioned way
        display.keys.push(modifiersAndKey);
    }
    display.idle = 0;
    if (display.runNow) display.runNow(); // don't wait for timeout to run
}

function recordDragDropEvent(type, evt, canvas, display) {
    if (!display.vm || !display.eventQueue) return;
    updateMousePos(evt, canvas, display);
    display.eventQueue.push([
        Squeak.EventTypeDragDropFiles,
        evt.timeStamp,  // converted to Squeak time in makeSqueakEvent()
        type,
        display.mouseX,
        display.mouseY,
        display.buttons >> 3,
        display.droppedFiles.length,
    ]);
    if (display.signalInputEvent)
        display.signalInputEvent();
}

function fakeCmdOrCtrlKey(key, timestamp, display) {
    // set both Cmd and Ctrl bit, because we don't know what the image wants
    display.buttons &= ~Squeak.Keyboard_All;  // remove all modifiers
    display.buttons |= Squeak.Keyboard_Cmd | Squeak.Keyboard_Ctrl;
    display.keys = []; //  flush other keys
    recordKeyboardEvent(key, timestamp, display);
}

function makeSqueakEvent(evt, sqEvtBuf, sqTimeOffset) {
    sqEvtBuf[0] = evt[0];
    sqEvtBuf[1] = (evt[1] - sqTimeOffset) & Squeak.MillisecondClockMask;
    for (var i = 2; i < evt.length; i++)
        sqEvtBuf[i] = evt[i];
}

function createSqueakDisplay(canvas, options) {
    options = options || {};
    if (options.fullscreen) {
        document.body.style.margin = 0;
        document.body.style.backgroundColor = 'black';
        document.ontouchmove = function(evt) { evt.preventDefault(); };
        if (options.header) options.header.style.display = 'none';
        if (options.footer) options.footer.style.display = 'none';
    }
    var display = {
        context: canvas.getContext("2d"),
        fullscreen: false,
        width: 0,   // if 0, VM uses canvas.width
        height: 0,  // if 0, VM uses canvas.height
        scale: 1,   // VM will use window.devicePixelRatio if highdpi is enabled, also changes when touch-zooming
        highdpi: options.highdpi,
        mouseX: 0,
        mouseY: 0,
        buttons: 0,
        keys: [],
        eventQueue: null, // only used if image uses event primitives
        clipboardString: '',
        clipboardStringChanged: false,
        cursorCanvas: options.cursor !== false && document.getElementById("sqCursor") || document.createElement("canvas"),
        cursorOffsetX: 0,
        cursorOffsetY: 0,
        droppedFiles: [],
        signalInputEvent: null, // function set by VM
        changedCallback: null,  // invoked when display size/scale changes
        // additional functions added below
    };
    setupSwapButtons(options);
    if (options.pixelated) {
        canvas.classList.add("pixelated");
        display.cursorCanvas && display.cursorCanvas.classList.add("pixelated");
    }

    display.reset = function() {
        display.eventQueue = null;
        display.signalInputEvent = null;
        display.lastTick = 0;
        display.getNextEvent = function(firstEvtBuf, firstOffset) {
            // might be called from VM to get queued event
            display.eventQueue = []; // create queue on first call
            display.eventQueue.push = function(evt) {
                display.eventQueue.offset = Date.now() - evt[1]; // get epoch from first event
                delete display.eventQueue.push;                  // use original push from now on
                display.eventQueue.push(evt);
            };
            display.getNextEvent = function(evtBuf, timeOffset) {
                var evt = display.eventQueue.shift();
                if (evt) makeSqueakEvent(evt, evtBuf, timeOffset - display.eventQueue.offset);
                else evtBuf[0] = Squeak.EventTypeNone;
            };
            display.getNextEvent(firstEvtBuf, firstOffset);
        };
    };
    display.reset();

    var checkFullscreen = setupFullscreen(display, canvas, options);
    display.fullscreenRequest = function(fullscreen, thenDo) {
        // called from primitive to change fullscreen mode
        if (display.fullscreen != fullscreen) {
            display.fullscreen = fullscreen;
            display.resizeTodo = thenDo;    // called after resizing
            display.resizeTodoTimeout = setTimeout(display.resizeDone, 1000);
            checkFullscreen();
        } else thenDo();
    };
    display.resizeDone = function() {
        clearTimeout(display.resizeTodoTimeout);
        var todo = display.resizeTodo;
        if (todo) {
            display.resizeTodo = null;
            todo();
        }
    };
    display.clear = function() {
        canvas.width = canvas.width;
    };
    display.setTitle = function(title) {
        document.title = title;
    };
    display.showBanner = function(msg, style) {
        style = style || {};
        var ctx = display.context;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = style.color || "#F90";
        ctx.font = style.font || "bold 48px sans-serif";
        if (!style.font && ctx.measureText(msg).width > canvas.width)
            ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
    };
    display.showProgress = function(value, style) {
        style = style || {};
        var ctx = display.context,
            w = (canvas.width / 3) | 0,
            h = 24,
            x = canvas.width * 0.5 - w / 2,
            y = canvas.height * 0.5 + 2 * h;
        ctx.fillStyle = style.background || "#000";
        ctx.fillRect(x, y, w, h);
        ctx.lineWidth = 2;
        ctx.strokeStyle = style.color || "#F90";
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = style.color || "#F90";
        ctx.fillRect(x, y, w * value, h);
    };
    display.executeClipboardPaste = function(text, timestamp) {
        if (!display.vm) return true;
        try {
            display.clipboardString = text;
            // simulate paste event for Squeak
            fakeCmdOrCtrlKey('v'.charCodeAt(0), timestamp, display);
        } catch(err) {
            console.error("paste error " + err);
        }
    };
    display.executeClipboardCopy = function(key, timestamp) {
        if (!display.vm) return true;
        // simulate copy event for Squeak so it places its text in clipboard
        display.clipboardStringChanged = false;
        fakeCmdOrCtrlKey((key || 'c').charCodeAt(0), timestamp, display);
        var start = Date.now();
        // now interpret until Squeak has copied to the clipboard
        while (!display.clipboardStringChanged && Date.now() - start < 500)
            display.vm.interpret(20);
        if (!display.clipboardStringChanged) return;
        // got it, now copy to the system clipboard
        try {
            return display.clipboardString;
        } catch(err) {
            console.error("copy error " + err);
        }
    };
    canvas.onmousedown = function(evt) {
        checkFullscreen();
        recordMouseEvent('mousedown', evt, canvas, display, options);
        evt.preventDefault();
        return false;
    };
    canvas.onmouseup = function(evt) {
        recordMouseEvent('mouseup', evt, canvas, display, options);
        checkFullscreen();
        evt.preventDefault();
    };
    canvas.onmousemove = function(evt) {
        recordMouseEvent('mousemove', evt, canvas, display, options);
        evt.preventDefault();
    };
    canvas.oncontextmenu = function() {
        return false;
    };
    // touch event handling
    var touch = {
        state: 'idle',
        button: 0,
        x: 0,
        y: 0,
        dist: 0,
        down: {},
    };
    function touchToMouse(evt) {
        if (evt.touches.length) {
            // average all touch positions
            touch.x = touch.y = 0;
            for (var i = 0; i < evt.touches.length; i++) {
                touch.x += evt.touches[i].pageX / evt.touches.length;
                touch.y += evt.touches[i].pageY / evt.touches.length;
            }
        }
        return {
            timeStamp: evt.timeStamp,
            button: touch.button,
            offsetX: touch.x - canvas.offsetLeft,
            offsetY: touch.y - canvas.offsetTop,
        };
    }
    function dd(ax, ay, bx, by) {var x = ax - bx, y = ay - by; return Math.sqrt(x*x + y*y);}
    function dist(a, b) {return dd(a.pageX, a.pageY, b.pageX, b.pageY);}
    function dent(n, l, t, u) { return n < l ? n + t - l : n > u ? n + t - u : t; }
    function adjustCanvas(l, t, w, h) {
        var cursorCanvas = display.cursorCanvas,
            cssScale = w / canvas.width,
            ratio = display.highdpi ? window.devicePixelRatio : 1,
            pixelScale = cssScale * ratio;
        canvas.style.left = (l|0) + "px";
        canvas.style.top = (t|0) + "px";
        canvas.style.width = (w|0) + "px";
        canvas.style.height = (h|0) + "px";
        if (cursorCanvas) {
            cursorCanvas.style.left = (l + display.cursorOffsetX + display.mouseX * cssScale|0) + "px";
            cursorCanvas.style.top = (t + display.cursorOffsetY + display.mouseY * cssScale|0) + "px";
            cursorCanvas.style.width = (cursorCanvas.width * pixelScale|0) + "px";
            cursorCanvas.style.height = (cursorCanvas.height * pixelScale|0) + "px";
        }
        // if pixelation is not forced, turn it on for integer scales
        if (!options.pixelated) {
            if (pixelScale % 1 === 0 || pixelScale > 5) {
                canvas.classList.add("pixelated");
                cursorCanvas && cursorCanvas.classList.add("pixelated");
            } else {
                canvas.classList.remove("pixelated");
                cursorCanvas && display.cursorCanvas.classList.remove("pixelated");
            }
        }
        display.css = {
            left: l,
            top: t,
            width: w,
            height: h,
            scale: cssScale,
            pixelScale: pixelScale,
            ratio: ratio,
        };
        if (display.changedCallback) display.changedCallback();
        return cssScale;
    }
    // zooming/panning with two fingers
    var maxZoom = 5;
    function zoomStart(evt) {
        touch.dist = dist(evt.touches[0], evt.touches[1]);
        touch.down.x = touch.x;
        touch.down.y = touch.y;
        touch.down.dist = touch.dist;
        touch.down.left = canvas.offsetLeft;
        touch.down.top = canvas.offsetTop;
        touch.down.width = canvas.offsetWidth;
        touch.down.height = canvas.offsetHeight;
        // store original canvas bounds
        if (!touch.orig) touch.orig = {
            left: touch.down.left,
            top: touch.down.top,
            right: touch.down.left + touch.down.width,
            bottom: touch.down.top + touch.down.height,
            width: touch.down.width,
            height: touch.down.height,
        };
    }
    function zoomMove(evt) {
        if (evt.touches.length < 2) return;
        touch.dist = dist(evt.touches[0], evt.touches[1]);
        var minScale = touch.orig.width / touch.down.width,
            //nowScale = dent(touch.dist / touch.down.dist, 0.8, 1, 1.5),
            nowScale = touch.dist / touch.down.dist,
            scale = Math.min(Math.max(nowScale, minScale * 0.95), minScale * maxZoom),
            w = touch.down.width * scale,
            h = touch.orig.height * w / touch.orig.width,
            l = touch.down.left - (touch.down.x - touch.down.left) * (scale - 1) + (touch.x - touch.down.x),
            t = touch.down.top - (touch.down.y - touch.down.top) * (scale - 1) + (touch.y - touch.down.y);
        // allow to rubber-band by 20px for feedback
        l = Math.max(Math.min(l, touch.orig.left + 20), touch.orig.right - w - 20);
        t = Math.max(Math.min(t, touch.orig.top + 20), touch.orig.bottom - h - 20);
        adjustCanvas(l, t, w, h);
    }
    function zoomEnd(evt) {
        var l = canvas.offsetLeft,
            t = canvas.offsetTop,
            w = canvas.offsetWidth,
            h = canvas.offsetHeight;
        w = Math.min(Math.max(w, touch.orig.width), touch.orig.width * maxZoom);
        h = touch.orig.height * w / touch.orig.width;
        l = Math.max(Math.min(l, touch.orig.left), touch.orig.right - w);
        t = Math.max(Math.min(t, touch.orig.top), touch.orig.bottom - h);
        var scale = adjustCanvas(l, t, w, h);
        if ((scale - display.scale) < 0.0001) {
            touch.orig = null;
            onresize();
        }
    }
    // State machine to distinguish between 1st/2nd mouse button and zoom/pan:
    // * if moved, or no 2nd finger within 100ms of 1st down, start mousing
    // * if fingers moved significantly within 200ms of 2nd down, start zooming
    // * if touch ended within this time, generate click (down+up)
    // * otherwise, start mousing with 2nd button
    // When mousing, always generate a move event before down event so that
    // mouseover eventhandlers in image work better
    canvas.ontouchstart = function(evt) {
        evt.preventDefault();
        var e = touchToMouse(evt);
        for (var i = 0; i < evt.changedTouches.length; i++) {
            switch (touch.state) {
                case 'idle':
                    touch.state = 'got1stFinger';
                    touch.first = e;
                    setTimeout(function(){
                        if (touch.state !== 'got1stFinger') return;
                        touch.state = 'mousing';
                        touch.button = e.button = 0;
                        recordMouseEvent('mousemove', e, canvas, display, options);
                        recordMouseEvent('mousedown', e, canvas, display, options);
                    }, 100);
                    break;
                case 'got1stFinger':
                    touch.state = 'got2ndFinger';
                    zoomStart(evt);
                    setTimeout(function(){
                        if (touch.state !== 'got2ndFinger') return;
                        var didMove = Math.abs(touch.down.dist - touch.dist) > 10 ||
                            dd(touch.down.x, touch.down.y, touch.x, touch.y) > 10;
                        if (didMove) {
                            touch.state = 'zooming';
                        } else {
                            touch.state = 'mousing';
                            touch.button = e.button = 2;
                            recordMouseEvent('mousemove', e, canvas, display, options);
                            recordMouseEvent('mousedown', e, canvas, display, options);
                        }
                    }, 200);
                    break;
            }
        }
    };
    canvas.ontouchmove = function(evt) {
        evt.preventDefault();
        var e = touchToMouse(evt);
        switch (touch.state) {
            case 'got1stFinger':
                touch.state = 'mousing';
                touch.button = e.button = 0;
                recordMouseEvent('mousemove', e, canvas, display, options);
                recordMouseEvent('mousedown', e, canvas, display, options);
                break;
            case 'mousing':
                recordMouseEvent('mousemove', e, canvas, display, options);
                return;
            case 'got2ndFinger':
                if (evt.touches.length > 1)
                    touch.dist = dist(evt.touches[0], evt.touches[1]);
                return;
            case 'zooming':
                zoomMove(evt);
                return;
        }
    };
    canvas.ontouchend = function(evt) {
        evt.preventDefault();
        checkFullscreen();
        var e = touchToMouse(evt);
        for (var i = 0; i < evt.changedTouches.length; i++) {
            switch (touch.state) {
                case 'mousing':
                    if (evt.touches.length > 0) break;
                    touch.state = 'idle';
                    recordMouseEvent('mouseup', e, canvas, display, options);
                    return;
                case 'got1stFinger':
                    touch.state = 'idle';
                    touch.button = e.button = 0;
                    recordMouseEvent('mousemove', e, canvas, display, options);
                    recordMouseEvent('mousedown', e, canvas, display, options);
                    recordMouseEvent('mouseup', e, canvas, display, options);
                    return;
                case 'got2ndFinger':
                    touch.state = 'mousing';
                    touch.button = e.button = 2;
                    recordMouseEvent('mousemove', e, canvas, display, options);
                    recordMouseEvent('mousedown', e, canvas, display, options);
                    break;
                case 'zooming':
                    if (evt.touches.length > 0) break;
                    touch.state = 'idle';
                    zoomEnd(evt);
                    return;
            }
        }
    };
    canvas.ontouchcancel = function(evt) {
        canvas.ontouchend(evt);
    };
    // cursorCanvas shows Squeak cursor
    if (display.cursorCanvas) {
        var absolute = window.getComputedStyle(canvas).position === "absolute";
        display.cursorCanvas.style.display = "block";
        display.cursorCanvas.style.position = absolute ? "absolute": "fixed";
        display.cursorCanvas.style.cursor = "none";
        display.cursorCanvas.style.background = "transparent";
        display.cursorCanvas.style.pointerEvents = "none";
        canvas.parentElement.appendChild(display.cursorCanvas);
        canvas.style.cursor = "none";
    }
    // keyboard stuff
    var input = document.createElement("input");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.style.position = "absolute";
    input.style.width = "0";
    input.style.height = "0";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    canvas.parentElement.appendChild(input);
    input.focus();
    input.onblur = function() { input.focus(); };
    display.isMac = navigator.userAgent.includes("Mac");
    // emulate keypress events
    var deadKey = false, // true if last keydown was a dead key
        deadChars = [];
    input.oninput = function(evt) {
        if (!display.vm) return true;
        if (evt.inputType === "insertText"                // regular key, or Chrome
            || evt.inputType === "insertCompositionText"  // Firefox, Chrome
            || evt.inputType === "insertFromComposition") // Safari
        {
            // generate backspace to delete inserted dead chars
            var hadDeadChars = deadChars.length > 0;
            if (hadDeadChars) {
                var oldButtons = display.buttons;
                display.buttons &= ~Squeak.Keyboard_All;  // remove all modifiers
                for (var i = 0; i < deadChars.length; i++) {
                    recordKeyboardEvent(8, evt.timeStamp, display);
                }
                display.buttons = oldButtons;
                deadChars = [];
            }
            // generate keyboard events for each character
            // single input could be many characters, e.g. for emoji
            var chars = Array.from(evt.data); // split by surrogate pairs
            for (var i = 0; i < chars.length; i++) {
                var unicode = chars[i].codePointAt(0); // codePointAt combines pair into unicode
                recordKeyboardEvent(unicode, evt.timeStamp, display);
            }
            if (!hadDeadChars && evt.isComposing && evt.inputType === "insertCompositionText") {
                deadChars = deadChars.concat(chars);
            }
        }
        if (!deadChars.length) input.value = "";  // clear input
    };
    input.onkeydown = function(evt) {
        checkFullscreen();
        if (!display.vm) return true;
        deadKey = evt.key === "Dead";
        if (deadKey) return;  // let browser handle dead keys
        recordModifiers(evt, display);
        var squeakCode = ({
            8: 8,   // Backspace
            9: 9,   // Tab
            13: 13, // Return
            27: 27, // Escape
            32: 32, // Space
            33: 11, // PageUp
            34: 12, // PageDown
            35: 4,  // End
            36: 1,  // Home
            37: 28, // Left
            38: 30, // Up
            39: 29, // Right
            40: 31, // Down
            45: 5,  // Insert
            46: 127, // Delete
        })[evt.keyCode];
        if (squeakCode) { // special key pressed
            recordKeyboardEvent(squeakCode, evt.timeStamp, display);
            return evt.preventDefault();
        }
        // copy/paste new-style
        if (navigator.clipboard && (display.isMac ? evt.metaKey : evt.ctrlKey)) {
            switch (evt.key) {
                case "c":
                case "x":
                    var text = display.executeClipboardCopy(evt.key, evt.timeStamp);
                    if (typeof text === 'string') {
                        navigator.clipboard.writeText(text)
                            .catch(function(err) { console.error("display: copy error " + err.message); });
                    }
                    return evt.preventDefault();
                case "v":
                    navigator.clipboard.readText()
                        .then(function(text) {
                            display.executeClipboardPaste(text, evt.timeStamp);
                        })
                        .catch(function(err) { console.error("display: paste error " + err.message); });
                    return evt.preventDefault();
            }
        }
        if (evt.key.length !== 1) return; // let browser handle other keys
        if (display.buttons & (Squeak.Keyboard_Cmd | Squeak.Keyboard_Ctrl)) {
            var code = evt.key.toLowerCase().charCodeAt(0);
            if ((display.buttons & Squeak.Keyboard_Ctrl) && code >= 96 && code < 127) code &= 0x1F; // ctrl-<key>
            recordKeyboardEvent(code, evt.timeStamp, display);
            return evt.preventDefault();
        }
    };
    input.onkeyup = function(evt) {
        if (!display.vm) return true;
        recordModifiers(evt, display);
    };
    // copy/paste old-style
    if (!navigator.clipboard) {
        document.oncopy = function(evt, key) {
            var text = display.executeClipboardCopy(key, evt.timeStamp);
            if (typeof text === 'string') {
                evt.clipboardData.setData("Text", text);
            }
            evt.preventDefault();
        };
        document.oncut = function(evt) {
            if (!display.vm) return true;
            document.oncopy(evt, 'x');
        };
        document.onpaste = function(evt) {
            var text = evt.clipboardData.getData('Text');
            display.executeClipboardPaste(text, evt.timeStamp);
            evt.preventDefault();
        };
    }
    // touch keyboard button
    if ('ontouchstart' in document) {
        var keyboardButton = document.createElement('div');
        keyboardButton.innerHTML = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg width="50px" height="50px" viewBox="0 0 150 150" version="1.1" xmlns="http://www.w3.org/2000/svg"><g id="Page-1" stroke="none" fill="#000000"><rect x="33" y="105" width="10" height="10" rx="1"></rect><rect x="26" y="60" width="10" height="10" rx="1"></rect><rect x="41" y="60" width="10" height="10" rx="1"></rect><rect x="56" y="60" width="10" height="10" rx="1"></rect><rect x="71" y="60" width="10" height="10" rx="1"></rect><rect x="86" y="60" width="10" height="10" rx="1"></rect><rect x="101" y="60" width="10" height="10" rx="1"></rect><rect x="116" y="60" width="10" height="10" rx="1"></rect><rect x="108" y="105" width="10" height="10" rx="1"></rect><rect x="33" y="75" width="10" height="10" rx="1"></rect><rect x="48" y="75" width="10" height="10" rx="1"></rect><rect x="63" y="75" width="10" height="10" rx="1"></rect><rect x="78" y="75" width="10" height="10" rx="1"></rect><rect x="93" y="75" width="10" height="10" rx="1"></rect><rect x="108" y="75" width="10" height="10" rx="1"></rect><rect x="41" y="90" width="10" height="10" rx="1"></rect><rect x="26" y="90" width="10" height="10" rx="1"></rect><rect x="56" y="90" width="10" height="10" rx="1"></rect><rect x="71" y="90" width="10" height="10" rx="1"></rect><rect x="86" y="90" width="10" height="10" rx="1"></rect><rect x="101" y="90" width="10" height="10" rx="1"></rect><rect x="116" y="90" width="10" height="10" rx="1"></rect><rect x="48" y="105" width="55" height="10" rx="1"></rect><path d="M20.0056004,51 C18.3456532,51 17.0000001,52.3496496 17.0000001,54.0038284 L17.0000001,85.6824519 L17,120.003453 C17.0000001,121.6584 18.3455253,123 20.0056004,123 L131.9944,123 C133.654347,123 135,121.657592 135,119.997916 L135,54.0020839 C135,52.3440787 133.654475,51 131.9944,51 L20.0056004,51 Z" fill="none" stroke="#000000" stroke-width="2"></path><path d="M52.0410156,36.6054687 L75.5449219,21.6503905 L102.666016,36.6054687" id="Line" stroke="#000000" stroke-width="3" stroke-linecap="round" fill="none"></path></g></svg>';
        keyboardButton.setAttribute('style', 'position:fixed;right:0;bottom:0;background-color:rgba(128,128,128,0.5);border-radius:5px');
        canvas.parentElement.appendChild(keyboardButton);
        keyboardButton.onmousedown = function(evt) {
            canvas.contentEditable = true;
            canvas.setAttribute('autocomplete', 'off');
            canvas.setAttribute('autocorrect', 'off');
            canvas.setAttribute('autocapitalize', 'off');
            canvas.setAttribute('spellcheck', 'off');
            input.focus();
            evt.preventDefault();
        }
        keyboardButton.ontouchstart = keyboardButton.onmousedown
    }
    // do not use addEventListener, we want to replace any previous drop handler
    function dragEventHasFiles(evt) {
        for (var i = 0; i < evt.dataTransfer.types.length; i++)
            if (evt.dataTransfer.types[i] == 'Files') return true;
        return false;
    }
    document.ondragover = function(evt) {
        evt.preventDefault();
        if (!dragEventHasFiles(evt)) {
            evt.dataTransfer.dropEffect = 'none';
        } else {
            evt.dataTransfer.dropEffect = 'copy';
            recordDragDropEvent(Squeak.EventDragMove, evt, canvas, display);
        }
    };
    document.ondragenter = function(evt) {
        if (!dragEventHasFiles(evt)) return;
        recordDragDropEvent(Squeak.EventDragEnter, evt, canvas, display);
    };
    document.ondragleave = function(evt) {
        if (!dragEventHasFiles(evt)) return;
        recordDragDropEvent(Squeak.EventDragLeave, evt, canvas, display);
    };
    document.ondrop = function(evt) {
        evt.preventDefault();
        if (!dragEventHasFiles(evt)) return false;
        var files = [].slice.call(evt.dataTransfer.files),
            loaded = [],
            image, imageName = null;
        display.droppedFiles = [];
        files.forEach(function(f) {
            var path = options.root + f.name;
            display.droppedFiles.push(path);
            var reader = new FileReader();
            reader.onload = function () {
                var buffer = this.result;
                Squeak.filePut(path, buffer);
                loaded.push(path);
                if (!image && /.*image$/.test(path) && (!display.vm || confirm("Run " + f.name + " now?\n(cancel to use as file)"))) {
                    image = buffer;
                    imageName = path;
                }
                if (loaded.length == files.length) {
                    if (image) {
                        if (display.vm) {
                            display.quitFlag = true;
                            options.onQuit = function(vm, display, options) {
                                options.onQuit = null;
                                SqueakJS.appName = imageName.replace(/.*\//,'').replace(/\.image$/,'');
                                SqueakJS.runImage(image, imageName, display, options);
                            }
                        } else {
                            SqueakJS.appName = imageName.replace(/.*\//,'').replace(/\.image$/,'');
                            SqueakJS.runImage(image, imageName, display, options);
                        }
                    } else {
                        recordDragDropEvent(Squeak.EventDragDrop, evt, canvas, display);
                    }
                }
            };
            reader.readAsArrayBuffer(f);
        });
        return false;
    };

    var debounceTimeout;
    function onresize() {
        if (touch.orig) return; // manually resized
        // call resizeDone only if window size didn't change for 300ms
        var debounceWidth = window.innerWidth,
            debounceHeight = window.innerHeight;
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(function() {
            if (debounceWidth == window.innerWidth && debounceHeight == window.innerHeight)
                display.resizeDone();
            else
                onresize();
        }, 300);
        // if no fancy layout, don't bother
        if ((!options.header || !options.footer) && !options.fullscreen) {
            display.width = canvas.width;
            display.height = canvas.height;
            return;
        }
        // CSS won't let us do what we want so we will layout the canvas ourselves.
        var fullscreen = options.fullscreen || display.fullscreen,
            x = 0,
            y = fullscreen ? 0 : options.header.offsetTop + options.header.offsetHeight,
            w = window.innerWidth,
            h = fullscreen ? window.innerHeight : Math.max(100, options.footer.offsetTop - y),
            paddingX = 0, // padding outside canvas
            paddingY = 0;
        // above are the default values for laying out the canvas
        if (!options.fixedWidth) { // set canvas resolution
            if (!options.minWidth) options.minWidth = 700;
            if (!options.minHeight) options.minHeight = 700;
            var scaleW = w < options.minWidth ? options.minWidth / w : 1,
                scaleH = h < options.minHeight ? options.minHeight / h : 1,
                scale = Math.max(scaleW, scaleH);
            if (display.highdpi) scale *= window.devicePixelRatio;
            display.width = Math.floor(w * scale);
            display.height = Math.floor(h * scale);
            display.scale = w / display.width;
        } else { // fixed resolution and aspect ratio
            display.width = options.fixedWidth;
            display.height = options.fixedHeight;
            var wantRatio = display.width / display.height,
                haveRatio = w / h;
            if (haveRatio > wantRatio) {
                paddingX = w - Math.floor(h * wantRatio);
            } else {
                paddingY = h - Math.floor(w / wantRatio);
            }
            display.scale = (w - paddingX) / display.width;
        }
        // set resolution
        if (canvas.width != display.width || canvas.height != display.height) {
            var preserveScreen = options.fixedWidth || !display.resizeTodo, // preserve unless changing fullscreen
                imgData = preserveScreen && display.context.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = display.width;
            canvas.height = display.height;
            if (imgData) display.context.putImageData(imgData, 0, 0);
        }
        // set canvas and cursor canvas size, position, pixelation
        adjustCanvas(
            x + Math.floor(paddingX / 2),
            y + Math.floor(paddingY / 2),
            w - paddingX,
            h - paddingY
        );
    };

    onresize();
    window.onresize = onresize;

    return display;
}

function setupSpinner(vm, options) {
    var spinner = options.spinner;
    if (!spinner) return null;
    spinner.onmousedown = function(evt) {
        if (confirm(SqueakJS.appName + " is busy. Interrupt?"))
            vm.interruptPending = true;
    };
    return spinner.style;
}

var spinnerAngle = 0,
    becameBusy = 0;
function updateSpinner(spinner, idleMS, vm, display) {
    var busy = idleMS === 0,
        animating = vm.lastTick - display.lastTick < 500;
    if (!busy || animating) {
        spinner.display = "none";
        becameBusy = 0;
    } else {
        if (becameBusy === 0) {
            becameBusy = vm.lastTick;
        } else if (vm.lastTick - becameBusy > 1000) {
            spinner.display = "block";
            spinnerAngle = (spinnerAngle + 30) % 360;
            spinner.webkitTransform = spinner.transform = "rotate(" + spinnerAngle + "deg)";
        }
    }
}

//////////////////////////////////////////////////////////////////////////////
// main loop
//////////////////////////////////////////////////////////////////////////////

var loop; // holds timeout for main loop

SqueakJS.runImage = function(buffer, name, display, options) {
    window.onbeforeunload = function(evt) {
        var msg = SqueakJS.appName + " is still running";
        evt.returnValue = msg;
        return msg;
    };
    window.clearTimeout(loop);
    display.reset();
    display.clear();
    display.showBanner("Loading " + SqueakJS.appName);
    display.showProgress(0);
    window.setTimeout(function readImageAsync() {
        var image = new Squeak.Image(name);
        image.readFromBuffer(buffer, function startRunning() {
            display.quitFlag = false;
            var vm = new Squeak.Interpreter(image, display);
            SqueakJS.vm = vm;
            Squeak.Settings["squeakImageName"] = name;
            setupSwapButtons(options);
            display.clear();
            display.showBanner("Starting " + SqueakJS.appName);
            var spinner = setupSpinner(vm, options);
            function run() {
                try {
                    if (display.quitFlag) SqueakJS.onQuit(vm, display, options);
                    else vm.interpret(50, function runAgain(ms) {
                        if (ms == "sleep") ms = 200;
                        if (spinner) updateSpinner(spinner, ms, vm, display);
                        loop = window.setTimeout(run, ms);
                    });
                } catch(error) {
                    console.error(error);
                    alert(error);
                }
            }
            display.runNow = function() {
                window.clearTimeout(loop);
                run();
            };
            display.runFor = function(milliseconds) {
                var stoptime = Date.now() + milliseconds;
                do {
                    if (display.quitFlag) return;
                    display.runNow();
                } while (Date.now() < stoptime);
            };
            if (options.onStart) options.onStart(vm, display, options);
            run();
        },
        function readProgress(value) {display.showProgress(value);});
    }, 0);
};

function processOptions(options) {
    var search = (location.hash || location.search).slice(1),
        args = search && search.split("&");
    if (args) for (var i = 0; i < args.length; i++) {
        var keyAndVal = args[i].split("="),
            key = keyAndVal[0],
            val = true;
        if (keyAndVal.length > 1) {
            val = decodeURIComponent(keyAndVal.slice(1).join("="));
            if (val.match(/^(true|false|null|[0-9"[{].*)$/))
                try { val = JSON.parse(val); } catch(e) {
                    if (val[0] === "[") val = val.slice(1,-1).split(","); // handle string arrays
                    // if not JSON use string itself
                }
        }
        options[key] = val;
    }
    var root = Squeak.splitFilePath(options.root || "/").fullname;
    Squeak.dirCreate(root, true);
    if (!/\/$/.test(root)) root += "/";
    options.root = root;
    SqueakJS.options = options;
}

function fetchTemplates(options) {
    if (options.templates) {
        if (options.templates.constructor === Array) {
            var templates = {};
            options.templates.forEach(function(path){ templates[path] = path; });
            options.templates = templates;
        }
        for (var path in options.templates) {
            var dir = path[0] == "/" ? path : options.root + path,
                baseUrl = new URL(options.url, document.baseURI).href.split(/[?#]/)[0],
                url = Squeak.splitUrl(options.templates[path], baseUrl).full;
                if (url.endsWith("/")) url = url.slice(0,-1);
                if (url.endsWith("/.")) url = url.slice(0,-2);
            Squeak.fetchTemplateDir(dir, url);
        }
    }
}

function processFile(file, display, options, thenDo) {
    Squeak.filePut(options.root + file.name, file.data, function() {
        console.log("Stored " + options.root + file.name);
        if (file.zip) {
            processZip(file, display, options, thenDo);
        } else {
            thenDo();
        }
    });
}

function processZip(file, display, options, thenDo) {
    JSZip().loadAsync(file.data).then(function(zip) {
        var todo = [];
        zip.forEach(function(filename){
            if (!options.image.name && filename.match(/\.image$/))
                options.image.name = filename;
            if (options.forceDownload || !Squeak.fileExists(options.root + filename)) {
                todo.push(filename);
            } else if (options.image.name === filename) {
                // image exists, need to fetch it from storage
                var _thenDo = thenDo;
                thenDo = function() {
                    Squeak.fileGet(options.root + filename, function(data) {
                        options.image.data = data;
                        return _thenDo();
                    }, function onError() {
                        Squeak.fileDelete(options.root + file.name);
                        return processZip(file, display, options, _thenDo);
                    });
                }
            }
        });
        if (todo.length === 0) return thenDo();
        var done = 0;
        display.showBanner("Unzipping " + file.name);
        display.showProgress(0);
        todo.forEach(function(filename){
            console.log("Inflating " + file.name + ": " + filename);
            function progress(x) { display.showProgress((x.percent / 100 + done) / todo.length); }
            zip.file(filename).async("arraybuffer", progress).then(function(buffer){
                console.log("Expanded size of " + filename + ": " + buffer.byteLength);
                var unzipped = {};
                if (options.image.name === filename)
                    unzipped = options.image;
                unzipped.name = filename;
                unzipped.data = buffer;
                processFile(unzipped, display, options, function() {
                    if (++done === todo.length) thenDo();
                });
            });
        });
    });
}

function checkExisting(file, display, options, ifExists, ifNotExists) {
    if (!Squeak.fileExists(options.root + file.name))
        return ifNotExists();
    if (file.image || file.zip) {
        // if it's the image or a zip, load from file storage
        Squeak.fileGet(options.root + file.name, function(data) {
            file.data = data;
            if (file.zip) processZip(file, display, options, ifExists);
            else ifExists();
        }, function onError() {
            // if error, download it
            Squeak.fileDelete(options.root + file.name);
            return ifNotExists();
        });
    } else {
       // for all other files assume they're okay
       ifExists();
    }
}

function downloadFile(file, display, options, thenDo) {
    display.showBanner("Downloading " + file.name);
    var rq = new XMLHttpRequest(),
        proxy = options.proxy || "";
    rq.open('GET', proxy + file.url);
    if (options.ajax) rq.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    rq.responseType = 'arraybuffer';
    rq.onprogress = function(e) {
        if (e.lengthComputable) display.showProgress(e.loaded / e.total);
    };
    rq.onload = function(e) {
        if (this.status == 200) {
            file.data = this.response;
            processFile(file, display, options, thenDo);
        }
        else this.onerror(this.statusText);
    };
    rq.onerror = function(e) {
        if (options.proxy) {
            console.error(Squeak.bytesAsString(new Uint8Array(this.response)));
            return alert("Failed to download:\n" + file.url);
        }
        console.warn('Retrying with CORS proxy: ' + file.url);
        var proxy = 'https://corsproxy.io/?',
            retry = new XMLHttpRequest();
        retry.open('GET', proxy + file.url);
        if (options.ajax) retry.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        retry.responseType = rq.responseType;
        retry.onprogress = rq.onprogress;
        retry.onload = rq.onload;
        retry.onerror = function() {
            console.error(Squeak.bytesAsString(new Uint8Array(this.response)));
            alert("Failed to download:\n" + file.url)};
        retry.send();
    };
    rq.send();
}

function fetchFiles(files, display, options, thenDo) {
    // check if files exist locally and download if nessecary
    function getNextFile() {
        if (files.length === 0) return thenDo();
        var file = files.shift(),
            forceDownload = options.forceDownload || file.forceDownload;
        if (forceDownload) downloadFile(file, display, options, getNextFile);
        else checkExisting(file, display, options,
            function ifExists() {
                getNextFile();
            },
            function ifNotExists() {
                downloadFile(file, display, options, getNextFile);
            });
    }
    getNextFile();
}

SqueakJS.runSqueak = function(imageUrl, canvas, options) {
    // we need to fetch all files first, then run the image
    processOptions(options);
    if (!imageUrl && options.image) imageUrl = options.image;
    var baseUrl = options.url || "";
    if (!baseUrl && imageUrl && imageUrl.replace(/[^\/]*$/, "")) {
        baseUrl = imageUrl.replace(/[^\/]*$/, "");
        imageUrl = imageUrl.replace(/^.*\//, "");
    }
    options.url = baseUrl;
    if (baseUrl[0] === "/" && baseUrl[1] !== "/" && baseUrl.length > 1 && options.root === "/") {
        options.root = baseUrl;
    }
    fetchTemplates(options);
    var display = createSqueakDisplay(canvas, options),
        image = {url: null, name: null, image: true, data: null},
        files = [];
    display.argv = options.argv;
    if (imageUrl) {
        var url = Squeak.splitUrl(imageUrl, baseUrl);
        image.url = url.full;
        image.name = url.filename;
    }
    if (options.files) {
        options.files.forEach(function(f) {
            var url = Squeak.splitUrl(f, baseUrl);
            if (image.name === url.filename) {/* pushed after other files */}
            else if (!image.url && f.match(/\.image$/)) {
                image.name = url.filename;
                image.url = url.full;
            } else {
                files.push({url: url.full, name: url.filename});
            }
        });
    }
    if (options.zip) {
        var zips = typeof options.zip === "string" ? [options.zip] : options.zip;
        zips.forEach(function(zip) {
            var url = Squeak.splitUrl(zip, baseUrl);
            files.push({url: url.full, name: url.filename, zip: true});
        });
    }
    if (image.url) files.push(image);
    if (options.document) {
        var url = Squeak.splitUrl(options.document, baseUrl);
        files.push({url: url.full, name: url.filename, forceDownload: options.forceDownload !== false});
        display.documentName = options.root + url.filename;
    }
    options.image = image;
    fetchFiles(files, display, options, function thenDo() {
        Squeak.fsck(); // will run async
        var image = options.image;
        if (!image.name) return alert("could not find an image");
        if (!image.data) return alert("could not find image " + image.name);
        SqueakJS.appName = options.appName || image.name.replace(/\.image$/, "");
        SqueakJS.runImage(image.data, options.root + image.name, display, options);
    });
    return display;
};

SqueakJS.quitSqueak = function() {
    SqueakJS.vm.quitFlag = true;
};

SqueakJS.onQuit = function(vm, display, options) {
    window.onbeforeunload = null;
    display.vm = null;
    if (options.spinner) options.spinner.style.display = "none";
    if (options.onQuit) options.onQuit(vm, display, options);
    else display.showBanner(SqueakJS.appName + " stopped.");
};

//////////////////////////////////////////////////////////////////////////////
// browser stuff
//////////////////////////////////////////////////////////////////////////////

if (window.applicationCache) {
    applicationCache.addEventListener('updateready', function() {
        // use original appName from options
        var appName = window.SqueakJS && SqueakJS.options && SqueakJS.options.appName || "SqueakJS";
        if (confirm(appName + ' has been updated. Restart now?')) {
            window.onbeforeunload = null;
            window.location.reload();
        }
    });
}
