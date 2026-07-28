# Estado del proyecto — Smalltalk en el browser

> Documento de trabajo de este fork (`agustincico/SqueakJS`). No es del proyecto upstream.
> Última actualización: **2026-07-27**.

Sitio en vivo: **https://dialog.ar/SmalltalkJsVm/run/**

---

## 1. Qué está vivo hoy

| Imagen | Estado | Notas |
|---|---|---|
| **Squeak 6.0** | ✅ anda | `#zip=https://dialog.ar/Squeak.zip` |
| **Cuis 7.8** | ✅ anda | Se baja de su **repo oficial de GitHub** (manda CORS). Nota: esa imagen dispara un "JIT fault" que SqueakJS resuelve solo reiniciando sin JIT — preexistente, no afecta el uso |
| **Pharo 10 (32-bit)** | ✅ **anda bien** | Arranca **limpio** (sin debugger de FFI/git) y es **plenamente interactivo**. Es el que hay que mostrar |
| **Pharo 10 (64-bit)** | ✅ **anda** | Arranca limpio y responde (menús, listas, arrastre de ventanas). Requiere el `startup.st` de compatibilidad dentro del zip |
| **Dialogo** | ✅ anda | App de dibujo para chicos, `dialog.ar/Dialogo.zip` |
| **Demo Morphic** | ✅ anda | `dialog.ar/Pharo-demo.zip` — Pharo 32 abriendo una app propia al arrancar |

**Performance de Pharo** (medida con `sendCount` por tick, Chrome real):
- Arranque: **32-bit ≈ 5 s**, **64-bit ≈ 11 s** (el 64 pesa más por 8 bytes/oop).
- En reposo: **~23k sends/s en ambos** → la VM está casi dormida. **Pharo no es "pesado" en idle**;
  no hay ningún loop desbocado. El costo real es el arranque.

---

## 2. Deploy — ⚠️ NO hay auto-deploy

El sitio **no se sirve desde este repo**. Son dos repos y la copia es **manual**:

```
agustincico/SqueakJS          ProfeFuturo/profefuturo.github.io
      (el código)      ──────▶      └── SmalltalkJsVm/      ──────▶  dialog.ar
                        copia
                        MANUAL
```

No existe webhook ni GitHub Action (verificado: no hay `.github/workflows/` ni script de deploy).
**Pushear a `SqueakJS/main` no deploya nada por sí solo.**

### Runbook (2 pasos)

**Paso 1 — código a GitHub.** Ojo: la rama local `main` trackea `upstream` (codefrau), así que hay
que pushear explícito a `origin`:

```bash
git push origin main
```

**Paso 2 — copiar al repo del sitio.** El clone tiene que ser *disk-safe*: el historial pesa
~400 MB (binarios de Dialogo) y llena el disco.

```bash
git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/ProfeFuturo/profefuturo.github.io site
cd site && git sparse-checkout set SmalltalkJsVm     # aun así ocupa ~350 MB

# antes de copiar, confirmar que la copia del sitio == la versión previa de main,
# así el diff introduce SOLO el cambio buscado:
cmp <(git -C /ruta/SqueakJS show <commit-previo>:vm.interpreter.js) SmalltalkJsVm/vm.interpreter.js

cp /ruta/SqueakJS/<archivos-cambiados> SmalltalkJsVm/

# ⚠️ SI CAMBIÓ run/index.html: el sitio sirve el launcher en la RAÍZ del path
# (dialog.ar/SmalltalkJsVm/, sin /run/) desde una copia aparte con las rutas
# reescritas. Es la página que ve la gente. Regenerarla SIEMPRE, o queda una
# release atrás (ya pasó: la demo no aparecía porque sólo se actualizó run/):
python3 /ruta/SqueakJS/utils/mk-site-index.py /ruta/SqueakJS/run/index.html \
    > SmalltalkJsVm/index.html

git add SmalltalkJsVm/ && git commit && git push origin HEAD
cd .. && rm -rf site                                  # ¡borrar el clone al terminar!
```

**Paso 3 — verificar.** Pages reconstruye en ~1–2 min y hay CDN (`cache-control: max-age=600`),
así que hay que romper la caché:

```bash
curl -s "https://dialog.ar/SmalltalkJsVm/vm.interpreter.js?cb=$(date +%s)" | grep -c 'LGitLibrary'
```

Y después probar la imagen de verdad en Chrome (ver §5).

---

## 3. Ramas

