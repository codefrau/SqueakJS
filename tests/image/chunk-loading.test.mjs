import assert from "assert";
import fs from "fs/promises";
import path from "path";

global.self = global;
global.window = global;
if (!global.performance) global.performance = {};
if (!global.performance.now) global.performance.now = () => 0;
if (!global.navigator) global.navigator = {};

await import("../../globals.js");
await import("../../vm.js");
await import("../../vm.object.js");
await import("../../vm.object.spur.js");
await import("../../vm.image.js");

const imagePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../demo/mini.image");
const buffer = await fs.readFile(imagePath);
const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

function createGate() {
    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });
    return {
        promise,
        resolve,
    };
}

function chunkedIterable(sourceBytes, size, options = {}) {
    async function* generator() {
        const totalChunks = Math.ceil(sourceBytes.length / size);
        for (let offset = 0, index = 0; offset < sourceBytes.length; offset += size, index++) {
            const end = Math.min(offset + size, sourceBytes.length);
            if (end === sourceBytes.length && options.gate) {
                if (typeof options.onBeforeFinalChunk === "function") options.onBeforeFinalChunk();
                await options.gate.promise;
            }
            const slice = sourceBytes.subarray(offset, end);
            await Promise.resolve();
            yield new Uint8Array(slice);
            if (typeof options.onAfterChunk === "function") options.onAfterChunk(index, totalChunks);
        }
    }
    return generator();
}

function createRecoverableStreamDescriptor(sourceBytes, chunkSize, failAtChunk) {
    let resumeCalls = 0;
    let failureInjected = false;

    const makeIterator = (offset = 0) => (async function* () {
        let start = offset;
        let chunkIndex = Math.floor(offset / chunkSize);
        while (start < sourceBytes.length) {
            const end = Math.min(start + chunkSize, sourceBytes.length);
            if (!failureInjected && chunkIndex === failAtChunk) {
                failureInjected = true;
                throw new Error("simulated stream interruption");
            }
            yield new Uint8Array(sourceBytes.subarray(start, end));
            start += chunkSize;
            chunkIndex++;
            await Promise.resolve();
        }
    })();

    return {
        totalBytes: sourceBytes.length,
        maxResumes: 2,
        createIterator(offset = 0) {
            return makeIterator(offset);
        },
        resumeFrom(info) {
            resumeCalls++;
            const offset = info && typeof info.offset === "number"
                ? info.offset
                : (info && typeof info.consumed === "number" ? info.consumed : 0);
            return { iterator: makeIterator(offset) };
        },
        getResumeCalls() {
            return resumeCalls;
        },
    };
}

function createFailingStreamDescriptor(sourceBytes, chunkSize) {
    return {
        totalBytes: sourceBytes.length,
        createIterator() {
            return (async function* () {
                let threw = false;
                for (let offset = 0; offset < sourceBytes.length; offset += chunkSize) {
                    const end = Math.min(offset + chunkSize, sourceBytes.length);
                    if (threw) {
                        throw new Error("forced stream termination");
                    }
                    yield new Uint8Array(sourceBytes.subarray(offset, end));
                    threw = true;
                    await Promise.resolve();
                }
                throw new Error("forced stream termination");
            })();
        },
    };
}

async function loadWithStream(chunkSize, progressCollector, overrides = {}) {
    const iterable = chunkedIterable(bytes, chunkSize, overrides.iteratorOptions || {});
    const descriptor = {
        iterator: iterable,
        totalBytes: bytes.length,
    };
    if (typeof overrides.onProgress === "function") {
        descriptor.onProgress = overrides.onProgress;
    }
    if (overrides.descriptorExtras) {
        Object.assign(descriptor, overrides.descriptorExtras);
    }
    const image = new Squeak.Image(`stream-${chunkSize}`, {
        headroomMB: 64,
        gcThresholdMB: 8,
        youngSpaceRatio: 0.25,
    });
    await new Promise((resolve, reject) => {
        const maybePromise = image.readFromStream(descriptor, resolve, progressCollector);
        if (maybePromise && typeof maybePromise.catch === "function") {
            maybePromise.catch(reject);
        }
    });
    return image;
}

async function loadWithBuffer() {
    const image = new Squeak.Image("buffer", {
        headroomMB: 64,
        gcThresholdMB: 8,
        youngSpaceRatio: 0.25,
    });
    await new Promise((resolve, reject) => {
        image.readFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), resolve, null);
    });
    return image;
}

