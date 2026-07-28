"use strict";
// Spike fase 0 del diseño stack-zone (ver ../stack-zone-design.md).
// Tres variantes JS del mismo benchmark fib-por-sends, para aislar dos efectos:
//   V1: contexts heap + trampolín       ≈ arquitectura actual (jit.js + vm.interpreter.js)
//   V2: frames planos + trampolín       ≈ jit.js con stack zone (camino JS incremental)
//   V3: frames planos + intérprete de bytecodes  ≈ intérprete fase-1 (espejo del WASM V4)
// Todas hacen el mismo trabajo por send: probe de cache de métodos, chequeo de clase
// del receiver, contador de interrupciones, y (V2/V3) chequeo de hasContext al retornar.

const SEL_FIB = 7;
const CLASS_SMALLINT = 99;
const CLASS_FIB = 5;
const METH_FIB = 1;
const CACHE_MASK = 511;

function makeCache() {
    // direct-mapped: [checkWord, methodId] × 512
    const cache = new Int32Array((CACHE_MASK + 1) * 2);
    return cache;
}

function cacheLookup(cache, classId, selId) {
    const k = ((classId ^ (selId * 31)) & CACHE_MASK) << 1;
    const check = (classId << 8) | selId;
    if (cache[k] === check) return cache[k + 1];
    // slow path: "búsqueda" y fill (en el bench siempre encuentra METH_FIB)
    cache[k] = check;
    cache[k + 1] = METH_FIB;
    return METH_FIB;
}

// ---------------------------------------------------------------------------
// V1: contexts heap + trampolín (modela la arquitectura actual)
// Context = objeto con array `pointers`: [sender, pc, sp, method, receiver, arg0, ...opstack]
// Reciclado por free-list como allocateOrRecycleContext/recycleIfPossible.
// ---------------------------------------------------------------------------
const CTX_SENDER = 0, CTX_PC = 1, CTX_SP = 2, CTX_METHOD = 3, CTX_RCVR = 4, CTX_TEMP0 = 5;
const CTX_SIZE = 24;