| Rama | Trackea | Estado |
|---|---|---|
| `main` | `upstream` (codefrau) — pushear a `origin` explícito | Lo curado y deployable. Sincronizada con `origin/main` |
| `perf/stack-zone` | `origin` | **La rama de trabajo. 55 commits sin pushear a `origin`** |

**Los archivos del launcher (`run/index.html`, `run/squeakjs.css`, `squeak_worker.js`) ya están
sincronizados entre las dos ramas** — la UX de carga, el `first-frame` y los links nuevos se
portaron a `main` y se deployaron. `perf/stack-zone` conserva además el trabajo de perf
(stackzone/jit2) que no va a `main`.

> ⚠️ Al portar el worker a `main`, verificar siempre que sus `import` existan ahí: en su momento
> `vm.stackzone.js` / `jit2.js` (perf-only) rompieron el deploy con 404.

---

## 4. Hallazgos técnicos (ronda 9)

### 4.1 Debugger de FFI/git eliminado ✅ deployado

**Causa:** al arrancar, Iceberg llama `LGitLibrary class>>startUp:` → `initializeLibGit2` →
`libgit2_init`, un callout FFI que SqueakJS no puede resolver. `initializeLibGit2` captura el
error pero hace `ex pass` → **re-lanza** → Pharo abre un debugger post-mortem sobre un mundo
por lo demás sano. **Idéntico en 32-bit** (`Cannot locate libgit2`) **y 64-bit**
(`FFICallout subclassResponsibility`) — el 32 solo parecía sano porque el debugger se cierra.

**Fix** (`vm.interpreter.js`, commit `4565ea9` en main + `af3a99c` en el sitio): nueva operación
**`neuter`** en `hackImage`, que vuelve un método `^self` sobrescribiendo su primer bytecode con
*return-receiver* (Sista `0x58` / V3 `0x78`), solo si `methodPrimitiveIndex() === 0`:

```js
{method: "LGitLibrary class>>startUp:", neuter: true, enabled: true},
```

Pharo entonces corre **sin git**, igual que en una máquina sin libgit2. `LGitLibrary` solo existe
en Pharo → es no-op en Cuis y Squeak.

> 🔑 **Por qué no alcanzaba el mecanismo viejo:** `primitive: returnSelf (256)` hace
> `m.pointers[0] |= prim`, que funciona en imágenes V3 pero **no en Spur**, donde la primitiva se
> decodifica del primer bytecode (`callPrimitive`), no del header. De ahí el sobrescribir bytecode.

Quedó solo un aviso "VM does not support TFFI Callbacks" que se auto-cierra.

### 4.2 Pharo 64-bit ignoraba todo click ✅ resuelto

**Causa:** los métodos que `startup-compat64.st` inyecta en `HandMorph` usan variables del pool
`EventSensorConstants` (`EventTypeMouse`, `EventTypeKeyboard`, `EventKeyDown`…). El build 32-bit
declara ese pool en `HandMorph`; el 64-bit lo quitó junto con las clases clásicas de eventos, y el
script lo declaraba **sólo en las clases que crea**, nunca en `HandMorph`. Sin el pool esos nombres
compilan como **globales indefinidas — `nil` en silencio** (el compilador no falla), así que
`type = EventTypeMouse` era siempre falso, `nextEventFrom:` caía en `^ #invalid` y
`processEventsFromQueue:` retornaba **antes** de llamar a `handleEvent:`.

**Fix:** agregar el pool a `HandMorph` *antes* de compilar sus métodos.

**Cómo se localizó** (instrumentando el worker y clickeando el menú System): toda la cadena estaba
viva salvo el último eslabón.

| | antes | después |
|---|---|---|
| `doOneCycleFor:` / `processEvents` / `nextEvent` | +398 | +293 |
| `InputEventSensor>>processEvent:` | +5 | +5 |
| **`HandMorph>>handleEvent:`** | **0** ✗ | **+8** ✔ |
| redibujos | 0 | +53 |
| sends | +94k (tasa de reposo) | +897k |

> 💡 **Lección para futuros parches por script:** inyectar métodos en una clase **existente** no le
> agrega los pools/globals que esos métodos necesitan, y el compilador de Pharo **no falla** — crea
> la variable indefinida en `nil`. El síntoma aparece lejísimos del origen. Ante "compila pero se
> comporta como si todo fuera nil", sospechar del scope antes que de la lógica.

### 4.3 Carteles de Pharo 64 que "titilaban" ✅ resuelto

