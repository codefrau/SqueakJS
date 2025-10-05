"use strict";

const wasmPrototypeState = {
    options: {
        directory: "dist/wasm",
        fileName: "interpreter-prototype.wasm",
        cacheName: "squeakjs:wasm-prototype",
        url: null,
        baseURL: null,
        basePath: null,
    },
    embedded: null,
    cachedBinary: null,
    loadPromise: null,
    memoryCache: new Map(),
    lastSource: "embedded",
    lastURL: null,
    metrics: {
        cacheHits: 0,
        cacheMisses: 0,
        networkLoads: 0,
        storageWrites: 0,
    },
};

function cloneBinary(binary) {
    if (!binary) return null;
    if (binary instanceof Uint8Array) {
        return binary.slice();
    }
    if (ArrayBuffer.isView(binary)) {
        const view = binary;
        return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
    }
    if (binary instanceof ArrayBuffer) {
        return new Uint8Array(binary.slice(0));
    }
    return new Uint8Array(binary);
}

function resetCachedBinary() {
    wasmPrototypeState.cachedBinary = null;
    wasmPrototypeState.loadPromise = null;
}

export function setEmbeddedWasmPrototypeBinary(binary) {
    wasmPrototypeState.embedded = binary ? cloneBinary(binary) : null;
    resetCachedBinary();
}

export function configureWasmPrototypeAsset(options = null) {
    if (!options || typeof options !== "object") {
        return getWasmPrototypeAssetURL();
    }
    const stateOptions = wasmPrototypeState.options;
    if (typeof options.directory === "string") {
        stateOptions.directory = options.directory;
    }
    if (typeof options.fileName === "string") {
        stateOptions.fileName = options.fileName;
    }
    if (typeof options.cacheName === "string" && options.cacheName !== stateOptions.cacheName) {
        stateOptions.cacheName = options.cacheName;
        cacheStoragePromise = null;
    }
    if (options.url === null) {
        stateOptions.url = null;
    } else if (typeof options.url === "string") {
        stateOptions.url = options.url;
    }
    if (options.baseURL === null) {
        stateOptions.baseURL = null;
    } else if (typeof options.baseURL === "string") {
        stateOptions.baseURL = options.baseURL;
    }
    if (options.basePath === null) {
        stateOptions.basePath = null;
    } else if (typeof options.basePath === "string") {
        stateOptions.basePath = options.basePath;
    }
    clearWasmPrototypeAssetCache();
    resetCachedBinary();
    return getWasmPrototypeAssetURL();
}

function ensureTrailingSlash(path) {
    if (!path) return "/";
    return path.endsWith("/") ? path : path + "/";
}

function resolveBaseURL() {
    const options = wasmPrototypeState.options;
    if (options.url) return null;
    if (options.baseURL) return ensureTrailingSlash(options.baseURL);
    if (options.basePath) return ensureTrailingSlash(options.basePath);
    if (typeof globalThis !== "undefined") {
        const squeak = globalThis.Squeak;
        if (squeak && typeof squeak.vmPath === "string" && squeak.vmPath) {
            return ensureTrailingSlash(squeak.vmPath);
        }
    }
    if (typeof document !== "undefined" && document.currentScript && document.currentScript.src) {
        const src = document.currentScript.src;
        const index = src.lastIndexOf("/");
        if (index >= 0) {
            return src.slice(0, index + 1);
        }
    }
    if (typeof location !== "undefined" && location.href) {
        const href = location.href;
        const index = href.lastIndexOf("/");
        if (index >= 0) {
            return href.slice(0, index + 1);
        }
    }
    return "./";
}

export function getWasmPrototypeAssetURL() {
    const options = wasmPrototypeState.options;
    if (options.url) {
        return options.url;
    }
    const base = resolveBaseURL();
    const directory = typeof options.directory === "string" ? options.directory : "";
    const fileName = typeof options.fileName === "string" ? options.fileName : "interpreter-prototype.wasm";
    let url = base || "./";
    let dir = directory || "";
    if (dir.startsWith("/")) dir = dir.slice(1);
    if (dir) {
        url = ensureTrailingSlash(url) + dir;
        if (!url.endsWith("/")) url += "/";
    } else {
        url = ensureTrailingSlash(url);
    }
    return url + fileName;
}

function getStreamingSupport() {
    return typeof WebAssembly === "object" && typeof WebAssembly.instantiateStreaming === "function";
}

function getCacheStorageSupport() {
    return typeof caches === "object" && caches !== null && typeof caches.open === "function";
}

let cacheStoragePromise = null;

async function getCacheStorage() {
    if (!getCacheStorageSupport()) return null;
    if (!cacheStoragePromise) {
        try {
            cacheStoragePromise = caches.open(wasmPrototypeState.options.cacheName || "squeakjs:wasm-prototype");
        } catch (_) {
            cacheStoragePromise = Promise.resolve(null);
        }
    }
    try {
        return await cacheStoragePromise;
    } catch (_) {
        return null;
    }
}

async function readFromCacheStorage(url) {
    const cache = await getCacheStorage();
    if (!cache) return null;
    try {
        const response = await cache.match(url);
        if (!response) return null;
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    } catch (_) {
        return null;
    }
}

