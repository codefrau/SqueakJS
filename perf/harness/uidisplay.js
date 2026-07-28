"use strict";
// Display+input headless "que mide" para el oráculo diferencial.
//
// El display headless normal (vm.display.headless.js) reporta que NO hay
// pantalla (primitiveScreenSize devuelve false) y no entrega eventos, así que
// la imagen se cierra al arrancar (por eso existe -ignoreQuit) y el oráculo
// solo cubría el boot-hasta-quit. Esta variante reporta una pantalla real
// (offscreen), acepta el Display form y entrega eventos desde una cola, de modo
// que el World de Morphic LEVANTA y corre su loop: BitBlt dibuja al Display Form
// en memoria de objetos (no hace falta canvas). Con eso el oráculo ejercita el
// código interactivo — el mismo donde crashea el browser — y podemos hashear los
// bits del dibujo como fingerprint de estado final (idéntico en browser).
//
// install(Squeak, {width, height}) parchea Squeak.Primitives.prototype con las
// versiones "que miden" (ganan sobre las headless requeridas antes) y devuelve
// el objeto display para pasar al Interpreter. Llamar SOLO en modo --ui: el
// parche del prototipo es global.

var EventTypeNone = 0;

function makeDisplayObject(width, height) {
    var display = {
        width: width,
        height: height,
        // el cursor arranca en el centro
        mouseX: width >> 1,
        mouseY: height >> 1,
        buttons: 0,
        keys: [],
        eventQueue: [],       // [ [type, ms, ...campos], ... ] en dominio de reloj del VM
        signalInputEvent: null, // seteado por primitiveInputSemaphore
        idle: 0,
        deferDisplayUpdates: false,
        damage: null,         // {l,t,r,b} acumulado por showDisplayRect (para saber si dibujó)
        vmOptions: ["-headless"],
    };
    display.getNextEvent = function(evtBuf, timeOffset) {
        var evt = display.eventQueue.shift();
        if (!evt) { evtBuf[0] = EventTypeNone; return; }
        evtBuf[0] = evt[0];
        // los timestamps ya están en el dominio de reloj del VM; sin offset
        evtBuf[1] = (evt[1] - 0) & 0x1FFFFFFF; // MillisecondClockMask
        for (var i = 2; i < evt.length; i++) evtBuf[i] = evt[i];
    };
    return display;
}

function install(Squeak, opts) {
    opts = opts || {};
    var width = opts.width || 1024, height = opts.height || 768;
    var display = makeDisplayObject(width, height);

    Object.extend(Squeak.Primitives.prototype, "measuring-display", {
        // --- display ---
        primitiveScreenSize: function(argCount) {
            return this.popNandPushIfOK(argCount + 1, this.makePointWithXandY(this.display.width, this.display.height));
        },
        primitiveScreenDepth: function(argCount) {
            return this.popNandPushIfOK(argCount + 1, 32);
        },
        primitiveScreenScaleFactor: function(argCount) {
            return this.popNandPushIfOK(argCount + 1, 1);
        },
        primitiveBeDisplay: function(argCount) {
            var displayObj = this.vm.stackValue(0);
            this.vm.specialObjects[Squeak.splOb_TheDisplay] = displayObj;
            this.vm.popN(argCount); // return self
            return true;
        },
        primitiveReverseDisplay: function(argCount) { return true; },
        primitiveDeferDisplayUpdates: function(argCount) {
            var flag = this.stackBoolean(0);
            if (!this.success) return false;
            this.display.deferDisplayUpdates = flag;
            this.vm.popN(argCount);
            return true;
        },
        primitiveForceDisplayUpdate: function(argCount) {
            this.vm.popN(argCount);
            return true;
        },
        primitiveShowDisplayRect: function(argCount) {
            // registrar el rect como "dibujado" (BitBlt ya escribió al Display Form
            // en memoria); no hay canvas al que copiar
            var d = this.display;
            var r = { l: this.stackInteger(3), t: this.stackInteger(1), r: this.stackInteger(2), b: this.stackInteger(0) };
            if (this.success) {
                if (!d.damage) d.damage = { l: r.l, t: r.t, r: r.r, b: r.b };
                else { d.damage.l = Math.min(d.damage.l, r.l); d.damage.t = Math.min(d.damage.t, r.t);
                       d.damage.r = Math.max(d.damage.r, r.r); d.damage.b = Math.max(d.damage.b, r.b); }
            }
            this.vm.popN(argCount);
            return true;
        },
        primitiveSetFullScreen: function(argCount) { this.vm.popN(argCount); return true; },
        primitiveTestDisplayDepth: function(argCount) {
            // responder true para las profundidades que soporta el image (todas acá)
            return this.popNandPushIfOK(argCount + 1, this.vm.trueObj);
        },

        // --- input ---
        primitiveInputSemaphore: function(argCount) {
            var semaIndex = this.stackInteger(0);
            if (!this.success) return false;
            this.inputEventSemaIndex = semaIndex;
            this.display.signalInputEvent = function() {
                this.signalSemaphoreWithIndex(this.inputEventSemaIndex);
            }.bind(this);
            return this.popNIfOK(argCount);
        },
        primitiveInputWord: function(argCount) { return this.popNandPushIfOK(1, 0); },
        primitiveGetNextEvent: function(argCount) {
            this.display.idle++;
            var evtBuf = this.stackNonInteger(0);
            this.display.getNextEvent(evtBuf.pointers, this.vm.startupTime);
            return this.popNIfOK(argCount);
        },
        primitiveMouseButtons: function(argCount) {
            this.popNandPushIfOK(argCount + 1, this.ensureSmallInt(this.display.buttons));
            if (this.display.idle++ > 20) this.vm.goIdle();
            return true;
        },
        primitiveMousePoint: function(argCount) {
            return this.popNandPushIfOK(argCount + 1,
                this.makePointWithXandY(this.ensureSmallInt(this.display.mouseX), this.ensureSmallInt(this.display.mouseY)));
        },
        primitiveKeyboardNext: function(argCount) {
            return this.popNandPushIfOK(argCount + 1,
                this.display.keys.length ? this.ensureSmallInt(this.display.keys.shift()) : this.vm.nilObj);
        },
        primitiveKeyboardPeek: function(argCount) {
            return this.popNandPushIfOK(argCount + 1,
                this.display.keys.length ? this.ensureSmallInt(this.display.keys[0] || 0) : this.vm.nilObj);
        },
        primitiveBeep: function(argCount) { return true; },
        primitiveClipboardText: function(argCount) { return false; },
    });

    return display;
}