Los avisos semitransparentes (el de FFI al arrancar, el del atajo al abrir el browser) se
desvanecen por pasos y en 64-bit parecían reabrirse una y otra vez, mientras que en 32-bit funden
suave. **Causa:** `VMWorldRenderer` sí entra a `deferUpdatesDuring:`, pero la **primitiva 126 nunca
se ejecutaba**, porque el script no definía `DisplayScreen>>deferUpdates:` y la versión nativa del
build 64-bit (SDL2-only) no llega a la primitiva. Sin diferido, **cada BitBlt se propaga solo a la
pantalla**: el fundido redibujaba ~300 veces por segundo en vez de una vez por ciclo de Morphic.
**Fix:** portar `deferUpdates:` (instancia y class-side) del build 32-bit, agregando antes su class
var `DeferringUpdates` — misma trampa de scope que §4.2.

| mismo arranque | `deferUpdates: true` | draws | pico draws/seg |
|---|---|---|---|
| 32-bit | 21 | 21 | 3 |
| 64-bit antes | **0** | **1268** | **323** |
| 64-bit ahora | 21 | 21 | 4 |

> 🔍 **Trampa de medición que costó dos vueltas:** instrumentar contadores *después* del arranque
> (a los 40 s) mostró "0 llamadas" para métodos que **sí** se ejecutaban — los carteles ya habían
> terminado. Lo mismo con `vm.inputEventSemaIndex`, que en realidad vive en `primHandler`. Ante un
> contador en 0, verificar primero la ventana temporal y el objeto medido. Lo que destrabó el
> diagnóstico fue capturar `vm.printStack()` **dentro** del `putImageData`, que mostró la pila real.

### 4.4 Archivos fantasma en el cache del browser ✅ resuelto

`filePut` escribía la entrada de directorio (localStorage, sincrónica, nunca falla) **antes** que
el contenido (IndexedDB, asincrónico, sí falla al agotarse la cuota). Si la segunda fallaba, el
error sólo se logueaba y quedaba un **archivo fantasma**: listado con su tamaño pero ilegible para
siempre, que la imagen reportaba mucho después como `File read failed` (visto en Cuis, vía
`UniFileStream>>error:`) y que no se arreglaba solo — había que borrar los datos del sitio a mano.
Ahora `dbTransaction` acepta un callback de error opcional y `filePut` revierte la entrada, de modo
que el archivo simplemente falta y se vuelve a bajar. Además el callback de éxito ahora se dispara
igual en el camino de error: antes, `trans.onerror` no lo llamaba nunca y el `await` del flujo de
zip quedaba colgado para siempre (posible causa de cargas que "se congelaban").

### 4.5 Demo Morphic

`pharo/demo-startup.st` — ver `pharo/README.md`.

---

## 5. Cómo probar (tooling)

No hay `gh` CLI ni `puppeteer` instalados; sí **`puppeteer-core`** en `node_modules` y Chrome del
sistema. Los scripts hay que correrlos **desde la raíz del repo** (si no, no resuelve el módulo):

```js
const puppeteer = (await import("puppeteer-core")).default;   // ESM: import dinámico, no require
await puppeteer.launch({
  headless: "new",
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--use-gl=swiftshader"],
});
```

- Servidor local: `npx http-server -p 8091 -c-1`
- Probar una imagen: `http://localhost:8091/run/index.html#zip=<url-del-zip>`
- Los zips de prueba (Pharo 32/64) **no** van en el repo — bajarlos de `dialog.ar/Pharo.zip` y
  `dialog.ar/Pharo64.zip`.
- Señal de arranque: en `perf/stack-zone` escuchar el postMessage `first-frame`; en `main`, esperar
  por tiempo.
- Para medir performance, interceptar los mensajes `tick` del worker y leer `sends`.

---

## 6. TODO

### Media
- [ ] **Diagnosticar Pharo 11 / 12 / 13** — nunca se hizo. Son 64-bit only, así que probablemente
      arrastren el mismo problema de input.

### Baja
- [ ] Rearmar `Pharo-demo.zip` si se cambia `pharo/demo-startup.st` (el zip publicado lleva una
      copia como `startup.st`; no se actualiza solo).
- [ ] Bajar el tiempo de arranque del 64-bit (~11 s).
- [ ] `Character>>asByteArray` (FontSubstitutionDuringLoading) — sin diagnosticar, secundario.

---

## 7. Techo conocido: FFI

Pharo depende fuerte de FFI (`primitiveCalloutWithArgs`, `primitiveLoadSymbolFromModule`,
callbacks) para integrarse con el SO. **El FFI real no es viable en el sandbox del browser.** La
mayoría de los usos no son fatales (Pharo loguea y sigue); el que sí abría un debugger era el de
git/Iceberg, ya neutralizado.
