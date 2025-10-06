#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import { EOL } from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseExecutionProfile(source) {
  if (source == null || source === "") {
    return [];
  }
  let data;
  if (typeof source === "string") {
    try {
      data = JSON.parse(source);
    } catch (error) {
      throw new Error(`Failed to parse execution profile: ${error.message}`);
    }
  } else if (isObject(source)) {
    data = source;
  } else {
    throw new Error("Unsupported profile source type");
  }

  if (Array.isArray(data)) {
    return data;
  }
  if (isObject(data.events) && Array.isArray(data.events)) {
    return data.events;
  }
  if (Array.isArray(data.events)) {
    return data.events;
  }
  if (isObject(data.profile) && Array.isArray(data.profile.events)) {
    return data.profile.events;
  }
  return [];
}

function increment(map, key, amount = 1) {
  const current = map.get(key) || 0;
  map.set(key, current + amount);
}

export function summarizeExecutionProfile(events) {
  const summary = {
    totalEvents: 0,
    typeCounts: {},
    sendSelectors: {},
    primitiveCounts: {}
  };
  if (!Array.isArray(events)) {
    return summary;
  }
  summary.totalEvents = events.length;
  for (const event of events) {
    const type = event && typeof event.type === "string" ? event.type : "unknown";
    summary.typeCounts[type] = (summary.typeCounts[type] || 0) + 1;
    const payload = event && event.payload && typeof event.payload === "object" ? event.payload : {};
    if (type === "send") {
      const selector = payload.selector || payload.selectorId || payload.selectorHash || "<unknown>";
      summary.sendSelectors[selector] = (summary.sendSelectors[selector] || 0) + 1;
    } else if (type === "primitive") {
      const index = payload.index != null ? payload.index : "<unknown>";
      summary.primitiveCounts[index] = (summary.primitiveCounts[index] || 0) + 1;
    }
  }
  return summary;
}

export function buildFlamegraph(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return "";
  }
  const counts = new Map();
  for (const event of events) {
    if (!event || typeof event.type !== "string") continue;
    const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
    let key;
    switch (event.type) {
      case "send": {
        const selector = payload.selector || payload.selectorId || payload.selectorHash || "unknown";
        key = `execution;send:${selector}`;
        break;
      }
      case "primitive": {
        const index = payload.index != null ? payload.index : "unknown";
        key = `execution;primitive:${index}`;
        break;
      }
      case "gc": {
        const kind = payload.kind || "gc";
        key = `execution;gc:${kind}`;
        break;
      }
      case "backend": {
        const next = payload.next || payload.requested || "unknown";
        key = `execution;backend:${next}`;
        break;
      }
      default: {
        key = `execution;${event.type}`;
      }
    }
    increment(counts, key, 1);
  }
  return Array.from(counts.entries())
    .map(([stack, value]) => `${stack} ${value}`)
    .join(EOL);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function printSummary(summary) {
  const lines = [
    `Total events: ${summary.totalEvents}`,
    "By type:"
  ];
  for (const [type, count] of Object.entries(summary.typeCounts)) {
    lines.push(`  ${type}: ${count}`);
  }
  if (Object.keys(summary.sendSelectors).length > 0) {
    lines.push("Top sends:");
    const selectors = Object.entries(summary.sendSelectors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [selector, count] of selectors) {
      lines.push(`  ${selector}: ${count}`);
    }
  }
  if (Object.keys(summary.primitiveCounts).length > 0) {
    lines.push("Primitive usage:");
    const primitives = Object.entries(summary.primitiveCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [index, count] of primitives) {
      lines.push(`  ${index}: ${count}`);
    }
  }
  return lines.join(EOL);
}

async function runCLI(args) {
  let inputPath = null;
  let outputPath = null;
  let flamePath = null;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--input":
      case "-i":
        inputPath = args[++i];
        break;
      case "--output":
      case "-o":
        outputPath = args[++i];
        break;
      case "--flame":
        flamePath = args[++i];
        break;
      case "--quiet":
      case "-q":
        quiet = true;
        break;
      case "--help":
      case "-h":
        console.log("Usage: node tools/replay-execution-profile.js [--input file] [--output file] [--flame file] [--quiet]");
        return 0;
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          return 1;
        }
        inputPath = arg;
        break;
    }
  }

  let raw;
  if (inputPath) {
    raw = fs.readFileSync(path.resolve(inputPath), "utf8");
  } else if (!process.stdin.isTTY) {
    raw = await readStdin();
  } else {
    console.error("No input profile provided. Use --input <file> or pipe data to stdin.");
    return 1;
  }

  let events;
  try {
    events = parseExecutionProfile(raw);
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const summary = summarizeExecutionProfile(events);
  const summaryText = printSummary(summary);

  if (!quiet) {
    console.log(summaryText);
  }

  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), `${summaryText}${EOL}`, "utf8");
  }

  if (flamePath) {
    const flame = buildFlamegraph(events);
    fs.writeFileSync(path.resolve(flamePath), `${flame}${EOL}`, "utf8");
  }

  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCLI(process.argv.slice(2)).then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
