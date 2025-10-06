import assert from "assert";
import { getNonSpur64MockBytes } from "../fixtures/nonspur64-mock.js";

const globalThis = global;
globalThis.self = globalThis;
globalThis.window = globalThis;
if (!globalThis.performance) globalThis.performance = {};
if (!globalThis.performance.now) globalThis.performance.now = () => 0;
if (!globalThis.navigator) globalThis.navigator = {};

await import("../../globals.js");
await import("../../vm.js");
await import("../../vm.object.js");
await import("../../vm.object.spur.js");
await import("../../vm.image.js");

function makeImage(name) {
    return new Squeak.Image(name, {
        headroomMB: 32,
        gcThresholdMB: 8,
        youngSpaceRatio: 0.25,
    });
}

function toArrayBuffer(bytes) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function chunkedIterable(sourceBytes, size) {
    async function* generator() {
        for (let offset = 0; offset < sourceBytes.length; offset += size) {
            const end = Math.min(offset + size, sourceBytes.length);
            const slice = sourceBytes.subarray(offset, end);
            await Promise.resolve();
            yield new Uint8Array(slice);
        }
    }
    return generator();
}

const fixtureBytes = getNonSpur64MockBytes();

{
    const image = makeImage("compat-buffer");
    let progress = 0;
    await new Promise((resolve, reject) => {
        try {
            image.readFromBuffer(toArrayBuffer(fixtureBytes), () => resolve(), value => { progress = value; });
        } catch (error) {
            reject(error);
        }
    });
    assert.strictEqual(progress, 1, "buffer loader should report 100% progress");
    const snapshot = image.compatibilitySnapshot;
    assert(snapshot, "compatibility snapshot should be stored on the image");
    assert.strictEqual(image.compatibilityMode, "native-nonspur64");
    assert.strictEqual(image.oldSpaceCount, 3, "metadata object count should hydrate the image");
    assert.strictEqual(snapshot.metadata.objects.total, 3);
    assert.deepStrictEqual(snapshot.metadata.objects.ids, [0x1000, 0x2000, 0x4000]);
    assert.strictEqual(snapshot.metadata.selectors.total, 2);
    assert.deepStrictEqual(snapshot.metadata.selectors.names, ["foo", "bar:"]);
    assert.strictEqual(snapshot.metadata.converted, false, "fixture should mark converted flag as false");
    assert.strictEqual(snapshot.bytes.byteLength, fixtureBytes.byteLength, "snapshot should retain original byte length");
    assert.strictEqual(image.headerAudit.issues.length, 0, "compatibility path should avoid issue logging");
    assert.strictEqual(image.headerAudit.resolutions.length, 1, "compatibility resolution should be recorded");
    const resolution = image.headerAudit.resolutions[0];
    assert.strictEqual(resolution.code, "native-compat-loader");
    assert.strictEqual(resolution.details.metadata.objects.total, 3);
    assert.strictEqual(resolution.details.metadata.selectors.total, 2);
}

{
    const iterator = chunkedIterable(fixtureBytes, 32);
    const image = makeImage("compat-stream");
    const progressSamples = [];
    let finalized = false;
    await image.readFromStream({
        iterator,
        totalBytes: fixtureBytes.length,
    }, () => { finalized = true; }, value => { progressSamples.push(value); });
    assert(finalized, "stream loader should invoke completion callback");
    assert(progressSamples.some(sample => sample === 1), "stream loader should report final progress");
    const snapshot = image.compatibilitySnapshot;
    assert(snapshot, "stream loader should also install a compatibility snapshot");
    assert.strictEqual(image.compatibilityMode, "native-nonspur64");
    assert.strictEqual(snapshot.metadata.objects.total, 3);
    assert.deepStrictEqual(snapshot.metadata.selectors.names, ["foo", "bar:"]);
    assert.strictEqual(image.headerAudit.issues.length, 0);
    assert.strictEqual(image.headerAudit.resolutions.length, 1);
    assert.strictEqual(image.headerAudit.resolutions[0].code, "native-compat-loader");
}

console.log("Native compatibility loader verified", {
    objects: 3,
    selectors: 2,
    modes: ["buffer", "stream"],
});