function makeContextVM() {
    const cache = makeCache();
    const rcvrObj = { classId: CLASS_FIB };
    const vm = {
        activeCtx: null, pc: 0, sp: 0, methodId: 0,
        running: false, result: 0, sends: 0, icc: 1000,
        freeCtx: null,
    };

    function allocCtx() {
        let ctx = vm.freeCtx;
        if (ctx) { vm.freeCtx = ctx.pointers[CTX_SENDER]; return ctx; }
        return { pointers: new Array(CTX_SIZE).fill(null) };
    }

    function send(selId, numArgs) {
        vm.sends++;
        const stack = vm.activeCtx.pointers;
        const rcvr = stack[vm.sp - numArgs];
        const classId = typeof rcvr === "number" ? CLASS_SMALLINT : rcvr.classId;
        const methodId = cacheLookup(cache, classId, selId);
        // storeContextRegisters: guardar pc/sp en el context actual
        stack[CTX_PC] = vm.pc;
        stack[CTX_SP] = vm.sp - numArgs - 1; // sp tras popear rcvr+args
        const ctx = allocCtx();
        const p = ctx.pointers;
        p[CTX_SENDER] = vm.activeCtx;
        p[CTX_METHOD] = methodId;
        // copiar receiver + args al nuevo context (como executeNewMethod:1046)
        p[CTX_RCVR] = rcvr;
        for (let i = 0; i < numArgs; i++) p[CTX_TEMP0 + i] = stack[vm.sp - numArgs + 1 + i];
        // nil-fill de temps (fib: 0 temps extra — loop presente igual)
        const numTemps = 0;
        for (let i = 0; i < numTemps; i++) p[CTX_TEMP0 + numArgs + i] = null;
        vm.activeCtx = ctx;
        vm.methodId = methodId;
        vm.pc = 0;
        vm.sp = CTX_TEMP0 + numArgs + numTemps - 1; // tope del opstack (vacío)
        if (--vm.icc <= 0) vm.icc = 1000;
    }

    function doReturn(rv) {
        const ctx = vm.activeCtx;
        const sender = ctx.pointers[CTX_SENDER];
        // escaneo mínimo de unwind (target === sender, un compare como hoy)
        // nil sender/ip + reciclar (doReturn:1103-1107)
        ctx.pointers[CTX_SENDER] = vm.freeCtx; // reuso del slot como link de free-list
        ctx.pointers[CTX_PC] = null;
        vm.freeCtx = ctx;
        if (sender === null) { vm.running = false; vm.result = rv; return; }
        // fetchContextRegisters
        const sp = sender.pointers[CTX_SP];
        vm.activeCtx = sender;
        vm.methodId = sender.pointers[CTX_METHOD];
        vm.pc = sender.pointers[CTX_PC];
        vm.sp = sp + 1;
        sender.pointers[sp + 1] = rv; // push del resultado
    }

    // fib "compilado" al estilo jit.js: switch sobre pc, return al trampolín en cada send
    function fibCompiled(vm) {
        const stack = vm.activeCtx.pointers;
        while (true) switch (vm.pc) {
            case 0: {
                const n = stack[CTX_TEMP0];
                if (typeof n === "number" && n < 2) { doReturn(n); return; }
                stack[++vm.sp] = stack[CTX_RCVR];
                const a = n; // inline #- con chequeo como generateNumericOp
                if (typeof a === "number") stack[++vm.sp] = a - 1; else throw Error("fail");
                vm.pc = 1; send(SEL_FIB, 1); return;
            }
            case 1: {
                stack[++vm.sp] = stack[CTX_RCVR];
                const a = stack[CTX_TEMP0];
                if (typeof a === "number") stack[++vm.sp] = a - 2; else throw Error("fail");
                vm.pc = 2; send(SEL_FIB, 1); return;
            }
            case 2: {
                const b = stack[vm.sp], a = stack[vm.sp - 1];
                if (typeof a === "number" && typeof b === "number") stack[--vm.sp] = a + b;
                else throw Error("fail");
                doReturn(stack[vm.sp]);
                return;
            }
        }
    }

    const methodFns = [null, fibCompiled];

    return function run(n) {
        vm.freeCtx = null; vm.sends = 0; vm.icc = 1000;
        const base = { pointers: new Array(CTX_SIZE).fill(null) };
        base.pointers[CTX_SENDER] = null;
        base.pointers[CTX_METHOD] = METH_FIB;
        base.pointers[CTX_RCVR] = rcvrObj;
        base.pointers[CTX_TEMP0] = n;
        vm.activeCtx = base; vm.methodId = METH_FIB; vm.pc = 0;
        vm.sp = CTX_TEMP0; // opstack vacío arriba de arg0
        vm.running = true;
        const t0 = process.hrtime.bigint();
        while (vm.running) methodFns[vm.methodId](vm);
        const t1 = process.hrtime.bigint();
        return { result: vm.result, sends: vm.sends, ns: Number(t1 - t0) };
    };
}

// ---------------------------------------------------------------------------
// Maquinaria de frames compartida por V2/V3 (layout del diseño):
//   rcvr @ fp-1-numArgs, args hasta fp-1,
//   fp+0 savedFp | fp+1 savedPc | fp+2 method | fp+3 flags | fp+4 ctxOop | temps | opstack
// ---------------------------------------------------------------------------
const F_SAVEDFP = 0, F_SAVEDPC = 1, F_METHOD = 2, F_FLAGS = 3, F_CTX = 4, F_FIXED = 5;
const HASCTX_BIT = 1 << 17;

