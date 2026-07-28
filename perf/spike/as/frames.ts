// V4: frames planos + intérprete de bytecodes en WASM (espejo de V3 en variants.js).
// Diferencias deliberadas con el spike anterior (que perdió 2.2x):
//  - load<i32>/store<i32> crudos sobre memoria lineal, sin objetos Int32Array
//    (sin bounds checks ni indirección dataStart)
//  - sin recursión del host: un solo loop de dispatch, frames en nuestra memoria
//  - valores taggeados i32: smallint = (v<<1)|1, oop = dirección par

// Mapa de memoria (offsets en bytes; --initialMemory 2 páginas = 128KB)
const METHOD_BASE: i32 = 4096;   // bytecodes del método fib (u8)
const CACHE_BASE: i32 = 8192;    // cache de métodos: 512 × [check:i32, method:i32]
const RCVR_OOP: i32 = 16384;     // objeto receiver: [classId:i32]; oop = dirección
const ZONE_BASE: i32 = 65536;    // stack zone

const SEL_FIB: i32 = 7;
const CLASS_SMALLINT: i32 = 99;
const CLASS_FIB: i32 = 5;
const METH_FIB: i32 = 1;
const CACHE_MASK: i32 = 511;
const HASCTX_BIT: i32 = 1 << 17;

// offsets en bytes de los slots del frame
const F_SAVEDFP: i32 = 0;
const F_SAVEDPC: i32 = 4;
const F_METHOD: i32 = 8;
const F_FLAGS: i32 = 12;
const F_CTX: i32 = 16;
const F_FIXED: i32 = 20;

let sends: i32 = 0;

export function init(): void {
    // fib: n<2 ifTrue:[^n] ifFalse:[^(self fib: n-1) + (self fib: n-2)]
    // opcodes: 0 PUSH_ARG0, 1 PUSH_C1, 2 PUSH_C2, 3 PUSH_SELF, 4 SUB, 5 LT,
    //          6 JMPF <target>, 7 SEND_FIB, 8 ADD, 9 RET
    const b: i32 = METHOD_BASE;
    store<u8>(b + 0, 0);  // PUSH_ARG0
    store<u8>(b + 1, 2);  // PUSH_C2
    store<u8>(b + 2, 5);  // LT
    store<u8>(b + 3, 6);  // JMPF
    store<u8>(b + 4, 7);  //   target: pc 7
    store<u8>(b + 5, 0);  // PUSH_ARG0
    store<u8>(b + 6, 9);  // RET
    store<u8>(b + 7, 3);  // PUSH_SELF
    store<u8>(b + 8, 0);  // PUSH_ARG0
    store<u8>(b + 9, 1);  // PUSH_C1
    store<u8>(b + 10, 4); // SUB
    store<u8>(b + 11, 7); // SEND_FIB
    store<u8>(b + 12, 3); // PUSH_SELF
    store<u8>(b + 13, 0); // PUSH_ARG0
    store<u8>(b + 14, 2); // PUSH_C2
    store<u8>(b + 15, 4); // SUB
    store<u8>(b + 16, 7); // SEND_FIB
    store<u8>(b + 17, 8); // ADD
    store<u8>(b + 18, 9); // RET
    store<i32>(RCVR_OOP, CLASS_FIB);
    memory.fill(CACHE_BASE, 0, 4096);
}

