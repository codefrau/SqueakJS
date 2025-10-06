import assert from "assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getNonSpur64MockBuffer } from "../fixtures/nonspur64-mock.js";

const run = promisify(execFile);
const cliPath = fileURLToPath(new URL("../../tools/convert-image.mjs", import.meta.url));

const tmp = await mkdtemp(join(tmpdir(), "squeak-convert-"));
const outputPath = join(tmp, "converted.image");
const inputPath = join(tmp, "nonspur64.image");
await writeFile(inputPath, getNonSpur64MockBuffer());

try {
    const { stdout } = await run(process.execPath, [cliPath, "convert", inputPath, outputPath, "--summary=json"]);
    const summary = JSON.parse(stdout.trim());
    assert.strictEqual(summary.input.objects.total, 3, "should report the fixture object count");
    assert.deepStrictEqual(summary.input.objects.ids, [4096, 8192, 16384], "should expose object ids");
    assert.deepStrictEqual(summary.input.selectors.names, ["foo", "bar:"], "should list selector names");
    assert.strictEqual(summary.output.isSpur, true, "conversion must mark output as Spur");
    assert.strictEqual(summary.output.objects.total, 3, "object count should be preserved");
    assert.strictEqual(summary.output.selectors.total, 2, "selector count should be preserved");

    const converted = await readFile(outputPath);
    const version = converted.readUInt32LE(0);
    assert.ok((version & 0x10) !== 0, "Spur bit should be set");
    const metadataOffset = converted.readUInt32LE(4);
    const flags = converted.readUInt32LE(metadataOffset + 24);
    assert.ok(flags & 0x1, "converted flag should be persisted");
    const selectorCount = converted.readUInt32LE(metadataOffset + 12);
    assert.strictEqual(selectorCount, 2, "selector count should remain in metadata");

    let failed = false;
    try {
        await run(process.execPath, [cliPath, "convert", outputPath]);
    } catch (error) {
        failed = true;
        assert.match(error.stderr.toString(), /already Spur/i, "reconversion should report Spur detection");
    }
    assert.ok(failed, "second conversion should fail without --force");
} finally {
    await rm(tmp, { recursive: true, force: true });
}

console.log("Conversion toolchain CLI verified", {
    objects: 3,
    selectors: 2,
});