// ---------------------------------------------------------------------------
// V2: frames planos + trampolín (jit.js con stack zone, sin WASM)
// ---------------------------------------------------------------------------
function makeFrameTrampolineVM() {
    const cache = makeCache();
    const rcvrObj = { classId: CLASS_FIB };
    const zone = new Array(1 << 16).fill(0);
    const vm = {
        fp: 0, sp: 0, pc: 0, methodId: 0,
        running: false, result: 0, sends: 0, icc: 1000,
    };

    function send(selId, numArgs) {
        vm.sends++;
        const rcvr = zone[vm.sp - numArgs];
        const classId = typeof rcvr === "number" ? CLASS_SMALLINT : rcvr.classId;
        const methodId = cacheLookup(cache, classId, selId);
        const nfp = vm.sp + 1;
        zone[nfp + F_SAVEDFP] = vm.fp;
        zone[nfp + F_SAVEDPC] = vm.pc;
        zone[nfp + F_METHOD] = methodId;
        zone[nfp + F_FLAGS] = numArgs;
        zone[nfp + F_CTX] = 0;
        const numTemps = 0; // nil-fill presente
        for (let i = 0; i < numTemps; i++) zone[nfp + F_FIXED + i] = null;
        vm.fp = nfp;
        vm.sp = nfp + F_FIXED - 1 + numTemps;
        vm.methodId = methodId;
        vm.pc = 0;
        if (--vm.icc <= 0) vm.icc = 1000;
    }

    function doReturn(rv) {
        const fp = vm.fp;
        const flags = zone[fp + F_FLAGS];
        if (flags & HASCTX_BIT) widowCold(fp);
        const sfp = zone[fp + F_SAVEDFP];
        if (sfp === 0) { vm.running = false; vm.result = rv; return; }
        const numArgs = flags & 0xFFFF;
        const rs = fp - 1 - numArgs;
        zone[rs] = rv;
        vm.sp = rs;
        vm.pc = zone[fp + F_SAVEDPC];
        vm.methodId = zone[sfp + F_METHOD];
        vm.fp = sfp;
    }

    function widowCold() { throw Error("no contexts casados en este bench"); }

    function fibCompiled(vm) {
        const fp = vm.fp;
        while (true) switch (vm.pc) {
            case 0: {
                const n = zone[fp - 1];
                if (typeof n === "number" && n < 2) { doReturn(n); return; }
                zone[++vm.sp] = zone[fp - 2];
                if (typeof n === "number") zone[++vm.sp] = n - 1; else throw Error("fail");
                vm.pc = 1; send(SEL_FIB, 1); return;
            }
            case 1: {
                zone[++vm.sp] = zone[fp - 2];
                const a = zone[fp - 1];
                if (typeof a === "number") zone[++vm.sp] = a - 2; else throw Error("fail");
                vm.pc = 2; send(SEL_FIB, 1); return;
            }
            case 2: {
                const b = zone[vm.sp], a = zone[vm.sp - 1];
                if (typeof a === "number" && typeof b === "number") zone[--vm.sp] = a + b;
                else throw Error("fail");
                doReturn(zone[vm.sp]);
                return;
            }
        }
    }

    const methodFns = [null, fibCompiled];

    return function run(n) {
        vm.sends = 0; vm.icc = 1000;
        // frame base: rcvr@0, arg@1, frame@2
        zone[0] = rcvrObj; zone[1] = n;
        zone[2 + F_SAVEDFP] = 0; zone[2 + F_SAVEDPC] = 0;
        zone[2 + F_METHOD] = METH_FIB; zone[2 + F_FLAGS] = 1; zone[2 + F_CTX] = 0;
        vm.fp = 2; vm.sp = 2 + F_FIXED - 1; vm.pc = 0; vm.methodId = METH_FIB;
        vm.running = true;
        const t0 = process.hrtime.bigint();
        while (vm.running) methodFns[vm.methodId](vm);
        const t1 = process.hrtime.bigint();
        return { result: vm.result, sends: vm.sends, ns: Number(t1 - t0) };
    };
}

// ---------------------------------------------------------------------------
// V3: frames planos + intérprete de bytecodes en JS (espejo exacto del WASM V4)
// ---------------------------------------------------------------------------
// mini-ISA: ver diseño; fib: n < 2 ifTrue:[^n] ifFalse:[^(self fib: n-1) + (self fib: n-2)]
const OP_PUSH_ARG0 = 0, OP_PUSH_C1 = 1, OP_PUSH_C2 = 2, OP_PUSH_SELF = 3,
      OP_SUB = 4, OP_LT = 5, OP_JMPF = 6, OP_SEND_FIB = 7, OP_ADD = 8, OP_RET = 9;
const FIB_BYTES = new Uint8Array([
    OP_PUSH_ARG0, OP_PUSH_C2, OP_LT, OP_JMPF, 7,   // pc 0-4: n<2? si no → pc7
    OP_PUSH_ARG0, OP_RET,                           // pc 5-6: ^n
    OP_PUSH_SELF, OP_PUSH_ARG0, OP_PUSH_C1, OP_SUB, OP_SEND_FIB,  // pc 7-11
    OP_PUSH_SELF, OP_PUSH_ARG0, OP_PUSH_C2, OP_SUB, OP_SEND_FIB,  // pc 12-16
    OP_ADD, OP_RET,                                 // pc 17-18
]);

