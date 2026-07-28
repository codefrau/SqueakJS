// Generic SqueakJS Web Worker entry point (ES module). Runs the VM OFF the main thread,
// rendering to an OffscreenCanvas and receiving input via postMessage, so the page stays
// responsive (no freeze / no "ruedita") and the VM gets a dedicated core.
//
// Used by run/ (#worker mode) and the perf/worker spike. All config arrives in the
// "init" message: { canvas, width, height, image, name?, templates?, headRoom?, nostream? }
// where `image` is either an ArrayBuffer (the .image bytes) or a URL string to fetch,
// and `templates` is an optional { root, url } to preload app files (Etoys/Scratch/etc.).
//
// Shims: a worker has `self` but no window/document/localStorage/prompt/alert/confirm.
// The VM core only uses `self`; file plugins use window/localStorage → point them at self
// (indexedDB works in workers). prompt/confirm return null so the low-space path signals
// the image gracefully instead of throwing; alert goes to the console.
self.window = self;
self.localStorage = {};
self.prompt = function() { return null; };
self.confirm = function() { return false; };
self.alert = function(msg) { console.warn("[squeak alert]", msg); };

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
import "./vm.display.js";
import "./vm.display.browser.js"; // display primitives (scanCharacters etc.); DOM/render bits overridden below
import "./vm.input.js";
import "./vm.plugins.js";
import "./vm.plugins.file.browser.js";
import "./vm.plugins.fileattributes.browser.js"; // Pharo FileSystem stat/exists/dir (maps to the virtual FS)
import "./vm.plugins.drop.browser.js"; // primitiveDropRequestFileName/Handle (read dropped files)
import "./vm.files.browser.js";
import "./plugins/BitBltPlugin.js";
import "./plugins/LargeIntegers.js";
import "./plugins/MiscPrimitivePlugin.js";
import "./plugins/FloatArrayPlugin.js";
import "./plugins/B2DPlugin.js";
import "./plugins/Matrix2x3Plugin.js";
import "./plugins/ZipPlugin.js";
import "./plugins/SocketPlugin.js"; // Pharo checks NetNameResolver status at startup (WebSocket-backed; works in a worker)
import "./vm.plugins.jpeg2.browser.js"; // defines the jpeg2_* functions (module is builtin but empty without this)

var display = null, ctx = null, vm = null, downloadOnSave = false;

