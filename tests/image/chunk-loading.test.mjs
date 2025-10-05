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

function chunkedIterable(sourceBytes, size) {
    async function* generator() {
        for (let offset = 0; offset < sourceBytes.length; offset += size) {
            const end = Math.min(offset + size, sourceBytes.length);
            const slice = sourceBytes.subarray(offset, end);
            // simulate network pacing
            await Promise.resolve();
            yield new Uint8Array(slice);
        }
    }
    return generator();
}

async function loadWithStream(chunkSize) {
    const iterable = chunkedIterable(bytes, chunkSize);
    const descriptor = {
        iterator: iterable,
        totalBytes: bytes.length,
    };
    const image = new Squeak.Image(`stream-${chunkSize}`, {
        headroomMB: 64,
        gcThresholdMB: 8,
        youngSpaceRatio: 0.25,
    });
    await new Promise((resolve, reject) => {
        image.readFromStream(descriptor, resolve, null);
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

const [bufferImage, streamedImage] = await Promise.all([
    loadWithBuffer(),
    loadWithStream(4096),
]);

assert.strictEqual(streamedImage.oldSpaceCount, bufferImage.oldSpaceCount, "stream loader should match object count");
assert.strictEqual(streamedImage.oldSpaceBytes, bufferImage.oldSpaceBytes, "stream loader should match object bytes");
assert.ok(streamedImage.specialObjectsArray, "stream loader should populate special objects");
assert.ok(streamedImage.specialObjectsArray.pointers.length > 0, "special objects array should be populated");
assert.strictEqual(streamedImage.specialObjectsArray.pointers[Squeak.splOb_NilObject].isNil, true, "nil object should be flagged");

console.log("Stream loader verified", {
    objects: streamedImage.oldSpaceCount,
    bytes: streamedImage.oldSpaceBytes,
});
