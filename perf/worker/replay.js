"use strict";
// Reproduce una grabación de eventos del worker (dialogo-worker-events.json, hecha con
// los botones de perf/worker/index.html) en el worker REAL vía puppeteer headless.
// Sirve para reproducir bugs interactivos (ej. el OOM al abrir un proyecto) y validar
// fixes sin depender de que el usuario pruebe a mano.
//
//   node perf/worker/replay.js <events.json> [--secs 30] [--url http://localhost:8081/perf/worker/index.html] [--shot /tmp/replay.png] [--hash grep]
//
// Reporta: sends a lo largo del tiempo, líneas de consola que matcheen /oom|memory|error|
// crash|space|missing/i, y un screenshot final.
var fs = require("fs");

function arg(name, def) { var i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

var eventsPath = process.argv[2];
if (!eventsPath || eventsPath.startsWith("--")) { console.error("uso: node replay.js <events.json> [--secs N] [--url U] [--shot P]"); process.exit(1); }
var secs = parseInt(arg("--secs", "30"), 10);
var url = arg("--url", "http://localhost:8081/perf/worker/index.html");
var shot = arg("--shot", "/tmp/worker-replay.png");
var chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

(async () => {
    var evData = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
    var events = Array.isArray(evData) ? evData : evData.events;
    console.log("replay:", eventsPath, "|", events.length, "eventos |", secs + "s");

    var puppeteer = (await import("puppeteer-core")).default;
    var b = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox", "--use-gl=swiftshader"] });
    var p = await b.newPage();
    await p.setViewport({ width: (evData.width || 1024) + 16, height: (evData.height || 768) + 120 });

    var log = [];
    b.on("targetcreated", async t => { if (t.type() === "worker") { try { var w = await t.worker(); w.on("console", m => log.push(m.text())); } catch (e) {} } });
    p.on("console", m => log.push(m.text()));
    p.on("dialog", d => d.dismiss());

    await p.goto(url, { waitUntil: "domcontentloaded" });
    // esperar a que el worker bootee (status con sends)
    await new Promise(r => setTimeout(r, 6000));
    var sendsOf = () => p.evaluate(() => { var m = (document.getElementById("status").textContent || "").match(/sends: (\d+)/); return m ? +m[1] : 0; });
    console.log("boot listo, sends:", await sendsOf());

    // disparar el replay
    var n = await p.evaluate(evs => window.__replayEvents(evs), events);
    console.log("replay lanzado:", n, "eventos");

    // muestrear sends + detectar OOM/errores mientras corre
    var oomSeen = 0;
    for (var s = 0; s < secs; s += 3) {
        await new Promise(r => setTimeout(r, 3000));
        var sc = await sendsOf();
        var oom = log.filter(l => /out of memory|failing allocation/i.test(l)).length;
        var errs = log.filter(l => /error|not defined|not a function|crash/i.test(l)).length;
        console.log("  t=" + (s + 3) + "s  sends=" + sc + "  oom=" + oom + "  errs=" + errs);
        oomSeen = oom;
    }

    console.log("--- consola relevante ---");
    var rel = [...new Set(log.filter(l => /oom|out of memory|failing allocation|error|not defined|not a function|crash|low space|missing primitive/i.test(l)))];
    console.log(rel.slice(0, 20).join("\n") || "(nada relevante)");
    await p.screenshot({ path: shot });
    console.log("screenshot:", shot);
    await b.close();
    process.exit(oomSeen > 0 ? 2 : 0);
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
