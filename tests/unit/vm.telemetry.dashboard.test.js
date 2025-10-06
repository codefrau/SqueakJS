import test from "node:test";
import assert from "node:assert/strict";

import { emitTelemetryEvent, resetTelemetryChannels } from "../../vm.telemetry.channel.js";
import { compareTelemetrySummaries, summarizeTelemetry } from "../../vm.telemetry.dashboard.js";

function withFrozenTime(now, fn) {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    return fn();
  } finally {
    Date.now = originalNow;
  }
}

test("summarizeTelemetry aggregates channel metrics", () => {
  resetTelemetryChannels("vm.inlineCache");

  const baseTimestamp = 1_000_000;
  withFrozenTime(baseTimestamp, () => {
    emitTelemetryEvent("vm.inlineCache", "sample", { metrics: { hits: 10, misses: 4 } });
  });
  withFrozenTime(baseTimestamp + 50, () => {
    emitTelemetryEvent("vm.inlineCache", "sample", { metrics: { hits: 16, probe: { depth: 3 } } });
  });

  const report = summarizeTelemetry();
  assert.ok(report.generatedAt);
  assert.equal(report.namespaces.length, 1);

  const summary = report.namespaces[0];
  assert.equal(summary.namespace, "vm.inlineCache");
  assert.equal(summary.eventCount, 2);
  assert.equal(summary.firstTimestamp <= baseTimestamp, true);
  assert.equal(summary.lastTimestamp >= baseTimestamp + 50, true);
  assert.equal(summary.types.sample, 2);
  assert.equal(summary.metrics["metrics.hits"].count, 2);
  assert.equal(summary.metrics["metrics.hits"].sum, 26);
  assert.equal(summary.metrics["metrics.hits"].min, 10);
  assert.equal(summary.metrics["metrics.hits"].max, 16);
  assert.equal(summary.metrics["metrics.hits"].mean, 13);
  assert.equal(summary.metrics["metrics.hits"].last, 16);
  assert.equal(summary.metrics["metrics.probe.depth"].sum, 3);
});

test("compareTelemetrySummaries identifies regressions against baseline", () => {
  const baseline = {
    namespaces: [
      {
        namespace: "vm.inlineCache",
        metrics: {
          "metrics.hits": { count: 2, sum: 20 },
          "metrics.misses": { count: 2, sum: 2 }
        }
      }
    ]
  };

  const current = {
    namespaces: [
      {
        namespace: "vm.inlineCache",
        metrics: {
          "metrics.hits": { count: 2, sum: 18 },
          "metrics.misses": { count: 2, sum: 5 }
        }
      }
    ]
  };

  const comparison = compareTelemetrySummaries(current, baseline, { threshold: 0.1 });
  assert.equal(comparison.regressions.length, 2);

  const missRegression = comparison.regressions.find((item) => item.metric === "metrics.misses");
  assert.ok(missRegression);
  assert.equal(missRegression.regressed, true);

  const hitChange = comparison.regressions.find((item) => item.metric === "metrics.hits");
  assert.ok(hitChange);
  assert.equal(hitChange.regressed, true);
});

test("compareTelemetrySummaries respects metric policy overrides", () => {
  const baseline = {
    namespaces: [
      {
        namespace: "vm.inlineCache",
        metrics: {
          "metrics.latency": { count: 2, sum: 4 }
        }
      }
    ]
  };

  const current = {
    namespaces: [
      {
        namespace: "vm.inlineCache",
        metrics: {
          "metrics.latency": { count: 2, sum: 3.4 }
        }
      }
    ]
  };

  const comparison = compareTelemetrySummaries(current, baseline, {
    threshold: 0.05,
    metricPolicies: { "metrics.latency": { higherIsBetter: true } }
  });

  assert.equal(comparison.regressions.length, 1);
  assert.equal(comparison.regressions[0].regressed, true);
  assert.equal(comparison.regressions[0].higherIsBetter, true);
});
