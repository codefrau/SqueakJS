"use strict";
// Driver de browser REAL (Chrome headless vía puppeteer-core) para tener feedback
// propio sin depender del usuario: levanta run/ con la imagen servida por HTTP,
// captura consola + errores, opcionalmente inyecta eventos de mouse REALES (que
// pasan por recordMouseEvent → display.runNow → interpret, la reentrancia que
// reproduce el crash de stackZone+jit2 que el harness headless no alcanzaba).
//
//   node perf/harness/browser.js [url] [--drive] [--secs N] [--events file.json]
// default url: http://localhost:8081/run/#stackZone&jit2&image=/Dialogo.32bits.image
//   --drive        mueve el mouse por el canvas + clicks (dispara el crash)
//   --secs N       segundos a esperar tras el boot (default 8)
//   --events F     replay de una grabación {width,height,events:[{at,ev}]}
//   --shot F.png   guarda screenshot al final

var fs = require("fs");
var CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

var args = process.argv.slice(2);
function opt(name, d) { var i = args.indexOf(name); return i >= 0 && args[i+1] && !args[i+1].startsWith("--") ? args[i+1] : d; }
var url = args.find(function(a){ return a.startsWith("http"); })
    || "http://localhost:8081/run/#stackZone&jit2&image=/Dialogo.32bits.image";
var drive = args.indexOf("--drive") >= 0;
var secs = parseInt(opt("--secs", "8"), 10);
var eventsFile = opt("--events", null);
var shot = opt("--shot", null);

var HARD_TIMEOUT = parseInt(opt("--timeout", "60"), 10) * 1000;
var hardKill = setTimeout(function(){ console.error("HARD TIMEOUT — matando"); process.exit(3); }, HARD_TIMEOUT);

(async function() {
    var puppeteer = (await import("puppeteer-core")).default;
    var browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: "new",
        args: ["--no-sandbox", "--disable-gpu", "--window-size=1024,820", "--use-gl=swiftshader"],
    });
    var page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 820 });
    // capturar stacks completos de los errores (console.error(errorObj) pierde el stack en msg.text())
    await page.evaluateOnNewDocument(function() {
        window.__sqErrors = [];
        var oe = console.error;
        console.error = function() {
            for (var i = 0; i < arguments.length; i++) {
                var a = arguments[i];
                if (a && a.stack) window.__sqErrors.push(String(a.stack));
            }
            return oe.apply(console, arguments);
        };
        window.addEventListener("error", function(e) { if (e.error && e.error.stack) window.__sqErrors.push(String(e.error.stack)); });
    });

    var logs = [], errors = [], ready = false;
    page.on("console", function(msg) {
        var t = msg.text();
        logs.push("[" + msg.type() + "] " + t);
        if (/squeak: ready/.test(t)) ready = true;
        if (msg.type() === "error") errors.push(t);
    });
    page.on("pageerror", function(err) { errors.push("PAGEERROR: " + err.message); });
    // los alert() de squeak.js tras un crash bloquean headless — auto-dismiss y registrar
    page.on("dialog", function(d) { errors.push("ALERT: " + d.message().split("\n")[0]); d.dismiss().catch(function(){}); });
    page.on("requestfailed", function(req) { errors.push("REQFAIL: " + req.url() + " " + (req.failure()||{}).errorText); });

    console.log("navegando: " + url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function(e){ errors.push("GOTO: " + e.message); });

    // esperar boot (squeak: ready) hasta 40s
    var t0 = Date.now();
    while (!ready && Date.now() - t0 < 40000) await new Promise(function(r){ setTimeout(r, 200); });
    console.log("boot: " + (ready ? "READY en " + ((Date.now()-t0)/1000).toFixed(1) + "s" : "NO llegó a ready (timeout)"));

    // confirmar modo
    var mode = await page.evaluate(function() {
        var vm = window.SqueakJS && SqueakJS.vm;
        return vm ? { useStackZone: !!vm.useStackZone, leafCount: vm.compiler && vm.compiler.leafCount, sends: vm.sendCount } : null;
    }).catch(function(){ return null; });
    console.log("modo: " + JSON.stringify(mode));

    var traceFile = opt("--trace", null);
    if (traceFile) { await page.tracing.start({ path: traceFile, categories: ["devtools.timeline", "toplevel", "v8.cpu_profiler", "disabled-by-default-v8.cpu_profiler"] }); console.log("tracing → " + traceFile); }

    if (eventsFile && fs.existsSync(eventsFile)) {
        var rec = JSON.parse(fs.readFileSync(eventsFile, "utf8"));
        var evs = Array.isArray(rec) ? rec : rec.events;
        console.log("replay de " + evs.length + " eventos grabados…");
        for (var i = 0; i < evs.length; i++) {
            var e = evs[i].ev || evs[i];
            if (e[0] === 1) { // mouse
                await page.mouse.move(e[2], e[3]);
                if (e[4] & 4) await page.mouse.down();
                else if (evs[i-1] && ((evs[i-1].ev||evs[i-1])[4] & 4)) await page.mouse.up();
            }
            if (i % 20 === 0) await new Promise(function(r){ setTimeout(r, 10); });
        }
    } else if (drive) {
        console.log("moviendo el mouse por el canvas + clicks…");
        for (var k = 0; k < 30; k++) {
            await page.mouse.move(100 + (k*27) % 800, 100 + (k*19) % 600);
            await new Promise(function(r){ setTimeout(r, 30); });
        }
        await page.mouse.click(400, 300);
        await new Promise(function(r){ setTimeout(r, 100); });
        await page.mouse.move(420, 320); await page.mouse.down();
        for (var k = 0; k < 10; k++) { await page.mouse.move(420 + k*20, 320 + k*10); await new Promise(function(r){ setTimeout(r, 20); }); }
        await page.mouse.up();
    }

    await new Promise(function(r){ setTimeout(r, secs * 1000); });
    if (traceFile) { await page.tracing.stop(); console.log("trace guardado: " + traceFile); }
    var sends2 = await page.evaluate(function(){ return window.SqueakJS && SqueakJS.vm ? SqueakJS.vm.sendCount : null; }).catch(function(){ return null; });
    if (shot) { await page.screenshot({ path: shot }).catch(function(){}); console.log("screenshot: " + shot); }

    var stacks = await page.evaluate(function(){ return window.__sqErrors || []; }).catch(function(){ return []; });
    if (stacks.length) {
        var uniq = {};
        stacks.forEach(function(s){ var key = s.split("\n").slice(0,6).join("\n"); uniq[key] = (uniq[key]||0)+1; });
        console.log("\n=== STACKS ÚNICOS (" + stacks.length + " errores) ===");
        Object.keys(uniq).forEach(function(k){ console.log("\n×" + uniq[k] + ":\n" + k); });
    }
    console.log("\n=== sendCount final: " + sends2 + " ===");
    console.log("=== ERRORES (" + errors.length + ") ===");
    var seen = {};
    errors.forEach(function(e){ var key = e.slice(0, 80); if (!seen[key]) { seen[key] = 0; } seen[key]++; });
    Object.keys(seen).forEach(function(k){ console.log("  ×" + seen[k] + "  " + k); });
    if (process.env.FULLLOG) { console.log("\n=== LOG COMPLETO ==="); logs.forEach(function(l){ console.log("  " + l); }); }

    await browser.close();
    process.exit(errors.length ? 1 : 0);
})().catch(function(e){ console.error("FATAL:", e); process.exit(2); });
