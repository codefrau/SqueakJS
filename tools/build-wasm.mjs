#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
    getWasmPrototypeBinary,
    getWasmPrototypeWat,
    wasmPrototypeMetadata,
} from "../vm.interpreter.wasm.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export async function buildWasmPrototype(options = {}) {
    const outDir = options.outDir || path.join(projectRoot, "dist", "wasm");
    await fs.mkdir(outDir, { recursive: true });
    const binaryPath = path.join(outDir, options.binaryName || "interpreter-prototype.wasm");
    const watPath = path.join(outDir, options.watName || "interpreter-prototype.wat");
    const metaPath = path.join(outDir, options.metaName || "interpreter-prototype.json");

    const binary = getWasmPrototypeBinary();
    const wat = getWasmPrototypeWat();
    const metadata = {
        ...wasmPrototypeMetadata,
        generatedAt: new Date().toISOString(),
    };

    await Promise.all([
        fs.writeFile(binaryPath, Buffer.from(binary)),
        fs.writeFile(watPath, wat, "utf8"),
        fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf8"),
    ]);

    return { binaryPath, watPath, metaPath, metadata };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    buildWasmPrototype()
        .then(function(result) {
            console.log("WASM prototype written to", result.binaryPath);
            console.log("WAT source written to", result.watPath);
            console.log("Metadata written to", result.metaPath);
        })
        .catch(function(error) {
            console.error("Failed to build WASM prototype", error);
            process.exitCode = 1;
        });
}