function makeFrameInterpVM() {
    const cache = makeCache();
    const rcvrObj = { classId: CLASS_FIB };
    const zone = new Array(1 << 16).fill(0);
    const methodBytes = [null, FIB_BYTES];
    let sends = 0;

    function run(n) {
        sends = 0;
        let icc = 1000;
        zone[0] = rcvrObj; zone[1] = n;
        zone[2 + F_SAVEDFP] = 0; zone[2 + F_SAVEDPC] = 0;
        zone[2 + F_METHOD] = METH_FIB; zone[2 + F_FLAGS] = 1; zone[2 + F_CTX] = 0;
        let fp = 2, sp = 2 + F_FIXED - 1, pc = 0;
        let bytes = FIB_BYTES;
        const t0 = process.hrtime.bigint();
        let result;
        loop: while (true) {
            switch (bytes[pc++]) {
                case OP_PUSH_ARG0: zone[++sp] = zone[fp - 1]; break;
                case OP_PUSH_C1: zone[++sp] = 1; break;
                case OP_PUSH_C2: zone[++sp] = 2; break;
                case OP_PUSH_SELF: zone[++sp] = zone[fp - 2]; break;
                case OP_SUB: {
                    const b = zone[sp--], a = zone[sp];
                    if (typeof a === "number" && typeof b === "number") zone[sp] = a - b;
                    else throw Error("fail");
                    break;
                }
                case OP_LT: {
                    const b = zone[sp--], a = zone[sp];
                    if (typeof a === "number" && typeof b === "number") zone[sp] = a < b ? 1 : 0;
                    else throw Error("fail");
                    break;
                }
                case OP_JMPF: {
                    const target = bytes[pc++];
                    if (zone[sp--] === 0) pc = target;
                    break;
                }
                case OP_SEND_FIB: {
                    sends++;
                    const numArgs = 1;
                    const rcvr = zone[sp - numArgs];
                    const classId = typeof rcvr === "number" ? CLASS_SMALLINT : rcvr.classId;
                    const methodId = cacheLookup(cache, classId, SEL_FIB);
                    const nfp = sp + 1;
                    zone[nfp + F_SAVEDFP] = fp;
                    zone[nfp + F_SAVEDPC] = pc;
                    zone[nfp + F_METHOD] = methodId;
                    zone[nfp + F_FLAGS] = numArgs;
                    zone[nfp + F_CTX] = 0;
                    const numTemps = 0;
                    for (let i = 0; i < numTemps; i++) zone[nfp + F_FIXED + i] = null;
                    fp = nfp; sp = nfp + F_FIXED - 1 + numTemps; pc = 0;
                    bytes = methodBytes[methodId];
                    if (--icc <= 0) icc = 1000;
                    break;
                }
                case OP_ADD: {
                    const b = zone[sp--], a = zone[sp];
                    if (typeof a === "number" && typeof b === "number") zone[sp] = a + b;
                    else throw Error("fail");
                    break;
                }
                case OP_RET: {
                    const rv = zone[sp];
                    const flags = zone[fp + F_FLAGS];
                    if (flags & HASCTX_BIT) throw Error("no contexts casados en este bench");
                    const sfp = zone[fp + F_SAVEDFP];
                    if (sfp === 0) { result = rv; break loop; }
                    const numArgs = flags & 0xFFFF;
                    const rs = fp - 1 - numArgs;
                    zone[rs] = rv;
                    sp = rs;
                    pc = zone[fp + F_SAVEDPC];
                    const callerMethod = zone[sfp + F_METHOD];
                    bytes = methodBytes[callerMethod];
                    fp = sfp;
                    break;
                }
                default: throw Error("bytecode ilegal");
            }
        }
        const t1 = process.hrtime.bigint();
        return { result: result, sends: sends, ns: Number(t1 - t0) };
    }
    return run;
}

module.exports = { makeContextVM, makeFrameTrampolineVM, makeFrameInterpVM };
