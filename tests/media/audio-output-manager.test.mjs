"use strict";

import assert from "assert";

if (typeof globalThis.self === "undefined") {
    globalThis.self = globalThis;
}

await import("../../globals.js");
await import("../../vm.audio.browser.js");

function installAudioEnvironment({ supportWorklet = true, rejectWorklet = false, immediateTimers = false } = {}) {
    const original = {
        AudioContext: global.AudioContext,
        webkitAudioContext: global.webkitAudioContext,
        AudioWorkletNode: global.AudioWorkletNode,
        Blob: global.Blob,
        URL: global.URL,
        setTimeout: global.setTimeout,
        crossOriginIsolated: Object.prototype.hasOwnProperty.call(global, "crossOriginIsolated") ? global.crossOriginIsolated : undefined,
    };

    class FakeAudioContext {
        constructor() {
            this.sampleRate = 44100;
            this.destination = {};
            this.currentTime = 0;
            this.state = "suspended";
            this.closed = false;
            this.createdBuffers = [];
            this.createdSources = [];
            if (supportWorklet) {
                const self = this;
                this.audioWorklet = {
                    addModule() {
                        return rejectWorklet ? Promise.reject(new Error("worklet failed")) : Promise.resolve("ok");
                    },
                };
                this._resumeCalled = false;
            } else {
                this.audioWorklet = null;
            }
        }

        resume() {
            this.state = "running";
            this._resumeCalled = true;
            return Promise.resolve();
        }

        close() {
            this.closed = true;
            return Promise.resolve();
        }

        createBuffer(channels, frames, sampleRate) {
            const data = Array.from({ length: channels }, () => new Float32Array(frames));
            const buffer = {
                length: frames,
                numberOfChannels: channels,
                duration: frames / sampleRate,
                getChannelData(channel) {
                    return data[channel];
                },
            };
            this.createdBuffers.push(buffer);
            return buffer;
        }

        createBufferSource() {
            const context = this;
            const source = {
                buffer: null,
                connected: false,
                startTime: null,
                connect() {
                    source.connected = true;
                },
                start(when) {
                    source.startTime = when;
                    context.currentTime = when;
                },
            };
            this.createdSources.push(source);
            return source;
        }
    }

    class FakeAudioWorkletNode {
        constructor(context, name, options) {
            this.context = context;
            this.name = name;
            this.options = options;
            this.connected = false;
            this.port = {
                onmessage: null,
                _messages: [],
                postMessage: (payload) => {
                    this.port._messages.push(payload);
                },
            };
        }

        connect(destination) {
            this.connected = destination;
        }

        disconnect() {
            this.connected = null;
        }
    }

    class FakeBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.type = options && options.type;
        }
    }

    global.AudioContext = FakeAudioContext;
    delete global.webkitAudioContext;
    if (supportWorklet) {
        global.AudioWorkletNode = FakeAudioWorkletNode;
        global.crossOriginIsolated = true;
    } else {
        global.AudioWorkletNode = undefined;
        global.crossOriginIsolated = false;
    }
    global.Blob = FakeBlob;
    global.URL = {
        createObjectURL() {
            return "blob:fake";
        },
        revokeObjectURL() {},
    };
    if (immediateTimers) {
        global.setTimeout = (fn) => {
            fn();
            return 0;
        };
    }

    return function restore() {
        if (original.AudioContext === undefined) delete global.AudioContext;
        else global.AudioContext = original.AudioContext;
        if (original.webkitAudioContext === undefined) delete global.webkitAudioContext;
        else global.webkitAudioContext = original.webkitAudioContext;
        if (original.AudioWorkletNode === undefined) delete global.AudioWorkletNode;
        else global.AudioWorkletNode = original.AudioWorkletNode;
        if (original.Blob === undefined) delete global.Blob;
        else global.Blob = original.Blob;
        if (original.URL === undefined) delete global.URL;
        else global.URL = original.URL;
        if (original.setTimeout === undefined) delete global.setTimeout;
        else global.setTimeout = original.setTimeout;
        if (original.crossOriginIsolated === undefined) delete global.crossOriginIsolated;
        else global.crossOriginIsolated = original.crossOriginIsolated;
    };
}

