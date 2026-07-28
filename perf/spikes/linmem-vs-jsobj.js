"use strict";
// Spike: acceso a campos de objetos en el patrón del intérprete, 3 representaciones:
//   A: objetos JS monomórficos (= default actual del VM)
//   B: heap Int32Array accedido desde JS (memoria lineal SIN WASM)
//   C: memoria lineal accedida desde WASM (loads/stores crudos)
//
// Decide la apuesta WASM: si C no gana claramente a A, el "impuesto de objetos
// JS" no es una palanca real y el rewrite WASM (meses) no vale. Si C >> A, sí.
//
// Loop plano que modela el trabajo de campos de un send+return: escribir 9 slots
// del contexto (method/sender/receiver/pc/sp/args/temps), leer 4 inst-vars del
// receiver + 2 args, computar, acumular. Contexto reciclado (dirección fija) =
// el caso común del free-list del VM. Las 3 reps hacen el MISMO trabajo lógico.

var ITERS = 40000000;
var REPS = 7;

// ---- A: objetos JS monomórficos ----
function CtxA(){ this.method=0;this.sender=0;this.pc=0;this.sp=0;this.receiver=0;this.t0=0;this.t1=0;this.a0=0;this.a1=0; }
function RcvA(){ this.cls=0;this.iv0=0;this.iv1=0;this.iv2=0;this.iv3=0; }
function runA(iters){
    var rcvr=new RcvA(); rcvr.cls=42;rcvr.iv0=1;rcvr.iv1=2;rcvr.iv2=3;rcvr.iv3=4;
    var ctx=new CtxA(); var acc=0;
    for(var i=0;i<iters;i++){
        ctx.method=7;ctx.sender=i;ctx.receiver=rcvr;ctx.pc=0;ctx.sp=0;ctx.a0=i;ctx.a1=i+1;ctx.t0=0;ctx.t1=0;
        var x=rcvr.iv0+rcvr.iv1+rcvr.iv2+rcvr.iv3+ctx.a0+ctx.a1;
        ctx.t0=x; acc=(acc+(ctx.t0&1))|0;
    }
    return acc|0;
}

// ---- A_mega: objetos JS de MUCHAS shapes (= representación pre-fix, por-clase) ----
var ctorsM = [], rcvrsM = [];
for (var k = 0; k < 300; k++) {
    ctorsM.push(new Function("this.method=0;this.sender=0;this.pc=0;this.sp=0;this.receiver=0;this.t0=0;this.t1=0;this.a0=0;this.a1=0;"));
    var Rc = new Function("this.cls=0;this.iv0=0;this.iv1=0;this.iv2=0;this.iv3=0;");
    var r = new Rc(); r.cls=42;r.iv0=1;r.iv1=2;r.iv2=3;r.iv3=4; rcvrsM.push(r);
}
function runAmega(iters){
    // ciclar entre muchas shapes distintas para forzar ICs megamórficos
    var ctxs=[]; for(var k=0;k<300;k++) ctxs.push(new ctorsM[k]());
    var acc=0;
    for(var i=0;i<iters;i++){
        var m=i%300; var ctx=ctxs[m], rcvr=rcvrsM[m];
        ctx.method=7;ctx.sender=i;ctx.receiver=rcvr;ctx.pc=0;ctx.sp=0;ctx.a0=i;ctx.a1=i+1;ctx.t0=0;ctx.t1=0;
        var x=rcvr.iv0+rcvr.iv1+rcvr.iv2+rcvr.iv3+ctx.a0+ctx.a1;
        ctx.t0=x; acc=(acc+(ctx.t0&1))|0;
    }
    return acc|0;
}

