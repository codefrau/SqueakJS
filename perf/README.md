# perf/ — proyecto stack zone (frames planos + reificación perezosa de Contexts)

Ver [stack-zone-design.md](stack-zone-design.md) para el diseño completo, las reglas
de reificación verificadas contra el código, y el plan por fases.

## spike/ — benchmarks fase 0 (sintéticos)

Cinco variantes del mismo `fib(32)` por sends (7.05M activaciones) que aíslan
(a) contexts heap vs frames planos y (b) JS vs WASM. Resultados 2026-07-05
(Node 20, M-series):

| variante | ms | vs V1 |
|---|---|---|
| V1 contexts + trampolín (≈ jit.js actual) | 198 | 1.00x |
| V2 frames + trampolín (JS puro, camino incremental) | 143 | **1.38x** |
| V3 frames + intérprete de bytecodes JS | 313 | 0.63x |
| V4 frames + intérprete de bytecodes WASM | 183 | 1.08x |
| V5 frames + métodos compilados WASM (estimador fase 2) | 74 | **2.7x** |

Correr:

```
npm install --no-save assemblyscript
npx asc perf/spike/as/frames.ts --target release -O3 --noAssert --runtime stub \
    --initialMemory 2 --outFile perf/spike/as/frames.wasm
node perf/spike/bench2.js   # desde perf/spike/
```

## harness/ — oráculo diferencial (paso 0)

Corre `ws/client/cuis.image` headless en Node con reloj virtual determinista y
acumula un hash de la traza de ejecución (pc/método/sends en cada checkpoint).
Dos corridas del mismo VM producen el mismo hash; un VM modificado que diverge
en semántica produce otro hash → detección automática de bugs sin tests en-imagen.

```
node perf/harness/difftrace.js --golden   # graba perf/harness/golden.json
node perf/harness/difftrace.js            # compara contra el golden
node perf/harness/difftrace.js --bench    # mide tiempo real (reloj de verdad)
```