// Download-on-save: when the image closes a file it just wrote to its working (image)
// directory, hand the bytes to the host so it downloads them into the user's Downloads
// folder — turning Dialogo's "guardar" (which writes to the inaccessible image dir) into
// a real, reachable save. Enabled via the init option so it stays off for the
// template-based spike. Squeak internals and files inside subfolders are skipped.
var _origFileClose = Squeak.Primitives.prototype.fileClose;
Squeak.Primitives.prototype.fileClose = function(file) {
    if (downloadOnSave && file && file.modified && file.contents) {
        if (fileShouldDownload(file.name)) {
            try {
                var n = file.size || file.contents.length, copy = file.contents.slice(0, n);
                console.log("[save→download] " + file.name + " (" + n + " bytes)");
                self.postMessage({ type: "download", name: file.name.replace(/.*\//, ""), bytes: copy.buffer }, [copy.buffer]);
            } catch (e) { console.warn("download-on-save failed for " + file.name, e); }
        } else {
            console.log("[save: not downloading] " + file.name);
        }
    }
    return _origFileClose.apply(this, arguments);
};
function fileShouldDownload(path) {
    var lower = (path || "").toLowerCase();
    if (/\.(image|changes|sources|pref|prefs|log)$/.test(lower)) return false; // Squeak internals
    if (/squeakdebug|\.lnk$/i.test(path)) return false;
    var rel = path.replace(/^\/+/, "");
    return rel.indexOf("/") < 0; // only the image/working dir (root), not subfolders/templates
}

// --- display + input backend for the worker ---
// Most of vm.display.browser.js's display primitives are already worker-safe: their DOM
// branches are guarded by this.display.cursorCanvas / fullscreenRequest / highdpi (which
// we never set), and they render to the OffscreenCanvas via this.display.context (the
// showForm/showDisplayBits path). So we don't reimplement them — the real
// deferDisplayUpdates batching runs. We only override what genuinely touches DOM/audio
// (beep/clipboard, screenDepth which is headless-only) and INPUT: in the browser it
// arrives via DOM listeners; here it arrives via postMessage → an event queue.
Object.extend(Squeak.Primitives.prototype, "worker-display", {
    primitiveScreenDepth: function(argCount) { return this.popNandPushIfOK(argCount + 1, 32); },
    primitiveBeep: function(argCount) { this.vm.popN(argCount); return true; },
    // Clipboard bridged to the main thread (navigator.clipboard is main-thread + gesture
    // only). Copy: the image writes text → we post it to the host, which writes the system
    // clipboard. Paste: on a cmd-V gesture the host reads the system clipboard and pushes it
    // into display.clipboardString (see onmessage "clipboard-set") before the keystroke
    // reaches the image, so this read returns the fresh value synchronously.
    primitiveClipboardText: function(argCount) {
        if (argCount === 0) { // read (paste)
            if (typeof display.clipboardString !== "string") return false;
            this.vm.popNandPush(1, this.makeStString(display.clipboardString));
        } else { // write (copy)
            var stringObj = this.vm.top();
            if (stringObj.bytes) {
                display.clipboardString = stringObj.bytesAsString();
                self.postMessage({ type: "clipboard-write", text: display.clipboardString });
            }
            this.vm.pop();
        }
        return true;
    },
    // Image-managed cursor (desktop parity): render the cursor form to an OffscreenCanvas
    // with showForm and post the ImageBitmap + hotspot to the main thread, which sets it
    // as a native CSS cursor (url(...) hotX hotY) — hardware-drawn, perfect tracking, no
    // overlay. Squeak's form offset is negative (added to the mouse pos) → CSS hotspot is
    // -offset, clamped into the image.
    primitiveBeCursor: function(argCount) {
        try {
            var cursorForm = this.loadForm(this.stackNonInteger(argCount), true),
                maskForm = argCount === 1 ? this.loadForm(this.stackNonInteger(0)) : null;
            if (this.success && cursorForm) {
                var w = cursorForm.width, h = cursorForm.height,
                    oc = new OffscreenCanvas(w, h), octx = oc.getContext("2d"),
                    bounds = { left: 0, top: 0, right: w, bottom: h }, form = cursorForm;
                if (form.depth === 1) {
                    if (maskForm) { form = this.cursorMergeMask(form, maskForm);
                        this.showForm(octx, form, bounds, [0x00000000, 0xFF0000FF, 0xFFFFFFFF, 0xFF000000]);
                    } else this.showForm(octx, form, bounds, [0x00000000, 0xFF000000]);
                } else this.showForm(octx, form, bounds, true);
                var bmp = oc.transferToImageBitmap();
                self.postMessage({ type: "cursor", bitmap: bmp,
                    hotX: Math.max(0, Math.min(w - 1, -(form.offsetX | 0))),
                    hotY: Math.max(0, Math.min(h - 1, -(form.offsetY | 0))) }, [bmp]);
            }
        } catch (e) { /* if it fails, keep the previous cursor */ }
        this.vm.popN(argCount);
        return true;
    },
    // input
    primitiveInputSemaphore: function(argCount) {
        var idx = this.stackInteger(0); if (!this.success) return false;
        this.inputEventSemaIndex = idx;
        display.signalInputEvent = function() { this.signalSemaphoreWithIndex(this.inputEventSemaIndex); }.bind(this);
        return this.popNIfOK(argCount);
    },
    primitiveInputWord: function(argCount) { return this.popNandPushIfOK(1, 0); },
    primitiveGetNextEvent: function(argCount) {
        var evtBuf = this.stackNonInteger(0).pointers;
        var evt = display.eventQueue.shift();
        if (evt) { evtBuf[0] = evt[0]; evtBuf[1] = evt[1] & 0x1FFFFFFF; for (var i = 2; i < evt.length; i++) evtBuf[i] = evt[i]; }
        else evtBuf[0] = 0;
        return this.popNIfOK(argCount);
    },
    primitiveMouseButtons: function(argCount) { return this.popNandPushIfOK(argCount + 1, this.ensureSmallInt(display.buttons | 0)); },
    primitiveMousePoint: function(argCount) { return this.popNandPushIfOK(argCount + 1, this.makePointWithXandY(display.mouseX | 0, display.mouseY | 0)); },
    primitiveKeyboardNext: function(argCount) { return this.popNandPushIfOK(argCount + 1, display.keys.length ? this.ensureSmallInt(display.keys.shift()) : this.vm.nilObj); },
    primitiveKeyboardPeek: function(argCount) { return this.popNandPushIfOK(argCount + 1, display.keys.length ? this.ensureSmallInt(display.keys[0]) : this.vm.nilObj); },
});

// Worker-safe JPEG: jpeg2.browser decodes with `new Image()` + a DOM <canvas>, neither of
// which exists in a worker. Override just the 2 DOM read functions with createImageBitmap
// (the browser's native JPEG decoder, available in workers) + OffscreenCanvas. The rest of
// the plugin (async freeze, copyPixelsToForm*) is pure JS and reused as-is.
Object.extend(Squeak.Primitives.prototype, "jpeg2-worker-overrides", {
    jpeg2_readImageFromBytes: function(bytes, thenDo, errorDo) {
        createImageBitmap(new Blob([bytes], { type: "image/jpeg" }))
            .then(function(bmp) { thenDo(bmp); })
            .catch(function() { errorDo(); });
    },
    jpeg2_getPixelsFromImage: function(image) {
        var canvas = new OffscreenCanvas(image.width, image.height),
            context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
    },
});

// Audio output: a worker has no AudioContext (Web Audio is main-thread only). We keep the
// sound plugin's double-buffer bookkeeping here (so availableSpace/the sema still gate the
// image) and stream the samples to the main thread, which plays them via Web Audio and
// posts "sound-done" back when a buffer drains — releasing a slot and signaling the sema.
// (Defining snd_* is enough; the SoundPlugin module is discovered by scanning for snd_.)
Object.extend(Squeak.Primitives.prototype, "worker-sound", {
    snd_primitiveSoundStart: function(argCount) { return this.snd_primitiveSoundStartWithSemaphore(argCount); },
    snd_primitiveSoundStartWithSemaphore: function(argCount) {
        var bufFrames = this.stackInteger(argCount - 1),
            samplesPerSec = this.stackInteger(argCount - 2),
            stereoFlag = this.stackBoolean(argCount - 3),
            semaIndex = argCount > 3 ? this.stackInteger(argCount - 4) : 0;
        if (!this.success) return false;
        this.audioSema = semaIndex;
        this.audioChannels = stereoFlag ? 2 : 1;
        this.audioBufBytes = bufFrames * this.audioChannels * 2; // int16 → bytes (for availableSpace)
        this.audioUnused = 2; // double-buffered, same as the browser plugin
        self.postMessage({ type: "sound-start", bufFrames: bufFrames, samplesPerSec: samplesPerSec, channels: this.audioChannels });
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundAvailableSpace: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.audioUnused > 0 ? this.audioBufBytes : 0);
    },
    snd_primitiveSoundPlaySamples: function(argCount) {
        if (!this.audioUnused) return false;
        var count = this.stackInteger(2),
            sqSamples = this.stackNonInteger(1).wordsAsInt16Array(),
            startIndex = this.stackInteger(0) - 1;
        if (!this.success || !sqSamples) return false;
        var n = count * this.audioChannels, out = new Int16Array(n); // interleaved L,R,L,R…
        for (var i = 0; i < n; i++) out[i] = sqSamples[startIndex + i];
        this.audioUnused--;
        self.postMessage({ type: "sound-play", samples: out.buffer, count: count, channels: this.audioChannels }, [out.buffer]);
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundPlaySilence: function(argCount) {
        if (!this.audioUnused) return false;
        var count = (this.audioBufBytes / (this.audioChannels * 2)) | 0;
        this.audioUnused--;
        self.postMessage({ type: "sound-play", silence: true, count: count, channels: this.audioChannels });
        return this.popNandPushIfOK(argCount + 1, count);
    },
    snd_primitiveSoundStop: function(argCount) {
        this.audioUnused = 0; this.audioSema = 0;
        self.postMessage({ type: "sound-stop" });
        return this.popNIfOK(argCount);
    },
});

self.onmessage = function(e) {
    var msg = e.data;
    if (msg.type === "init") {
        ctx = msg.canvas.getContext("2d");
        // tell the host when the image actually paints its first frame — it keeps a
        // loading overlay up until then (big images render a long time after "ready")
        var firstFramePosted = false;
        ["putImageData", "drawImage"].forEach(function(m) {
            var orig = ctx[m].bind(ctx);
            ctx[m] = function() {
                if (!firstFramePosted) { firstFramePosted = true; self.postMessage({ type: "first-frame" }); }
                return orig.apply(null, arguments);
            };
        });
        // context: used by vm.display.browser.js's render path (showForm/showDisplayBits)
        display = { width: msg.width, height: msg.height, context: ctx, mouseX: msg.width >> 1, mouseY: msg.height >> 1,
                    buttons: 0, keys: [], eventQueue: [], signalInputEvent: null, clipboardString: "" };
        // The FilePlugin keeps its DIRECTORY structure in localStorage (Squeak.Settings),
        // but a worker has no localStorage — so the host passes it in and we seed it here.
        // (File CONTENTS live in IndexedDB, which is shared across the origin, so those
        // come through on their own.) Without this the worker sees an empty FS → no saved
        // projects. We remember it as the baseline for change detection on sync-back.
        if (msg.settings) {
            Object.assign(Squeak.Settings, msg.settings);
            console.log("squeak_worker: seeded FS with " + Object.keys(Squeak.Settings).filter(function(k){ return k.indexOf("squeak:") === 0; }).length + " directory entries from host");
        }
        downloadOnSave = !!msg.downloadOnSave;
        boot(msg);
    } else if (msg.type === "event") {
        var ev = msg.ev;
        if (ev[0] === 1) { display.mouseX = ev[2]; display.mouseY = ev[3]; display.buttons = ev[4]; }
        else if (ev[0] === 2) display.keys.push((ev[4] << 8) | ev[2]); // keyboard: also feed the polling interface (Sensor, for modals)
        else if (ev[0] === 3) { display.mouseX = ev[3]; display.mouseY = ev[4]; } // drag: [3,ts,type,x,y,...] → update pointer pos
        display.eventQueue.push(ev);
        if (display.signalInputEvent) display.signalInputEvent();
    } else if (msg.type === "resize") {
        // window resized: change the display resolution; the image picks up the new screen
        // size on its next display cycle and relayouts (or letterboxes, its choice).
        display.width = msg.width; display.height = msg.height;
        ctx.canvas.width = msg.width; ctx.canvas.height = msg.height;
    } else if (msg.type === "drop") {
        // files were stored in the shared IndexedDB by the host; merge their new directory
        // entries so the image can open them, expose the paths in display.droppedFiles, and
        // queue the drop event. The image decides whether to load or reject each file
        // (via primitiveDropRequestFileName/Handle) — exactly like the desktop VM.
        if (msg.settings) Object.assign(Squeak.Settings, msg.settings);
        display.droppedFiles = msg.files;
        display.eventQueue.push(msg.ev);
        if (display.signalInputEvent) display.signalInputEvent();
    } else if (msg.type === "clipboard-set") {
        display.clipboardString = typeof msg.text === "string" ? msg.text : "";
    } else if (msg.type === "sound-done") {
        // the main thread finished playing a buffer → free a slot and wake the image
        var ph = vm && vm.primHandler;
        if (ph && ph.audioUnused != null) {
            if (ph.audioUnused < 2) ph.audioUnused++;
            if (ph.audioSema) ph.signalSemaphoreWithIndex(ph.audioSema);
            vm.forceInterruptCheck();
        }
    }
};

var BUILD = "squeak_worker v1";
function boot(opts) {
    Object.extend(Squeak, { vmPath: "/", platformSubtype: "Worker", osVersion: "worker", windowSystem: "worker" });
    // Optional app template files (Etoys/Scratch/Dialogo): lazy XHR into the worker FS.
    var useTemplates = !!(opts.templates && opts.templates.url);
    if (useTemplates) Squeak.fetchTemplateDir(opts.templates.root || "/", opts.templates.url);
    // image can be ArrayBuffer bytes (from the launcher's IndexedDB) or a URL string.
    var getData = typeof opts.image === "string"
        ? fetch(opts.image).then(function(r) { return r.arrayBuffer(); })
        : Promise.resolve(opts.image);
    getData.then(function(data) {
        var intervalsStarted = false, triedNoJit = false;
        function startIntervals() {
            if (intervalsStarted) return; intervalsStarted = true;
            // No separate render timer: rendering is driven by the real displayDirty →
            // showForm path (respects Morphic's deferDisplayUpdates, no mid-draw frames →
            // no flicker). This interval only posts status.
            setInterval(function() { if (vm) self.postMessage({ type: "tick", sends: vm.sendCount }); }, 250);
            // Persist FS changes back to the host: the worker's directory updates live in its
            // in-memory Squeak.Settings (no real localStorage), so files it creates would be
            // orphaned in IndexedDB after a reload. Send the settings snapshot on change.
            var lastSettings = "";
            setInterval(function() {
                var snap = {};
                for (var k in Squeak.Settings) if (typeof Squeak.Settings[k] === "string") snap[k] = Squeak.Settings[k];
                var ser = JSON.stringify(snap);
                if (ser !== lastSettings) { lastSettings = ser; self.postMessage({ type: "settings", settings: snap }); }
            }, 700);
        }
        function startVM(noJit) {
            var image = new Squeak.Image(opts.name || "SqueakJS");
            // More headroom than the 100MB default: opening a big project spikes transient
            // allocation; 512MB lets the peak fit and the GC reclaim it (only a threshold).
            image.headRoom = opts.headRoom || 512000000;
            image.readFromBuffer(data, function() {
                vm = new Squeak.Interpreter(image, display);
                if (noJit || opts.nojit) vm.compiler = null;
                if (opts.nostream) vm.primHandler.streamPrims = false; // A/B: disable stream prims 65/66/67
                self.postMessage({ type: "ready", build: BUILD });
                startIntervals();
                function run() {
                    try { vm.interpret(50, function(ms) { setTimeout(run, ms === "sleep" ? 10 : ms); }); }
                    catch (err) {
                        var msg = String(err && err.stack || err);
                        // jit1 mishandles some Sista bytecodes (e.g. Cuis 7.x). The failure
                        // surfaces differently per engine: V8 raises "invalid PC" later in the
                        // interpreter, while SpiderMonkey (Firefox) throws straight out of the
                        // generated function (stack points into jit.js). Treat either as a JIT
                        // fault and re-run the image once without the JIT — the plain
                        // interpreter handles every bytecode set correctly (images that work
                        // with the JIT keep it).
                        var jitFault = /invalid PC/.test(msg) || /jit\.js/.test(msg);
                        if (jitFault && !triedNoJit && !(noJit || opts.nojit)) {
                            triedNoJit = true;
                            console.warn("squeak_worker: JIT fault (" + msg.split("\n")[0] + "), restarting without JIT");
                            return startVM(true);
                        }
                        self.postMessage({ type: "error", msg: msg });
                    }
                }
                run();
            });
        }
        // When using templates, wait a beat so the template XHRs register the directory
        // structure before the image enumerates its projects at startup (avoids a race).
        setTimeout(function() { startVM(false); }, useTemplates ? 800 : 0);
    }).catch(function(err) { self.postMessage({ type: "error", msg: "load: " + err }); });
}