// ---- B: heap Int32Array desde JS ----
var HEAP=new Int32Array(256);
function runB(iters){
    var R=8,C=32; // rcvr en slot 8, ctx en slot 32
    HEAP[R]=42;HEAP[R+1]=1;HEAP[R+2]=2;HEAP[R+3]=3;HEAP[R+4]=4;
    var acc=0;
    for(var i=0;i<iters;i++){
        HEAP[C]=7;HEAP[C+1]=i;HEAP[C+4]=R;HEAP[C+2]=0;HEAP[C+3]=0;HEAP[C+7]=i;HEAP[C+8]=i+1;HEAP[C+5]=0;HEAP[C+6]=0;
        var x=HEAP[R+1]+HEAP[R+2]+HEAP[R+3]+HEAP[R+4]+HEAP[C+7]+HEAP[C+8];
        HEAP[C+5]=x; acc=(acc+(HEAP[C+5]&1))|0;
    }
    return acc|0;
}

// ---- C: WASM con memoria lineal (ensamblado a mano) ----
// Direcciones en BYTES: rcvr=32 (cls@32, iv0@36..iv3@48), ctx=128
// (method@128,sender@132,pc@136,sp@140,receiver@144,t0@148,t1@152,a0@156,a1@160)
var wasmBytes = (function(){
    var b=[];
    function u32(n){ do{var x=n&0x7f;n>>>=7;if(n)x|=0x80;b.push(x);}while(n); }
    function i32(n){ // signed LEB128
        var more=1; while(more){ var x=n&0x7f; n>>=7; if((n===0&&!(x&0x40))||(n===-1&&(x&0x40)))more=0; else x|=0x80; b.push(x);} }
    // opcodes
    var GET=0x20,SET=0x21,CONST=0x41,ADD=0x6a,AND=0x71,GES=0x4e,STORE=0x36,LOAD=0x28,
        LOOP=0x03,BLOCK=0x02,BRIF=0x0d,BR=0x0c,END=0x0b,VOID=0x40;
    // memarg = align(u32) offset(u32); usamos align=2 (i32), offset=0 (dir absoluta en operando)
    function store(){ b.push(STORE); u32(2); u32(0); }
    function load(){ b.push(LOAD); u32(2); u32(0); }
    // --- header ---
    b.push(0,0x61,0x73,0x6d, 1,0,0,0);
    // --- type section: () one type (i32)->i32 ---
    var ts=[0x01, 0x60,0x01,0x7f,0x01,0x7f]; sect(1,ts);
    // --- function section: 1 func, type 0 ---
    sect(3,[0x01,0x00]);
    // --- memory section: 1 mem, min 1 page ---
    sect(5,[0x01,0x00,0x01]);
    // --- export section: "run" func0, "mem" mem0 ---
    var es=[0x02, 0x03,0x72,0x75,0x6e,0x00,0x00, 0x03,0x6d,0x65,0x6d,0x02,0x00]; sect(7,es);
    // --- code section ---
    // locals: i(1)=local1, acc=local2, x=local3  (param iters=local0)
    var body=[];
    var save=b; b=body;
    // local decls: 1 group of 3 i32
    u32(1); u32(3); b.push(0x7f);
    // acc=0
    b.push(CONST); i32(0); b.push(SET); u32(2);
    // i=0
    b.push(CONST); i32(0); b.push(SET); u32(1);
    b.push(BLOCK,VOID);
    b.push(LOOP,VOID);
    // if i>=iters break: local.get i; local.get iters; ge_s; br_if 1
    b.push(GET);u32(1); b.push(GET);u32(0); b.push(GES); b.push(BRIF);u32(1);
    // write ctx fields: mem[128]=7
    function wr(addr,emitVal){ b.push(CONST);i32(addr); emitVal(); store(); }
    wr(128,function(){b.push(CONST);i32(7);});
    wr(132,function(){b.push(GET);u32(1);});                 // sender=i
    wr(136,function(){b.push(CONST);i32(0);});
    wr(140,function(){b.push(CONST);i32(0);});
    wr(144,function(){b.push(CONST);i32(32);});              // receiver=32
    wr(148,function(){b.push(CONST);i32(0);});
    wr(152,function(){b.push(CONST);i32(0);});
    wr(156,function(){b.push(GET);u32(1);});                 // a0=i
    wr(160,function(){b.push(GET);u32(1);b.push(CONST);i32(1);b.push(ADD);}); // a1=i+1
    // x = mem[36]+mem[40]+mem[44]+mem[48]+mem[156]+mem[160]
    b.push(CONST);i32(36);load();
    b.push(CONST);i32(40);load();b.push(ADD);
    b.push(CONST);i32(44);load();b.push(ADD);
    b.push(CONST);i32(48);load();b.push(ADD);
    b.push(CONST);i32(156);load();b.push(ADD);
    b.push(CONST);i32(160);load();b.push(ADD);
    b.push(SET);u32(3);
    // mem[148]=x (t0)
    b.push(CONST);i32(148); b.push(GET);u32(3); store();
    // acc += mem[148] & 1
    b.push(GET);u32(2); b.push(CONST);i32(148);load(); b.push(CONST);i32(1);b.push(AND); b.push(ADD); b.push(SET);u32(2);
    // i++
    b.push(GET);u32(1);b.push(CONST);i32(1);b.push(ADD);b.push(SET);u32(1);
    b.push(BR);u32(0);
    b.push(END); // loop
    b.push(END); // block
    b.push(GET);u32(2); // return acc
    b.push(END); // func
    var code=b; b=save;
    var cs=[0x01]; // 1 body
    var bl=code.length; // body length
    var lenBytes=[]; (function(n){do{var x=n&0x7f;n>>>=7;if(n)x|=0x80;lenBytes.push(x);}while(n);})(bl);
    cs=cs.concat(lenBytes).concat(code);
    sect(10,cs);
    function sect(id,content){ save2=b; b=[]; u32(content.length); var lb=b; b=save2; b.push(id); for(var k=0;k<lb.length;k++)b.push(lb[k]); for(var k=0;k<content.length;k++)b.push(content[k]); }
    var save2;
    return new Uint8Array(save);
})();