// Hash FNV-1a de los bits del Display Form (fingerprint del dibujo).
// Devuelve {hash, nonzero, w, h, depth} o null si no hay Display todavía.
function displayFingerprint(vm) {
    var disp = vm.specialObjects[Squeak.splOb_TheDisplay];
    if (!disp || disp.isNil || !disp.pointers) return null;
    // DisplayScreen/Form: pointers = [bits, width, height, depth, ...]
    var bits = disp.pointers[0];
    var w = disp.pointers[1], h = disp.pointers[2], depth = disp.pointers[3];
    if (!bits || !bits.words) return { hash: "nobits", nonzero: 0, w: w, h: h, depth: depth };
    var words = bits.words;
    var hash = 2166136261 >>> 0, nonzero = 0;
    for (var i = 0; i < words.length; i++) {
        var v = words[i] >>> 0;
        if (v !== 0) nonzero++;
        hash = (hash ^ (v & 0xffff)) >>> 0; hash = Math.imul(hash, 16777619) >>> 0;
        hash = (hash ^ (v >>> 16)) >>> 0; hash = Math.imul(hash, 16777619) >>> 0;
    }
    return { hash: hash.toString(16), nonzero: nonzero, words: words.length, w: w, h: h, depth: depth };
}

// Constantes de evento (espejo de Squeak.events / vm.input.js)
var Ev = {
    Mouse: 1, Keyboard: 2,
    Red: 4, Yellow: 2, Blue: 1,       // botones
    Shift: 8, Ctrl: 16, Alt: 32, Cmd: 64,
    KeyChar: 0, KeyDown: 1, KeyUp: 2,
};

// Script sintético de interacción, agendado por sendCount (determinista e
// idéntico entre representaciones). No apunta a botones concretos de Dialogo
// (no conocemos su layout) pero ejercita la maquinaria interactiva pesada que
// el boot estático nunca toca: tracking del hand, hit-testing de morphs,
// cursor, drag (down→move→up) y teclado. Para "dibujar" con coordenadas reales,
// pasar --events con una traza grabada del browser.
//   from/to: ventana de sendCount donde ocurre la interacción
//   devuelve [ {at, ev:[type, tsPlaceholder, ...]}, ... ] ordenado por at
function syntheticScript(width, height, from, to) {
    var sched = [];
    var span = Math.max(1, to - from);
    var cx = width >> 1, cy = height >> 1;
    var t = from;
    var step = Math.max(1, Math.floor(span / 64));
    function moveTo(x, y, buttons) { sched.push({ at: t, ev: [Ev.Mouse, 0, x | 0, y | 0, buttons | 0, 0] }); t += step; }
    // 1) barrido diagonal (hand tracking + hit-test en toda la pantalla)
    for (var i = 0; i <= 16; i++) moveTo(50 + (width - 100) * i / 16, 50 + (height - 100) * i / 16, 0);
    // 2) mover al centro y hacer click (down/up) — dispara menús/halos según el morph
    moveTo(cx, cy, 0);
    moveTo(cx, cy, Ev.Red);                  // mouse down (botón izquierdo)
    moveTo(cx, cy, 0);                        // mouse up
    // 3) drag: down, arrastrar en L, up (maquinaria de drag/pickup)
    moveTo(cx - 200, cy - 100, Ev.Red);
    for (var j = 1; j <= 12; j++) moveTo(cx - 200 + j * 30, cy - 100, Ev.Red);
    for (var k = 1; k <= 8; k++) moveTo(cx + 160, cy - 100 + k * 25, Ev.Red);
    moveTo(cx + 160, cy + 100, 0);           // soltar
    // 4) teclado: unas teclas (macRoman == unicode para ASCII)
    "hola".split("").forEach(function(ch) {
        var u = ch.charCodeAt(0);
        sched.push({ at: t, ev: [Ev.Keyboard, 0, u, Ev.KeyChar, 0, u] }); t += step;
    });
    return sched;
}

module.exports = {
    install: install, displayFingerprint: displayFingerprint,
    EventTypeNone: EventTypeNone, syntheticScript: syntheticScript, Ev: Ev,
};