export function run(n: i32): i32 {
    sends = 0;
    let icc: i32 = 1000;
    // frame base: rcvr @ ZONE_BASE, arg @ +4, frame @ +8
    store<i32>(ZONE_BASE, RCVR_OOP);
    store<i32>(ZONE_BASE + 4, (n << 1) | 1);
    const bfp: i32 = ZONE_BASE + 8;
    store<i32>(bfp + F_SAVEDFP, 0);
    store<i32>(bfp + F_SAVEDPC, 0);
    store<i32>(bfp + F_METHOD, METH_FIB);
    store<i32>(bfp + F_FLAGS, 1);
    store<i32>(bfp + F_CTX, 0);
    let fp: i32 = bfp;
    let sp: i32 = bfp + F_FIXED - 4;
    let pc: i32 = METHOD_BASE;
    while (true) {
        const op: i32 = load<u8>(pc);
        pc++;
        switch (op) {
            case 0: { // PUSH_ARG0
                sp += 4; store<i32>(sp, load<i32>(fp - 4)); break;
            }
            case 1: { sp += 4; store<i32>(sp, 3); break; }  // 1 taggeado
            case 2: { sp += 4; store<i32>(sp, 5); break; }  // 2 taggeado
            case 3: { // PUSH_SELF
                sp += 4; store<i32>(sp, load<i32>(fp - 8)); break;
            }
            case 4: { // SUB taggeado: (a-1)-(b-1)+1 = a-b+1
                const b2: i32 = load<i32>(sp); sp -= 4; const a: i32 = load<i32>(sp);
                if ((a & b2 & 1) != 0) store<i32>(sp, a - b2 + 1);
                else unreachable();
                break;
            }
            case 5: { // LT (comparación taggeada es monótona)
                const b2: i32 = load<i32>(sp); sp -= 4; const a: i32 = load<i32>(sp);
                if ((a & b2 & 1) != 0) store<i32>(sp, a < b2 ? 3 : 1);
                else unreachable();
                break;
            }
            case 6: { // JMPF
                const t: i32 = load<u8>(pc); pc++;
                const c: i32 = load<i32>(sp); sp -= 4;
                if (c == 1) pc = METHOD_BASE + t;
                break;
            }
            case 7: { // SEND_FIB
                sends++;
                const numArgs: i32 = 1;
                const rcvr: i32 = load<i32>(sp - (numArgs << 2));
                const classId: i32 = (rcvr & 1) != 0 ? CLASS_SMALLINT : load<i32>(rcvr);
                const k: i32 = ((classId ^ (SEL_FIB * 31)) & CACHE_MASK) << 3;
                const check: i32 = (classId << 8) | SEL_FIB;
                let methodId: i32;
                if (load<i32>(CACHE_BASE + k) == check) {
                    methodId = load<i32>(CACHE_BASE + k + 4);
                } else {
                    store<i32>(CACHE_BASE + k, check);
                    store<i32>(CACHE_BASE + k + 4, METH_FIB);
                    methodId = METH_FIB;
                }
                const nfp: i32 = sp + 4;
                store<i32>(nfp + F_SAVEDFP, fp);
                store<i32>(nfp + F_SAVEDPC, pc);
                store<i32>(nfp + F_METHOD, methodId);
                store<i32>(nfp + F_FLAGS, numArgs);
                store<i32>(nfp + F_CTX, 0);
                const numTemps: i32 = 0; // nil-fill presente, 0 iteraciones en fib
                for (let i: i32 = 0; i < numTemps; i++) store<i32>(nfp + F_FIXED + (i << 2), 0);
                fp = nfp;
                sp = nfp + F_FIXED - 4;
                pc = METHOD_BASE; // methodStart(methodId); un solo método en el bench
                icc--; if (icc <= 0) icc = 1000;
                break;
            }
            case 8: { // ADD taggeado: a+b-1
                const b2: i32 = load<i32>(sp); sp -= 4; const a: i32 = load<i32>(sp);
                if ((a & b2 & 1) != 0) store<i32>(sp, a + b2 - 1);
                else unreachable();
                break;
            }
            case 9: { // RET
                const rv: i32 = load<i32>(sp);
                const flags: i32 = load<i32>(fp + F_FLAGS);
                if ((flags & HASCTX_BIT) != 0) unreachable(); // widowCold: no pasa en el bench
                const sfp: i32 = load<i32>(fp + F_SAVEDFP);
                if (sfp == 0) return rv >> 1;
                const numArgs: i32 = flags & 0xFFFF;
                const rs: i32 = fp - 4 - (numArgs << 2);
                store<i32>(rs, rv);
                sp = rs;
                pc = load<i32>(fp + F_SAVEDPC);
                fp = sfp;
                break;
            }
            default: unreachable();
        }
    }
    return 0; // inalcanzable
}

export function getSends(): i32 {
    return sends;
}

// ---------------------------------------------------------------------------
// V5: frames + "métodos compilados" en WASM + trampolín (estimador de fase 2:
// codegen WASM por método). Misma estructura que V2 en JS, pero sobre memoria
// lineal. El dispatch del trampolín usa switch sobre methodId (aprox. de
// call_indirect; subestima levemente su costo).
// ---------------------------------------------------------------------------
let g_fp: i32 = 0;
let g_sp: i32 = 0;
let g_pc: i32 = 0;
let g_method: i32 = 0;
let g_running: bool = false;
let g_result: i32 = 0;
let g_icc: i32 = 1000;