async function testWorkletPipeline() {
    const restore = installAudioEnvironment();
    try {
        Squeak.stopAudioOut();
        let freedCount = 0;
        const session = Squeak.ensureAudioOutputSession({
            bufferFrames: 256,
            sampleRate: 44100,
            channels: 2,
            onBufferFreed() {
                freedCount += 1;
            },
        });
        assert.ok(session, "session should be created");
        assert.strictEqual(session.type, "worklet");
        await session.readyPromise;
        const initialAvailable = session.availableByteCount();
        const expectedInitial = (session.capacityFrames - 1) * session.channels * 2;
        assert.strictEqual(initialAvailable, expectedInitial);
        const frames = session.bufferFrames;
        const samples = new Int16Array(frames * session.channels);
        const enqueued = session.enqueueSamples(samples, 0, frames);
        assert.ok(enqueued, "enqueue should succeed when space is available");
        const afterAvailable = session.availableByteCount();
        assert.strictEqual(afterAvailable, initialAvailable - frames * session.channels * 2);
        session.node.port.onmessage({ data: { type: "freed", frames } });
        assert.strictEqual(freedCount, 1, "onBufferFreed should fire once per freed buffer");
        session.stop();
    } finally {
        restore();
        Squeak.stopAudioOut();
        Squeak.audioOutputManager = null;
    }
}

async function testWorkletFallback() {
    const restore = installAudioEnvironment({ rejectWorklet: true, immediateTimers: true });
    try {
        Squeak.stopAudioOut();
        let freedCount = 0;
        const session = Squeak.ensureAudioOutputSession({
            bufferFrames: 128,
            sampleRate: 22050,
            channels: 1,
            onBufferFreed() {
                freedCount += 1;
            },
        });
        assert.ok(session);
        assert.strictEqual(session.type, "worklet");
        await session.readyPromise.catch(() => {});
        assert.ok(session.fallbackSession, "fallback session should be installed after worklet failure");
        const initialAvailable = session.availableByteCount();
        const expectedInitial = session.fallbackSession.availableByteCount();
        assert.strictEqual(initialAvailable, expectedInitial);
        const frames = session.bufferFrames;
        const samples = new Int16Array(frames * session.channels);
        assert.ok(session.enqueueSamples(samples, 0, frames));
        assert.ok(freedCount >= 1, "fallback should notify freed buffers");
        session.stop();
    } finally {
        restore();
        Squeak.stopAudioOut();
        Squeak.audioOutputManager = null;
    }
}

async function testLegacyPipeline() {
    const restore = installAudioEnvironment({ supportWorklet: false, immediateTimers: true });
    try {
        Squeak.stopAudioOut();
        let freedCount = 0;
        const session = Squeak.ensureAudioOutputSession({
            bufferFrames: 64,
            sampleRate: 16000,
            channels: 2,
            onBufferFreed() {
                freedCount += 1;
            },
        });
        assert.ok(session);
        assert.strictEqual(session.type, "legacy");
        const expectedInitial = 3 * session.bufferFrames * session.channels * 2;
        assert.strictEqual(session.availableByteCount(), expectedInitial);
        const samples = new Int16Array(session.bufferFrames * session.channels);
        assert.ok(session.enqueueSamples(samples, 0, session.bufferFrames));
        assert.ok(freedCount >= 1, "legacy session should release buffers asynchronously");
        session.stop();
    } finally {
        restore();
        Squeak.stopAudioOut();
        Squeak.audioOutputManager = null;
    }
}

await testWorkletPipeline();
await testWorkletFallback();
await testLegacyPipeline();
