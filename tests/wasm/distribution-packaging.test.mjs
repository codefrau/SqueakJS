import assert from "assert";
import {
    loadWasmPrototypeBinary,
    configureWasmPrototypeAsset,
    getWasmPrototypeCacheStats,
    clearWasmPrototypeAssetCache,
} from "../../vm.execution.assets.js";
import { resetWasmPrototypeInstance, getWasmPrototypeBinary } from "../../vm.interpreter.wasm.js";

(async function main() {
    const originalFetch = globalThis.fetch;
    const originalCaches = globalThis.caches;
    const originalResponse = globalThis.Response;

    const assetURL = "https://example.com/runtime/pkg/interpreter-prototype.wasm";
    const wasmHeader = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    let fetchCount = 0;

    globalThis.fetch = async function(url) {
        fetchCount++;
        assert.strictEqual(url, assetURL, "unexpected asset URL");
        return {
            ok: true,
            status: 200,
            clone() {
                return {
                    arrayBuffer: async () => wasmHeader.buffer.slice(0),
                };
            },
            arrayBuffer: async () => wasmHeader.buffer.slice(0),
        };
    };

    globalThis.caches = {
        _store: new Map(),
        async open() {
            const store = this._store;
            return {
                async match(url) {
                    const entry = store.get(url);
                    if (!entry) return undefined;
                    return {
                        async arrayBuffer() {
                            return entry.slice(0).buffer;
                        },
                    };
                },
                async put(url, response) {
                    if (!response || typeof response.arrayBuffer !== "function") return;
                    const buffer = await response.arrayBuffer();
                    store.set(url, new Uint8Array(buffer));
                },
            };
        },
    };

    globalThis.Response = class {
        constructor(body) {
            const payload = body instanceof Uint8Array ? body : new Uint8Array(body || []);
            this._buffer = payload.buffer.slice(0);
        }
        async arrayBuffer() {
            return this._buffer.slice(0);
        }
    };

    clearWasmPrototypeAssetCache();
    configureWasmPrototypeAsset({ url: assetURL, baseURL: null, basePath: null });
    resetWasmPrototypeInstance();

    const firstLoad = await loadWasmPrototypeBinary();
    assert.strictEqual(fetchCount, 1, "first load should fetch the asset");
    assert.strictEqual(firstLoad.byteLength, wasmHeader.byteLength, "binary length mismatch");

    const secondLoad = await loadWasmPrototypeBinary();
    assert.strictEqual(fetchCount, 1, "subsequent load should reuse cache");
    assert.deepStrictEqual(Array.from(firstLoad), Array.from(secondLoad), "cached binary mismatch");

    const cachedStats = getWasmPrototypeCacheStats();
    assert.ok(cachedStats.cacheHits >= 1, "expected cache hit after second load");
    assert.ok(["memory", "storage"].includes(cachedStats.lastSource), "unexpected cache source: " + cachedStats.lastSource);

    globalThis.fetch = async function() {
        throw new Error("network offline");
    };
    clearWasmPrototypeAssetCache();
    configureWasmPrototypeAsset({ url: null, baseURL: null, basePath: null });
    const fallback = await loadWasmPrototypeBinary();
    const embedded = getWasmPrototypeBinary();
    assert.strictEqual(fallback.byteLength, embedded.byteLength, "fallback should return embedded binary");
    const fallbackStats = getWasmPrototypeCacheStats();
    assert.strictEqual(fallbackStats.lastSource, "embedded", "fallback should report embedded source");

    clearWasmPrototypeAssetCache();

    if (originalFetch === undefined) delete globalThis.fetch; else globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches; else globalThis.caches = originalCaches;
    if (originalResponse === undefined) delete globalThis.Response; else globalThis.Response = originalResponse;
})();
