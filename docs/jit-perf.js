function log(...args) { logger.innerText += args.join(" ") + '\n' }

// benchFib answers the number of sends in a fibonacci computation
// rather than the result of the computation itself.

/*
  benchFib
    ^self < 2
      ifTrue: [1]
      ifFalse: [(self-1) benchFib + (self-2) benchFib + 1]

   0 <70> self
   1 <77> pushConstant: 2
   2 <B2> send: <
   3 <9A> jumpFalse: 7
   4 <76> pushConstant: 1
   5 <A4 0B> jumpTo: 18
   7 <70> self
   8 <76> pushConstant: 1
   9 <B1> send: -
  10 <D0> send: benchFib
  11 <70> self
  12 <77> pushConstant: 2
  13 <B1> send: -
  14 <D0> send: benchFib
  15 <B0> send: +
  16 <76> pushConstant: 1
  17 <B0> send: +
  18 <7C> returnTop
*/

const methods = {
  // plain JS as reference
  benchFibJS: {
    compiled: function benchFibJS(n) {
      return n < 2 ? 1 : benchFibJS(n - 2) + benchFibJS(n - 1) + 1;
    },
  },
  // JIT idea
  benchFibJIT: {
    compiled: null,
    method: {
      pointers: [0, "benchFibJIT"],
    },
    compile(vm, method) {
      const cache = new Array(2*7).fill(null);  // [class, function]
      const PCtoSP = [0,1,2,1,0,1,0,1,2,1,1,2,3,2,2,1,2,1];
      function Integer_benchFib(rcvr) {
          var pc = 0;
          var t1, t2, t3;
          try {
              if (--vm.depth <= 0 || --vm.interruptCheckCounter <= 0) throw { message: "interrupted" };
              while (true) switch (pc) {
              case 0:
                  t1 = rcvr;
                  t2 = 2;
                  if (typeof t1 === 'number' && typeof t2 === 'number') { t1 = t1 < t2 ? vm.trueObj : vm.falseObj; }
                  else {
                      if (cache[2*0] !== t1.sqClass) vm.jitMethod(cache, 2*0, t1.sqClass, vm.specialSelectors[4], false); // #<
                      pc = 3; t1 = cache[2*0+1](t1, t2);
                  }
              case 3:
                  if (t1 === vm.falseObj) {pc = 7; continue}
                  else if (t1 !== vm.trueObj) {
                      if (cache[2*1] !== t1.sqClass) vm.jitMethod(cache, 2*1, t1.sqClass, vm.specialObjects[25], false); // #mustBeBoolean
                      pc = 4; t1 = cache[2*1+1](t1);
                  }
              case 4:
                  t1 = 1;
                  pc = 18; continue;
              case 7:
                  t1 = rcvr;
                  t2 = 1;
                  if (typeof t1 === 'number' && typeof t2 === 'number') { t1 -= t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
                  else {
                      if (cache[2*2] !== t1.sqClass) vm.jitMethod(cache, 2*2, t1.sqClass, vm.specialSelectors[2], false); // #-
                      pc = 10; t1 = cache[2*2+1](t1, t2);
                  }
              case 10:
                  if (cache[2*3] !== t1.sqClass) vm.jitMethod(cache, 2*3, t1.sqClass, method.pointers[1], false); // #benchFib
                  pc = 11; t1 = cache[2*3+1](t1);
              case 11:
                  t2 = rcvr;
                  t3 = 2;
                  if (typeof t2 === 'number' && typeof t3 === 'number') { t2 -= t3 ; if (t2 < -0x40000000 || t2 > 0x3FFFFFFF) t2 = vm.makeLarge(t2); }
                  else {
                      if (cache[2*4] !== t2.sqClass) vm.jitMethod(cache, 2*4, t2.sqClass, vm.specialSelectors[2], false); // #-
                      pc = 14; t2 = cache[2*4+1](t2, t3); }
              case 14:
                  if (cache[2*5] !== t2.sqClass) vm.jitMethod(cache, 2*5, t2.sqClass, method.pointers[1], false); // #benchFib
                  pc = 15; t2 = cache[2*5+1](t2);
              case 15:
                  if (typeof t1 === 'number' && typeof t2 === 'number') { t1 += t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
                  else {
                      if (cache[2*6] !== t1.sqClass) vm.jitMethod(cache, 2*6,t1.sqClass, vm.specialSelectors[0], false);  // #+
                      pc = 16; t1 = cache[2*6+1](t1, t2);
                  }
              case 16:
                  t2 = 1;
              case 17:
                  if (typeof t1 === 'number' && typeof t2 === 'number') { t1 += t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
                  else {
                      if (cache[2*7] !== t1.sqClass) vm.jitMethod(cache, 2*7, t1.sqClass, vm.specialSelectors[0], false); // #+
                      pc = 18; t1 = cache[2*7+1](t1, t2);
                  }
              case 18:
                  vm.depth++;
                  return t1;
              }
          } catch (frame) {
            if ("nonLocalReturnValue" in frame) { vm.depth++; throw frame; }
            // reify context and unwind all the way out of JIT
            frame.ctx = {
              class: "MethodContext",
              pointers: [frame.ctx, pc, PCtoSP[pc], method, vm.nilObj, rcvr, t1, t2, t3],
            };
            throw frame;
          }
      }
      return Integer_benchFib;
    },
  },
  // inline cache as individual temps rather than array
  benchFibJITNoArray: {
    compiled: null,
    method: {
      pointers: [0, "benchFibJITNoArray"],
    },
    compile(vm, method) {
      let c0 = null, c1 = null, c2 = null, c3 = null, c4 = null, c5 = null, c6 = null, c7 = null;
      let m0, m1, m2, m3, m4, m5, m6, m7;
      const PCtoSP = [0,1,2,1,0,1,0,1,2,1,1,2,3,2,2,1,2,1];
      function Integer_benchFib(rcvr) {
          var pc = 0;
          var t1, t2, t3;
          try {
              if (--vm.depth <= 0 || --vm.interruptCheckCounter <= 0) throw { message: "interrupted" };
              while (true) switch (pc) {
              case 0:
                  t1 = rcvr;
                  t2 = 2;
                  if (typeof t1 === 'number' && typeof t2 === 'number') { t1 = t1 < t2 ? vm.trueObj : vm.falseObj; }
                  else {
                      if (c0 !== t1.sqClass) m0 = vm.jitMethodNoArray(t1.sqClass, vm.specialSelectors[4], false, c => c0 = c); // #<
                      pc = 3; t1 = m0(t1, t2);
                  }
              case 3:
                  if (t1 === vm.falseObj) {pc = 7; continue}
                  else if (t1 !== vm.trueObj) {
                      if (c1 !== t1.sqClass) m1 = vm.jitMethodNoArray(t1.sqClass, vm.specialObjects[25], false, c => c1 = c); // #mustBeBoolean
                      pc = 4; t1 = m1(t1);
                  }
              case 4:
                  t1 = 1;
                  pc = 18; continue;
              case 7:
                  t1 = rcvr;
                  t2 = 1;
                  if (typeof t1 === 'number' && typeof t2 === 'number') { t1 -= t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
                  else {
                      if (c2 !== t1.sqClass) m2 = vm.jitMethodNoArray(t1.sqClass, vm.specialSelectors[2], false, c => c2 = c); // #-
                      pc = 10; t1 = m2(t1, t2);
                  }
              case 10:
                  if (c3 !== t1.sqClass) m3 = vm.jitMethodNoArray(t1.sqClass, method.pointers[1], false, c => c3 = c); // #benchFib
                  pc = 11; t1 = m3(t1);
              case 11:
                  t2 = rcvr;
                  t3 = 2;
                  if (typeof t2 === 'number' && typeof t3 === 'number') { t2 -= t3 ; if (t2 < -0x40000000 || t2 > 0x3FFFFFFF) t2 = vm.makeLarge(t2); }
                  else {
                      if (c4 !== t2.sqClass) m4 = vm.jitMethodNoArray(t2.sqClass, vm.specialSelectors[2], false, c => c4 = c); // #-
                      pc = 14; t2 = m4(t2, t3); }
              case 14:
                  if (c5 !== t2.sqClass) m5 = vm.jitMethodNoArray(t2.sqClass, method.pointers[1], false, c => c5 = c); // #benchFib
                  pc = 15; t2 = m5(t2);
              case 15:
                  if (typeof t1 === 'number' && typeof t2 === 'number') { t1 += t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
                  else {
                      if (c6 !== t1.sqClass) m6 = vm.jitMethodNoArray(t1.sqClass, vm.specialSelectors[0], false, c => c6 = c);  // #+
                      pc = 16; t1 = m6(t1, t2);
                  }
              case 16:
                  t2 = 1;
              case 17:
                  if (typeof t1 === 'number' && typeof t2 === 'number') { t1 += t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
                  else {
                      if (c7 !== t1.sqClass) m7 = vm.jitMethodNoArray(t1.sqClass, vm.specialSelectors[0], false, c => c7 = c); // #+
                      pc = 18; t1 = m7(t1, t2);
                  }
              case 18:
                  vm.depth++;
                  return t1;
              }
          } catch (frame) {
            if ("nonLocalReturnValue" in frame) { vm.depth++; throw frame; }
            // reify context and unwind all the way out of JIT
            frame.ctx = {
              class: "MethodContext",
              pointers: [frame.ctx, pc, PCtoSP[pc], method, vm.nilObj, rcvr, t1, t2, t3],
            };
            throw frame;
          }
      }
      return Integer_benchFib;
    },
  },
  // without switch (jumps decompiled into control structures)
  benchFibJITNoSwitch: {
    compiled: null,
    method: {
      pointers: [0, "benchFibJITNoSwitch"],
    },
    compile(vm, method) {
      const cache = new Array(2*7).fill(null);  // [class, function]
      const PCtoSP = [0,1,2,1,0,1,0,1,2,1,1,2,3,2,2,1,2,1];
      function Integer_benchFib(rcvr) {
        var pc = 0;
        var t1, t2, t3;
        try {
          if (--vm.depth <= 0 || --vm.interruptCheckCounter <= 0) throw { message: "interrupted" };
          t1 = rcvr;
          t2 = 2;
          if (typeof t1 === 'number' && typeof t2 === 'number') { t1 = t1 < t2 ? vm.trueObj : vm.falseObj; }
          else {
            if (cache[2*0] !== t1.sqClass) vm.jitMethod(cache, 2*0, t1.sqClass, vm.specialSelectors[4], false); // #<
            pc = 3; t1 = cache[2*0+1](t1, t2);
          }
          while (t1 !== vm.falseObj && t1 !== vm.trueObj) {
            if (cache[2*1] !== t1.sqClass) vm.jitMethod(cache, 2*1, t1.sqClass, vm.specialObjects[25], false); // #mustBeBoolean
            pc = 4; t1 = cache[2*1+1](t1);
          }
          if (t1 === vm.trueObj) {
            t1 = 1;
            pc = 18;
          } else {
            t1 = rcvr;
            t2 = 1;
            if (typeof t1 === 'number' && typeof t2 === 'number') { t1 -= t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
            else {
              if (cache[2*2] !== t1.sqClass) vm.jitMethod(cache, 2*2, t1.sqClass, vm.specialSelectors[2], false); // #-
              pc = 10; t1 = cache[2*2+1](t1, t2);
            }
            if (cache[2*3] !== t1.sqClass) vm.jitMethod(cache, 2*3, t1.sqClass, method.pointers[1], false); // #benchFib
            pc = 11; t1 = cache[2*3+1](t1);
            t2 = rcvr;
            t3 = 2;
            if (typeof t2 === 'number' && typeof t3 === 'number') { t2 -= t3 ; if (t2 < -0x40000000 || t2 > 0x3FFFFFFF) t2 = vm.makeLarge(t2); }
            else {
              if (cache[2*4] !== t2.sqClass) vm.jitMethod(cache, 2*4, t2.sqClass, vm.specialSelectors[2], false); // #-
              pc = 14; t2 = cache[2*4+1](t2, t3);
            }
            if (cache[2*5] !== t2.sqClass) vm.jitMethod(cache, 2*5, t2.sqClass, method.pointers[1], false); // #benchFib
            pc = 15; t2 = cache[2*5+1](t2);
            if (typeof t1 === 'number' && typeof t2 === 'number') { t1 += t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
            else {
              if (cache[2*6] !== t1.sqClass) vm.jitMethod(cache, 2*6,t1.sqClass, vm.specialSelectors[0], false);  // #+
              pc = 16; t1 = cache[2*6+1](t1, t2);
            }
            t2 = 1;
            if (typeof t1 === 'number' && typeof t2 === 'number') { t1 += t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
            else {
              if (cache[2*7] !== t1.sqClass) vm.jitMethod(cache, 2*7, t1.sqClass, vm.specialSelectors[0], false); // #+
              pc = 18; t1 = cache[2*7+1](t1, t2);
            }
          }
          vm.depth++;
          return t1;
        } catch (frame) {
          if ("nonLocalReturnValue" in frame) { vm.depth++; throw frame; }
          // reify context and unwind all the way out of JIT
          frame.ctx = {
            class: "MethodContext",
            pointers: [frame.ctx, pc, PCtoSP[pc], method, vm.nilObj, rcvr, t1, t2, t3],
          };
          throw frame;
        }
      }
      return Integer_benchFib;
    },
  },
  // without switch, and inline cache as individual temps rather than array
  benchFibJITNoSwitchNoArray: {
    compiled: null,
    method: {
      pointers: [0, "benchFibJITNoSwitchNoArray"],
    },
    compile(vm, method) {
      let c0 = null, c1 = null, c2 = null, c3 = null, c4 = null, c5 = null, c6 = null, c7 = null;
      let m0, m1, m2, m3, m4, m5, m6, m7;
      const PCtoSP = [0,1,2,1,0,1,0,1,2,1,1,2,3,2,2,1,2,1];
      function Integer_benchFib(rcvr) {
        var pc = 0;
        var t1, t2, t3;
        try {
          if (--vm.depth <= 0 || --vm.interruptCheckCounter <= 0) throw { message: "interrupted" };
          t1 = rcvr;
          t2 = 2;
          if (typeof t1 === 'number' && typeof t2 === 'number') { t1 = t1 < t2 ? vm.trueObj : vm.falseObj; }
          else {
            if (c0 !== t1.sqClass) m0 = vm.jitMethodNoArray(t1.sqClass, vm.specialSelectors[4], false, c => c0 = c); // #<
            pc = 3; t1 = m0(t1, t2);
          }
          while (t1 !== vm.falseObj && t1 !== vm.trueObj) {
            if (c1 !== t1.sqClass) m1 = vm.jitMethodNoArray(t1.sqClass, vm.specialObjects[25], false, c => c1 = c); // #mustBeBoolean
            pc = 4; t1 = m1(t1);
          }
          if (t1 === vm.trueObj) {
            t1 = 1;
            pc = 18;
          } else {
            t1 = rcvr;
            t2 = 1;
            if (typeof t1 === 'number' && typeof t2 === 'number') { t1 -= t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
            else {
              if (c2 !== t1.sqClass) m2 = vm.jitMethodNoArray(t1.sqClass, vm.specialSelectors[2], false, c => c2 = c); // #-
              pc = 10; t1 = m2(t1, t2);
            }
            if (c3 !== t1.sqClass) m3 = vm.jitMethodNoArray(t1.sqClass, method.pointers[1], false, c => c3 = c); // #benchFib
            pc = 11; t1 = m3(t1);
            t2 = rcvr;
            t3 = 2;
            if (typeof t2 === 'number' && typeof t3 === 'number') { t2 -= t3 ; if (t2 < -0x40000000 || t2 > 0x3FFFFFFF) t2 = vm.makeLarge(t2); }
            else {
              if (c4 !== t2.sqClass) m4 = vm.jitMethodNoArray(t2.sqClass, vm.specialSelectors[2], false, c => c4 = c); // #-
              pc = 14; t2 = m4(t2, t3);
            }
            if (c5 !== t2.sqClass) m5 = vm.jitMethodNoArray(t2.sqClass, method.pointers[1], false, c => c5 = c); // #benchFib
            pc = 15; t2 = m5(t2);
            if (typeof t1 === 'number' && typeof t2 === 'number') { t1 += t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
            else {
              if (c6 !== t1.sqClass) m6 = vm.jitMethodNoArray(t1.sqClass, vm.specialSelectors[0], false, c => c6 = c);  // #+
              pc = 16; t1 = m6(t1, t2);
            }
            t2 = 1;
            if (typeof t1 === 'number' && typeof t2 === 'number') { t1 += t2 ; if (t1 < -0x40000000 || t1 > 0x3FFFFFFF) t1 = vm.makeLarge(t1); }
            else {
              if (c7 !== t1.sqClass) m7 = vm.jitMethodNoArray(t1.sqClass, vm.specialSelectors[0], false, c => c7 = c); // #+
              pc = 18; t1 = m7(t1, t2);
            }
          }
          vm.depth++;
          return t1;
        } catch (frame) {
          if ("nonLocalReturnValue" in frame) { vm.depth++; throw frame; }
          // reify context and unwind all the way out of JIT
          frame.ctx = {
            class: "MethodContext",
            pointers: [frame.ctx, pc, PCtoSP[pc], method, vm.nilObj, rcvr, t1, t2, t3],
          };
          throw frame;
        }
      }
      return Integer_benchFib;
    },
  },
  // without type checks, assuming unsafe bytecodes as in SISTA
  benchFibJITNoSwitchNoArrayNoChecks: {
    compiled: null,
    method: {
      pointers: [0, "benchFibJITNoSwitchNoArrayNoChecks"],
    },
    compile(vm, method) {
      let c0 = null, m0, c1 = null, m1;
      function Integer_benchFib(rcvr) {
        var t1, t2, t3;
        t1 = rcvr;
        t2 = 2;
        t1 = t1 < t2 ? vm.trueObj : vm.falseObj;
        if (t1 === vm.trueObj) {
          t1 = 1;
        } else {
          t1 = rcvr;
          t2 = 1;
          t1 -= t2;
          if (c0 !== t1.sqClass) m0 = vm.jitMethodNoArray(t1.sqClass, method.pointers[1], false, c => c0 = c); // #benchFib
          t1 = m0(t1);
          t2 = rcvr;
          t3 = 2;
          t2 -= t3;
          if (c1 !== t2.sqClass) m1 = vm.jitMethodNoArray(t2.sqClass, method.pointers[1], false, c => c1 = c); // #benchFib
          t2 = m1(t2);
          t1 += t2;
          t2 = 1;
          t1 += t2;
        }
        return t1;
      }
      return Integer_benchFib;
    },
  },
};

// JIT helpers

const VM = {
    depth: 50,
    interruptCheckCounter: 1000000000,
    trueObj: { obj: "true" },
    falseObj: { obj: "false" },
    jitMethod(cache, index, cls, selector, supered) {
      const meth = methods[selector];
      if (!meth) throw "not implemented " + selector;
      if (!meth.compiled) {
        meth.compiled = meth.compile(this, meth.method);
      }
      cache[index] = cls;
      cache[index+1] = meth.compiled;
    },
    jitMethodNoArray(cls, selector, supered, setCls) {
      const meth = methods[selector];
      if (!meth) throw "not implemented " + selector;
      if (!meth.compiled) {
        meth.compiled = meth.compile(this, meth.method);
      }
      setCls(cls);
      return meth.compiled;
    },
};

const runs = Object.entries(methods);

function run() {
  try {
    const [name, method] = runs.shift();
    const start = Date.now();
    const n = 38;
    if (!method.compiled) method.compiled = method.compile(VM, method.method);
    const sends = method.compiled(n);
    const seconds = (Date.now() - start + 1) / 1000;
    const sendsPerSecond = sends / seconds;
    log(`${name}: ${sends} sends in ${seconds}s (${(sendsPerSecond / 1_000_000).toFixed(1)} MSends/s)`)
  } catch(ex) { log(ex.message, ex.stack) }
  if (runs.length) setTimeout(run, 100);
  else log("Done.");
}

log("Starting benchmarks...");
setTimeout(run, 100);