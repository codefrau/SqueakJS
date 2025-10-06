#!/usr/bin/env node
import { readFile, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const IMAGE_HEADER_VERSION_MASK = 0x119EE;
const SPUR_BIT = 0x10;
const FLAG_CONVERTED = 0x1;
const METADATA_MAGIC = "IMCK";
const SUPPORTED_SCHEMA_VERSION = 1;

function usage() {
    const script = fileURLToPath(import.meta.url);
    return `Usage: ${script} convert <input> [output] [--force] [--summary=json|table]\n` +
        "\n" +
        "Converts a 64-bit non-Spur Squeak image produced by the compatibility\n" +
        "fixtures into a Spur-format header while preserving mock metadata.\n" +
        "\n" +
        "Options:\n" +
        "  --force            Overwrite the output file if it exists.\n" +
        "  --summary=mode     Print conversion summary as 'json' (default) or 'table'.\n" +
        "  --help             Show this message.\n";
}

function parseArgs(argv) {
    const positional = [];
    let force = false;
    let summary = "json";
    let help = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--force") {
            force = true;
        } else if (arg === "--help" || arg === "-h") {
            help = true;
        } else if (arg.startsWith("--summary=")) {
            summary = arg.split("=", 2)[1] || summary;
        } else if (arg === "--summary") {
            if (i + 1 >= argv.length) throw new Error("--summary requires a value");
            summary = argv[++i];
        } else {
            positional.push(arg);
        }
    }
    if (summary !== "json" && summary !== "table") {
        throw new Error("Unsupported summary mode: " + summary);
    }
    const command = positional.shift();
    if (!command && !help) {
        throw new Error("Missing command. Run with --help for usage.");
    }
    let inputPath = positional.shift();
    let outputPath = positional.shift();
    if (command === "convert" && !inputPath) {
        throw new Error("convert requires an input image path");
    }
    return {
        command,
        inputPath: inputPath ? resolve(inputPath) : null,
        outputPath: outputPath ? resolve(outputPath) : null,
        force,
        summary,
        help,
    };
}

function readUInt32LE(buffer, offset) {
    if (offset + 4 > buffer.length) {
        throw new Error("Unexpected end of file while reading 32-bit value");
    }
    return buffer.readUInt32LE(offset);
}

function readUInt8(buffer, offset) {
    if (offset >= buffer.length) {
        throw new Error("Unexpected end of file while reading 8-bit value");
    }
    return buffer.readUInt8(offset);
}

function parseMetadata(buffer, metaOffset) {
    if (buffer.length < metaOffset + 32) {
        throw new Error("Metadata section truncated");
    }
    const magic = buffer.toString("ascii", metaOffset, metaOffset + 4);
    if (magic !== METADATA_MAGIC) {
        throw new Error("Unsupported metadata magic: " + magic);
    }
    const schemaVersion = readUInt32LE(buffer, metaOffset + 4);
    if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
        throw new Error("Unsupported metadata schema version: " + schemaVersion);
    }
    const objectCount = readUInt32LE(buffer, metaOffset + 8);
    const selectorCount = readUInt32LE(buffer, metaOffset + 12);
    const objectTableOffset = readUInt32LE(buffer, metaOffset + 16);
    const selectorTableOffset = readUInt32LE(buffer, metaOffset + 20);
    const flags = readUInt32LE(buffer, metaOffset + 24);
    return {
        magic,
        schemaVersion,
        objectCount,
        selectorCount,
        objectTableOffset,
        selectorTableOffset,
        flags,
    };
}

function extractObjectIds(buffer, metaOffset, meta) {
    const ids = [];
    let offset = metaOffset + meta.objectTableOffset;
    for (let i = 0; i < meta.objectCount; i++) {
        ids.push(readUInt32LE(buffer, offset));
        offset += 4;
    }
    return ids;
}

function extractSelectorNames(buffer, metaOffset, meta) {
    const names = [];
    let offset = metaOffset + meta.selectorTableOffset;
    for (let i = 0; i < meta.selectorCount; i++) {
        const length = readUInt8(buffer, offset);
        offset += 1;
        if (offset + length > buffer.length) {
            throw new Error("Selector entry truncated");
        }
        const selector = buffer.toString("ascii", offset, offset + length);
        names.push(selector);
        offset += length;
    }
    return names;
}

async function ensureWritablePath(filePath, force) {
    try {
        const stats = await stat(filePath);
        if (stats && !force) {
            throw new Error(`Output file ${filePath} already exists. Use --force to overwrite.`);
        }
    } catch (error) {
        if (error && error.code === "ENOENT") {
            const dir = dirname(filePath);
            if (!dir) return;
            return;
        }
        throw error;
    }
}

