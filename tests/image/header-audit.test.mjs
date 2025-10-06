import assert from "assert";

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

function makeImage(name) {
    return new Squeak.Image(name, {
        headroomMB: 32,
        gcThresholdMB: 8,
        youngSpaceRatio: 0.25,
    });
}

function makeBufferWithVersion(version, littleEndian = true) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, version >>> 0, littleEndian);
    return buffer;
}

{
    const image = makeImage("nonspur-64");
    const buffer = makeBufferWithVersion(68000, true);
    let thrown = null;
    try {
        image.readFromBuffer(buffer, () => {});
    } catch (error) {
        thrown = error;
    }
    assert(thrown, "readFromBuffer should throw for unsupported 64-bit non-Spur images");
    assert.match(thrown.message, /non-spur/i);
    const audit = image.headerAudit;
    assert(audit, "image should retain a header audit instance");
    assert.strictEqual(audit.issues.length, 1, "audit should record one issue");
    const issue = audit.issues[0];
    assert.strictEqual(issue.code, "unsupported-nonspur-64");
    assert.strictEqual(issue.details.reason, "no-native-loader");
    assert(issue.details.version, "issue should report version details");
    assert.strictEqual(issue.details.version.isSpur, false);
    assert.strictEqual(issue.details.version.is64Bit, true);
    assert.ok(/Spur 64-bit image/.test(issue.guidance), "guidance should recommend Spur conversion");
    assert.strictEqual(audit.resolutions.length, 0, "no compatibility resolution should be recorded");
}

{
    const image = makeImage("garbage-header");
    const buffer = makeBufferWithVersion(0x12345678, true);
    let thrown = null;
    try {
        image.readFromBuffer(buffer, () => {});
    } catch (error) {
        thrown = error;
    }
    assert(thrown, "readFromBuffer should throw for unrecognized images");
    assert.match(thrown.message, /bad image version/i);
    const audit = image.headerAudit;
    assert(audit, "image should retain a header audit instance");
    assert.strictEqual(audit.issues.length, 1, "audit should capture the unrecognized version");
    const issue = audit.issues[0];
    assert.strictEqual(issue.code, "unrecognized-version");
    assert(issue.details.probes.length > 0, "issue should expose header probes");
    assert.ok(issue.guidance.length > 0, "guidance message should not be empty");
}

console.log("Header audit diagnostics verified", {
    nonSpurGuidance: true,
    unknownHeaderGuidance: true,
});
