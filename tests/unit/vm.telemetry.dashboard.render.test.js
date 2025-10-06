import test from "node:test";
import assert from "node:assert/strict";

import { renderMarkdownDashboard, renderTextDashboard } from "../../vm.telemetry.dashboard.render.js";

const sampleSummary = {
  generatedAt: 1_694_000_000_000,
  namespaces: [
    {
      namespace: "memory",
      version: 2,
      eventCount: 3,
      durationMs: 1500,
      eventsPerSecond: 2,
      types: { sample: 2, other: 1 },
      metrics: {
        "metrics.latency": { count: 3, sum: 30, min: 8, max: 12, last: 10 },
        "metrics.usage": { count: 3, sum: 90, min: 20, max: 40, last: 30 }
      }
    }
  ]
};

const sampleComparison = {
  regressions: [
    {
      namespace: "memory",
      metric: "metrics.latency",
      baselineMean: 9,
      currentMean: 10,
      percentChange: (10 - 9) / 9,
      regressed: true,
      higherIsBetter: false
    },
    {
      namespace: "memory",
      metric: "metrics.usage",
      baselineMean: 32,
      currentMean: 30,
      percentChange: (30 - 32) / 32,
      regressed: true,
      higherIsBetter: true
    }
  ]
};

test("renderMarkdownDashboard emits regression table and metric summaries", () => {
  const markdown = renderMarkdownDashboard({
    summary: sampleSummary,
    comparison: sampleComparison,
    title: "Custom Dashboard"
  });

  assert.match(markdown, /^# Custom Dashboard/m);
  assert.match(markdown, /Generated: 2023/);
  assert.match(markdown, /## Regression Summary/);
  assert.match(markdown, /memory \| metrics\.latency \| ⬆️ \| 9\.00 \| 10\.00 \| 11\.1%/);
  assert.match(markdown, /memory \| metrics\.usage \| ⬇️ \| 32\.00 \| 30\.00 \| -6\.3%/);
  assert.match(markdown, /## memory/);
  assert.match(markdown, /\| metrics\.latency \| 3 \| 10\.00 \| 8\.00 \| 12\.00 \| 10\.00 \|/);
  assert.match(markdown, /Event types: sample \(2\), other \(1\)/);
});

test("renderTextDashboard provides readable output when metrics are present", () => {
  const text = renderTextDashboard({
    summary: sampleSummary,
    comparison: sampleComparison,
    title: "Telemetry"
  });

  assert.match(text, /^Telemetry/m);
  assert.match(text, /Generated: 2023/);
  assert.match(text, /memory\.metrics\.latency: baseline=9\.00 current=10\.00 change=11\.1% \(increase\)/);
  assert.match(text, /Metric metrics\.usage: samples=3 mean=30\.00 min=20\.00 max=40\.00 last=30\.00/);
});

test("renderTextDashboard handles empty telemetry", () => {
  const text = renderTextDashboard({ summary: { generatedAt: null, namespaces: [] } });
  assert.match(text, /No telemetry namespaces found\./);
});