function analyzeVersion(word) {
    const baseVersion = word & IMAGE_HEADER_VERSION_MASK;
    const isSpur = (word & SPUR_BIT) !== 0;
    const is64Bit = word >= 68000;
    return { word, baseVersion, isSpur, is64Bit };
}

function defaultOutputPath(inputPath) {
    if (!inputPath) return null;
    if (/\.image$/i.test(inputPath)) {
        return inputPath.replace(/\.image$/i, ".spur64.image");
    }
    return inputPath + ".spur64.image";
}

async function convertImage({ inputPath, outputPath, force }) {
    const buffer = await readFile(inputPath);
    if (buffer.length < 8) {
        throw new Error("Image is too small to contain a header");
    }
    const version = readUInt32LE(buffer, 0);
    const versionInfo = analyzeVersion(version);
    if (!versionInfo.is64Bit) {
        throw new Error("Conversion only supports 64-bit images");
    }
    if (versionInfo.isSpur) {
        throw new Error("Image is already Spur format");
    }
    const metadataOffset = readUInt32LE(buffer, 4);
    if (metadataOffset >= buffer.length) {
        throw new Error("Metadata offset points outside the image");
    }
    const meta = parseMetadata(buffer, metadataOffset);
    const objects = extractObjectIds(buffer, metadataOffset, meta);
    const selectors = extractSelectorNames(buffer, metadataOffset, meta);

    const converted = Buffer.from(buffer);
    const updatedVersion = version | SPUR_BIT;
    converted.writeUInt32LE(updatedVersion >>> 0, 0);
    converted.writeUInt32LE((meta.flags | FLAG_CONVERTED) >>> 0, metadataOffset + 24);

    const destination = outputPath || defaultOutputPath(inputPath);
    await ensureWritablePath(destination, force);
    await writeFile(destination, converted);

    const summary = {
        input: {
            path: inputPath,
            version: versionInfo.word,
            baseVersion: versionInfo.baseVersion,
            isSpur: versionInfo.isSpur,
            is64Bit: versionInfo.is64Bit,
            metadataOffset,
            objects: {
                total: meta.objectCount,
                ids: objects,
            },
            selectors: {
                total: meta.selectorCount,
                names: selectors,
            },
            flags: meta.flags,
        },
        output: {
            path: destination,
            version: updatedVersion >>> 0,
            baseVersion: (updatedVersion & IMAGE_HEADER_VERSION_MASK) >>> 0,
            isSpur: true,
            is64Bit: versionInfo.is64Bit,
            metadataOffset,
            objects: {
                total: meta.objectCount,
                ids: objects,
            },
            selectors: {
                total: meta.selectorCount,
                names: selectors,
            },
            flags: (meta.flags | FLAG_CONVERTED) >>> 0,
        },
    };
    return summary;
}

function printSummary(summary, mode) {
    if (mode === "json") {
        console.log(JSON.stringify(summary, null, 2));
        return;
    }
    const lines = [];
    lines.push("Conversion summary");
    lines.push("==================");
    lines.push(`Input:  ${summary.input.path}`);
    lines.push(`Output: ${summary.output.path}`);
    lines.push("");
    lines.push("Image:");
    lines.push(`  Version: ${summary.input.version} -> ${summary.output.version}`);
    lines.push(`  Spur:    ${summary.input.isSpur ? "yes" : "no"} -> yes`);
    lines.push(`  Objects: ${summary.input.objects.total}`);
    lines.push(`  Selectors: ${summary.input.selectors.total}`);
    console.log(lines.join("\n"));
}

async function main(argv) {
    let parsed;
    try {
        parsed = parseArgs(argv);
    } catch (error) {
        console.error(error.message);
        console.error(usage());
        process.exitCode = 1;
        return;
    }
    if (parsed.help || parsed.command === "help" || !parsed.command) {
        console.log(usage());
        return;
    }
    if (parsed.command !== "convert") {
        console.error("Unsupported command: " + parsed.command);
        console.error(usage());
        process.exitCode = 1;
        return;
    }
    const destination = parsed.outputPath || defaultOutputPath(parsed.inputPath);
    try {
        const summary = await convertImage({
            inputPath: parsed.inputPath,
            outputPath: destination,
            force: parsed.force,
        });
        printSummary(summary, parsed.summary);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main(process.argv.slice(2));
}

export { convertImage, parseMetadata, extractObjectIds, extractSelectorNames };