const downloadFractions = [];
let downloadComplete = false;
let finalizeTriggerFraction = null;
const finalChunkGate = createGate();
const progressValues = [];
let finalizeStarted = false;
let finalizeResolve;
const finalizeReached = new Promise((resolve) => {
    finalizeResolve = resolve;
});
const progressCollector = (value) => {
    progressValues.push(value);
    if (!finalizeStarted && value >= 0.72) {
        finalizeStarted = true;
        finalizeTriggerFraction = downloadFractions.length
            ? downloadFractions[downloadFractions.length - 1]
            : 0;
        finalizeResolve();
    }
};
const streamPromise = loadWithStream(4096, progressCollector, {
    iteratorOptions: {
        gate: finalChunkGate,
    },
    onProgress: (fetched, total) => {
        if (typeof total === "number" && total > 0) {
            const fraction = fetched / total;
            downloadFractions.push(fraction);
            if (fraction >= 0.999999) downloadComplete = true;
        }
    },
});
const bufferPromise = loadWithBuffer();

await finalizeReached;
assert.strictEqual(downloadComplete, false, "download should not be complete when finalize progress begins");
assert(finalizeTriggerFraction !== null && finalizeTriggerFraction < 0.999999, "finalize should advance before full download");
finalChunkGate.resolve();

const [bufferImage, streamedImage] = await Promise.all([
    bufferPromise,
    streamPromise,
]);

assert.strictEqual(streamedImage.oldSpaceCount, bufferImage.oldSpaceCount, "stream loader should match object count");
assert.strictEqual(streamedImage.oldSpaceBytes, bufferImage.oldSpaceBytes, "stream loader should match object bytes");
assert.ok(streamedImage.specialObjectsArray, "stream loader should populate special objects");
assert.ok(streamedImage.specialObjectsArray.pointers.length > 0, "special objects array should be populated");
assert.strictEqual(streamedImage.specialObjectsArray.pointers[Squeak.splOb_NilObject].isNil, true, "nil object should be flagged");

assert(progressValues.length > 0, "stream loader should emit progress values");
assert(Math.abs(progressValues[progressValues.length - 1] - 1) < 1e-9, "progress should end at 1");
let sawDownloadPhase = false;
let sawFinalizePhase = false;
for (let i = 1; i < progressValues.length; i++) {
    assert(progressValues[i] + 1e-9 >= progressValues[i - 1], "progress should be monotonic");
    if (progressValues[i] > 0 && progressValues[i] < 0.7) sawDownloadPhase = true;
    if (progressValues[i] >= 0.7 && progressValues[i] < 1) sawFinalizePhase = true;
}
assert(sawDownloadPhase, "stream loader should report download-phase progress");
assert(sawFinalizePhase, "stream loader should report finalize-phase progress");

console.log("Stream loader verified", {
    objects: streamedImage.oldSpaceCount,
    bytes: streamedImage.oldSpaceBytes,
});

const recoverableDescriptor = createRecoverableStreamDescriptor(bytes, 8192, 3);
const recoverableImage = new Squeak.Image("recoverable-stream", {
    headroomMB: 64,
    gcThresholdMB: 8,
    youngSpaceRatio: 0.25,
});
const recoverableProgress = [];
await new Promise((resolve, reject) => {
    const maybe = recoverableImage.readFromStream(recoverableDescriptor, resolve, (value) => {
        recoverableProgress.push(value);
    });
    if (maybe && typeof maybe.catch === "function") maybe.catch(reject);
});

assert.strictEqual(recoverableDescriptor.getResumeCalls(), 1, "recoverable stream should attempt a single resume");
assert.strictEqual(recoverableImage.oldSpaceCount, bufferImage.oldSpaceCount, "recoverable stream should match object count");
assert.strictEqual(recoverableImage.oldSpaceBytes, bufferImage.oldSpaceBytes, "recoverable stream should match object bytes");
assert(recoverableProgress.length > 0, "recoverable stream should emit progress updates");
assert(Math.abs(recoverableProgress[recoverableProgress.length - 1] - 1) < 1e-9, "recoverable progress should end at 1");

const failingDescriptor = createFailingStreamDescriptor(bytes, 16384);
const failingImage = new Squeak.Image("failing-stream", {
    headroomMB: 64,
    gcThresholdMB: 8,
    youngSpaceRatio: 0.25,
});

let failureError = null;
try {
    await failingImage.readFromStream(failingDescriptor, () => {}, null);
    assert.fail("expected failing stream to reject");
} catch (error) {
    failureError = error;
}

assert(failureError instanceof Error, "failing stream should reject with an Error");
assert(/forced stream termination/.test(failureError.message), "failing stream should report forced termination");

assert.strictEqual(failingImage.firstOldObject, null, "failed stream should roll back firstOldObject");
assert.strictEqual(failingImage.specialObjectsArray, null, "failed stream should not retain special objects");
assert.strictEqual(failingImage.oldSpaceCount, 0, "failed stream should reset object count");
assert.strictEqual(failingImage.oldSpaceBytes, 0, "failed stream should reset byte count");
assert.strictEqual(failingImage._activeInstallController, null, "install controller should be cleared after failure");
