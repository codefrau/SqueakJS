"use strict";

import assert from "assert";

if (typeof globalThis.self === "undefined") {
    globalThis.self = globalThis;
}

await import("../../globals.js");
await import("../../vm.audio.browser.js");

function installAudioEnvironment({ immediateTimers = false } = {}) {
    const original = {
        AudioContext: global.AudioContext,
        webkitAudioContext: global.webkitAudioContext,
        AudioWorkletNode: global.AudioWorkletNode,
        setTimeout: global.setTimeout,
        clearTimeout: global.clearTimeout,
        setInterval: global.setInterval,
        clearInterval: global.clearInterval,
        navigator: global.navigator,
    };

    class FakeAudioContext {
        constructor() {
            this.sampleRate = 48000;
            this.destination = {};
            this.currentTime = 0;
            this.state = "running";
            this.closed = false;
            this.createdProcessors = [];
            this.createdBuffers = [];
            this.createdSources = [];
        }

        resume() {
            this.state = "running";
            return Promise.resolve();
        }

        close() {
            this.closed = true;
            return Promise.resolve();
        }

        createScriptProcessor(bufferSize, inputChannels, outputChannels) {
            const processor = {
                bufferSize: bufferSize || 0,
                inputChannels,
                outputChannels,
                connected: false,
                onaudioprocess: null,
                connect: function() { processor.connected = true; },
                disconnect: function() { processor.connected = false; },
            };
            this.createdProcessors.push(processor);
            return processor;
        }

        createBuffer(channels, frames) {
            const data = Array.from({ length: channels }, () => new Float32Array(frames));
            const buffer = {
                length: frames,
                numberOfChannels: channels,
                duration: frames / this.sampleRate,
                getChannelData(channel) { return data[channel]; },
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
                connect() { source.connected = true; },
                start(when) { source.startTime = when; context.currentTime = when; },
            };
            this.createdSources.push(source);
            return source;
        }

        createMediaStreamSource() {
            return {
                connect() {},
            };
        }
    }

    global.AudioContext = FakeAudioContext;
    delete global.webkitAudioContext;
    delete global.AudioWorkletNode;

    if (!original.navigator) {
        global.navigator = {};
    }
    if (global.navigator) {
        global.navigator.mediaDevices = null;
    }

    if (immediateTimers) {
        let timerId = 1;
        global.setTimeout = (fn) => {
            if (typeof fn === "function") fn();
            return timerId++;
        };
        global.clearTimeout = () => {};
        global.setInterval = (fn) => {
            if (typeof fn === "function") {
                fn();
                fn();
                fn();
            }
            return timerId++;
        };
        global.clearInterval = () => {};
    }

    return function restore() {
        if (original.AudioContext === undefined) delete global.AudioContext;
        else global.AudioContext = original.AudioContext;
        if (original.webkitAudioContext === undefined) delete global.webkitAudioContext;
        else global.webkitAudioContext = original.webkitAudioContext;
        if (original.AudioWorkletNode === undefined) delete global.AudioWorkletNode;
        else global.AudioWorkletNode = original.AudioWorkletNode;
        if (original.setTimeout === undefined) delete global.setTimeout;
        else global.setTimeout = original.setTimeout;
        if (original.clearTimeout === undefined) delete global.clearTimeout;
        else global.clearTimeout = original.clearTimeout;
        if (original.setInterval === undefined) delete global.setInterval;
        else global.setInterval = original.setInterval;
        if (original.clearInterval === undefined) delete global.clearInterval;
        else global.clearInterval = original.clearInterval;
        if (original.navigator === undefined) delete global.navigator;
        else global.navigator = original.navigator;
    };
}

function floatToInt16(samples) {
    const output = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        let value = samples[i];
        if (value > 1) value = 1;
        else if (value < -1) value = -1;
        output[i] = Math.round(value * 32767);
    }
    return output;
}

const restore = installAudioEnvironment({ immediateTimers: true });

try {
    // Synthetic source test
    Squeak.configureAudioInput({ mode: "synthetic", synthetic: { frequency: 220, amplitude: 0.5, blockFrames: 128 } });
    const syntheticChunks = [];
    await new Promise((resolve, reject) => {
        let resolved = false;
        Squeak.startAudioIn((context, session) => {
            const processor = context.createScriptProcessor(128, 1, 1);
            processor.onaudioprocess = (event) => {
                const data = event.inputBuffer.getChannelData(0);
                syntheticChunks.push(Array.from(data));
                if (!resolved && syntheticChunks.length >= 3) {
                    resolved = true;
                    session.stop();
                    resolve({ context, session });
                }
            };
            session.connectProcessor(processor);
        }, reject, { sampleRate: 16000, channels: 1 });
    });

    assert.ok(syntheticChunks.length >= 1, "synthetic source did not produce audio");
    const firstChunk = syntheticChunks[0];
    const maxSample = Math.max(...firstChunk);
    const minSample = Math.min(...firstChunk);
    assert.ok(maxSample > 0.1, "synthetic max amplitude too low");
    assert.ok(minSample < -0.1, "synthetic min amplitude too high");

    const diagnostics = Squeak.audioInputDiagnostics();
    assert.strictEqual(diagnostics.mode, "synthetic");
    assert.ok(diagnostics.activeSession);
    assert.strictEqual(diagnostics.activeSession.mode, "synthetic");

    let freedCount = 0;
    const outputSession = Squeak.ensureAudioOutputSession({
        bufferFrames: firstChunk.length,
        sampleRate: 16000,
        channels: 1,
        onBufferFreed: () => { freedCount++; },
    });
    const int16 = floatToInt16(firstChunk);
    assert.ok(outputSession.enqueueSamples(int16, 0, firstChunk.length));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(freedCount > 0, "audio output did not release buffers");
    Squeak.stopAudioOut();
    Squeak.stopAudioIn();

    // File-backed source test
    const pattern = [0.25, -0.25, 0.75, -0.75];
    const samples = new Float32Array(pattern);
    Squeak.registerAudioInputFile("loop", { samples, sampleRate: 22050, channels: 1, loop: true });
    Squeak.configureAudioInput({ mode: "file", fileId: "loop", file: { blockFrames: 64 } });
    const fileChunks = [];
    await new Promise((resolve, reject) => {
        let resolved = false;
        Squeak.startAudioIn((context, session) => {
            const processor = context.createScriptProcessor(64, 1, 1);
            processor.onaudioprocess = (event) => {
                const data = event.inputBuffer.getChannelData(0);
                fileChunks.push(Array.from(data));
                if (!resolved && fileChunks.length >= 2) {
                    resolved = true;
                    session.stop();
                    resolve();
                }
            };
            session.connectProcessor(processor);
        }, reject, { sampleRate: 22050, channels: 1 });
    });

    assert.ok(fileChunks.length >= 1, "file source did not produce audio");
    const recorded = fileChunks[0];
    for (let i = 0; i < Math.min(recorded.length, 8); i++) {
        assert.strictEqual(recorded[i], pattern[i % pattern.length]);
    }

    const fileDiagnostics = Squeak.audioInputDiagnostics();
    assert.strictEqual(fileDiagnostics.mode, "file");
    assert.ok(fileDiagnostics.activeSession);
    assert.strictEqual(fileDiagnostics.activeSession.mode, "file");

    Squeak.unregisterAudioInputFile("loop");
    Squeak.stopAudioIn();
} finally {
    Squeak.stopAudioOut();
    Squeak.stopAudioIn();
    restore();
}