// init rcvr en memoria WASM
var wmod=new WebAssembly.Module(wasmBytes);
var winst=new WebAssembly.Instance(wmod);
var wmem=new Int32Array(winst.exports.mem.buffer);
wmem[32/4]=42; wmem[36/4]=1; wmem[40/4]=2; wmem[44/4]=3; wmem[48/4]=4;
var runC=winst.exports.run;

function bench(name,fn){
    var best=Infinity,chk=0;
    for(var i=0;i<REPS;i++){ var t=process.hrtime.bigint(); chk=fn(ITERS); var ms=Number(process.hrtime.bigint()-t)/1e6; if(ms<best)best=ms; }
    console.log("  "+name+": "+best.toFixed(1)+" ms  (check="+chk+")");
    return best;
}
runA(1e6);runAmega(1e6);runB(1e6);runC(1e6);
console.log("iters="+ITERS+", best-of-"+REPS+" (trabajo de campos de un send+return por iter)");
var am=bench("A₋ objetos JS MEGAmórficos ",runAmega);
var a=bench("A  objetos JS monomórficos ",runA);
var b=bench("B  heap Int32Array (JS)    ",runB);
var c=bench("C  memoria lineal (WASM)   ",runC);
console.log("→ Amega/A="+(am/a).toFixed(2)+"x (costo del megamorfismo, YA arreglado en JS con +6.6%)");
console.log("→ B/A="+(b/a).toFixed(2)+"x   C/A="+(c/a).toFixed(2)+"x");
console.log("→ veredicto: "+(c<a*0.8 ? "WASM gana "+((1-c/a)*100).toFixed(0)+"% sobre objetos JS → la palanca es real" : c<a*0.98 ? "WASM gana poco ("+((1-c/a)*100).toFixed(0)+"%) → no vale meses" : "WASM NO gana → techo alcanzado, objetos JS monomórficos ya son óptimos"));