async function writeToCacheStorage(url, binary) {
    const cache = await getCacheStorage();
    if (!cache) return false;
    if (typeof Response !== "function") return false;
    try {
        const response = new Response(binary, {
            headers: { "Content-Type": "application/wasm" },
        });
        await cache.put(url, response);
        wasmPrototypeState.metrics.storageWrites++;
        return true;
    } catch (_) {
        return false;
    }
}

async function fetchBinary(url) {
    if (typeof fetch !== "function") return null;
    try {
        const response = await fetch(url, { credentials: "same-origin" });
        if (!response || !response.ok) {
            return null;
        }
        const buffer = await response.arrayBuffer();
        const binary = new Uint8Array(buffer);
        wasmPrototypeState.metrics.networkLoads++;
        wasmPrototypeState.lastSource = "network";
        wasmPrototypeState.lastURL = url;
        const cached = binary.slice();
        wasmPrototypeState.memoryCache.set(url, cached);
        writeToCacheStorage(url, cached);
        return binary;
    } catch (_) {
        return null;
    }
}

async function loadBinary() {
    if (wasmPrototypeState.cachedBinary) {
        wasmPrototypeState.metrics.cacheHits++;
        wasmPrototypeState.lastSource = "memory";
        return wasmPrototypeState.cachedBinary.slice();
    }
    const url = getWasmPrototypeAssetURL();
    wasmPrototypeState.lastURL = url;
    if (url) {
        const fromMemory = wasmPrototypeState.memoryCache.get(url);
        if (fromMemory) {
            wasmPrototypeState.metrics.cacheHits++;
            wasmPrototypeState.lastSource = "memory";
            return fromMemory.slice();
        }
        const fromStorage = await readFromCacheStorage(url);
        if (fromStorage) {
            wasmPrototypeState.metrics.cacheHits++;
            wasmPrototypeState.lastSource = "storage";
            const cached = fromStorage.slice();
            wasmPrototypeState.memoryCache.set(url, cached);
            return fromStorage;
        }
        wasmPrototypeState.metrics.cacheMisses++;
        const fromNetwork = await fetchBinary(url);
        if (fromNetwork) {
            return fromNetwork.slice ? fromNetwork.slice() : cloneBinary(fromNetwork);
        }
    }
    if (wasmPrototypeState.embedded) {
        wasmPrototypeState.lastSource = "embedded";
        return wasmPrototypeState.embedded.slice();
    }
    throw new Error("No WebAssembly prototype binary available");
}

export async function loadWasmPrototypeBinary() {
    if (!wasmPrototypeState.loadPromise) {
        wasmPrototypeState.loadPromise = loadBinary()
            .then(function(binary) {
                wasmPrototypeState.cachedBinary = binary.slice();
                return wasmPrototypeState.cachedBinary.slice();
            })
            .catch(function(error) {
                wasmPrototypeState.cachedBinary = null;
                throw error;
            })
            .finally(function() {
                wasmPrototypeState.loadPromise = null;
            });
    }
    const binary = await wasmPrototypeState.loadPromise;
    return binary.slice();
}

export async function getWasmPrototypeStreamingResponse() {
    if (!getStreamingSupport()) return null;
    const url = getWasmPrototypeAssetURL();
    if (!url || typeof fetch !== "function") return null;
    try {
        const response = await fetch(url, { credentials: "same-origin" });
        if (!response || !response.ok) return null;
        if (typeof response.clone !== "function") return null;
        const clone = response.clone();
        const buffer = await clone.arrayBuffer();
        const binary = new Uint8Array(buffer);
        wasmPrototypeState.metrics.networkLoads++;
        wasmPrototypeState.lastSource = "network";
        wasmPrototypeState.lastURL = url;
        const cached = binary.slice();
        wasmPrototypeState.memoryCache.set(url, cached);
        wasmPrototypeState.cachedBinary = cached.slice();
        writeToCacheStorage(url, cached);
        return { url, response, binary: cached.slice() };
    } catch (_) {
        return null;
    }
}

export function clearWasmPrototypeAssetCache() {
    wasmPrototypeState.memoryCache.clear();
    wasmPrototypeState.cachedBinary = null;
    wasmPrototypeState.loadPromise = null;
    wasmPrototypeState.lastSource = wasmPrototypeState.embedded ? "embedded" : "unknown";
}

export function getWasmPrototypeAssetCapabilities() {
    return {
        streaming: getStreamingSupport(),
        cacheStorage: getCacheStorageSupport(),
    };
}

export function getWasmPrototypeCacheStats() {
    return {
        lastSource: wasmPrototypeState.lastSource,
        lastURL: wasmPrototypeState.lastURL,
        cacheHits: wasmPrototypeState.metrics.cacheHits,
        cacheMisses: wasmPrototypeState.metrics.cacheMisses,
        networkLoads: wasmPrototypeState.metrics.networkLoads,
        storageWrites: wasmPrototypeState.metrics.storageWrites,
        memoryEntries: wasmPrototypeState.memoryCache.size,
    };
}

export function getEmbeddedWasmPrototypeBinary() {
    return cloneBinary(wasmPrototypeState.embedded);
}

export default {
    configureWasmPrototypeAsset,
    setEmbeddedWasmPrototypeBinary,
    getWasmPrototypeAssetURL,
    loadWasmPrototypeBinary,
    clearWasmPrototypeAssetCache,
    getWasmPrototypeAssetCapabilities,
    getWasmPrototypeCacheStats,
    getEmbeddedWasmPrototypeBinary,
    getWasmPrototypeStreamingResponse,
};