function send5(numArgs: i32): void {
    sends++;
    const rcvr: i32 = load<i32>(g_sp - (numArgs << 2));
    const classId: i32 = (rcvr & 1) != 0 ? CLASS_SMALLINT : load<i32>(rcvr);
    const k: i32 = ((classId ^ (SEL_FIB * 31)) & CACHE_MASK) << 3;
    const check: i32 = (classId << 8) | SEL_FIB;
    let methodId: i32;
    if (load<i32>(CACHE_BASE + k) == check) {
        methodId = load<i32>(CACHE_BASE + k + 4);
    } else {
        store<i32>(CACHE_BASE + k, check);
        store<i32>(CACHE_BASE + k + 4, METH_FIB);
        methodId = METH_FIB;
    }
    const nfp: i32 = g_sp + 4;
    store<i32>(nfp + F_SAVEDFP, g_fp);
    store<i32>(nfp + F_SAVEDPC, g_pc);
    store<i32>(nfp + F_METHOD, methodId);
    store<i32>(nfp + F_FLAGS, numArgs);
    store<i32>(nfp + F_CTX, 0);
    g_fp = nfp;
    g_sp = nfp + F_FIXED - 4;
    g_method = methodId;
    g_pc = 0;
    g_icc--; if (g_icc <= 0) g_icc = 1000;
}

function ret5(rv: i32): void {
    const flags: i32 = load<i32>(g_fp + F_FLAGS);
    if ((flags & HASCTX_BIT) != 0) unreachable();
    const sfp: i32 = load<i32>(g_fp + F_SAVEDFP);
    if (sfp == 0) { g_running = false; g_result = rv; return; }
    const numArgs: i32 = flags & 0xFFFF;
    const rs: i32 = g_fp - 4 - (numArgs << 2);
    store<i32>(rs, rv);
    g_sp = rs;
    g_pc = load<i32>(g_fp + F_SAVEDPC);
    g_method = load<i32>(sfp + F_METHOD);
    g_fp = sfp;
}

function fibCompiled5(): void {
    const fp: i32 = g_fp;
    while (true) {
        switch (g_pc) {
            case 0: {
                const n: i32 = load<i32>(fp - 4);
                // n < 2 con n taggeado: tagged(2) = 5, comparación monótona
                if ((n & 1) != 0 && n < 5) { ret5(n); return; }
                g_sp += 4; store<i32>(g_sp, load<i32>(fp - 8)); // self
                if ((n & 1) != 0) { g_sp += 4; store<i32>(g_sp, n - 2); } // n-1 taggeado
                else unreachable();
                g_pc = 1; send5(1); return;
            }
            case 1: {
                g_sp += 4; store<i32>(g_sp, load<i32>(fp - 8)); // self
                const n: i32 = load<i32>(fp - 4);
                if ((n & 1) != 0) { g_sp += 4; store<i32>(g_sp, n - 4); } // n-2 taggeado
                else unreachable();
                g_pc = 2; send5(1); return;
            }
            case 2: {
                const b: i32 = load<i32>(g_sp); const a: i32 = load<i32>(g_sp - 4);
                if ((a & b & 1) != 0) { g_sp -= 4; store<i32>(g_sp, a + b - 1); }
                else unreachable();
                ret5(load<i32>(g_sp));
                return;
            }
            default: unreachable();
        }
    }
}

export function run5(n: i32): i32 {
    sends = 0;
    g_icc = 1000;
    store<i32>(ZONE_BASE, RCVR_OOP);
    store<i32>(ZONE_BASE + 4, (n << 1) | 1);
    const bfp: i32 = ZONE_BASE + 8;
    store<i32>(bfp + F_SAVEDFP, 0);
    store<i32>(bfp + F_SAVEDPC, 0);
    store<i32>(bfp + F_METHOD, METH_FIB);
    store<i32>(bfp + F_FLAGS, 1);
    store<i32>(bfp + F_CTX, 0);
    g_fp = bfp;
    g_sp = bfp + F_FIXED - 4;
    g_pc = 0;
    g_method = METH_FIB;
    g_running = true;
    while (g_running) {
        switch (g_method) {
            case METH_FIB: fibCompiled5(); break;
            default: unreachable();
        }
    }
    return g_result >> 1;
}
