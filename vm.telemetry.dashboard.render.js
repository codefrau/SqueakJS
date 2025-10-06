"use strict";

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return "n/a";
  try {
    return new Date(timestamp).toISOString();
  } catch (error) {
    return "n/a";
  }
}

function formatNumber(value, options = {}) {
  if (!Number.isFinite(value)) return "—";
  const { digits = 2, minimumFractionDigits } = options;
  const fractionDigits = Number.isInteger(minimumFractionDigits)
    ? Math.max(minimumFractionDigits, digits)
    : digits;
  return value.toFixed(fractionDigits);
}

function formatCount(value) {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toString();
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) {
    return `${formatNumber(ms, { digits: 0 })} ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${formatNumber(seconds, { digits: 2 })} s`;
  }
  const minutes = seconds / 60;
  return `${formatNumber(minutes, { digits: 2 })} min`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${formatNumber(value * 100, { digits: 1, minimumFractionDigits: 1 })}%`;
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return { generatedAt: null, namespaces: [] };
  }
  const namespaces = Array.isArray(summary.namespaces) ? summary.namespaces : [];
  return {
    generatedAt: Number.isFinite(summary.generatedAt) ? summary.generatedAt : null,
    namespaces
  };
}

function normalizeComparison(comparison) {
  if (!comparison || typeof comparison !== "object") {
    return { regressions: [] };
  }
  const regressions = Array.isArray(comparison.regressions) ? comparison.regressions : [];
  return { regressions };
}

function formatEventTypes(types) {
  if (!types || typeof types !== "object") return "None";
  const entries = Object.entries(types)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type} (${formatCount(count)})`);
  return entries.length ? entries.join(", ") : "None";
}

function getMetricEntries(summary) {
  if (!summary || !summary.metrics || typeof summary.metrics !== "object") return [];
  return Object.entries(summary.metrics)
    .map(([name, stats]) => ({ name, stats }))
    .filter((entry) => entry.stats && Number.isFinite(entry.stats.count) && entry.stats.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderNamespaceMarkdown(summary) {
  const lines = [];
  lines.push(`## ${summary.namespace}`);
  lines.push("");
  lines.push(`- Version: ${summary.version !== null && summary.version !== undefined ? summary.version : "n/a"}`);
  lines.push(`- Events: ${formatCount(summary.eventCount)}`);
  lines.push(`- Duration: ${formatDuration(summary.durationMs)}`);
  lines.push(`- Events/sec: ${summary.eventsPerSecond && Number.isFinite(summary.eventsPerSecond) ? formatNumber(summary.eventsPerSecond, { digits: 2 }) : "—"}`);
  lines.push(`- Event types: ${formatEventTypes(summary.types)}`);

  const metrics = getMetricEntries(summary);
  if (!metrics.length) {
    lines.push("");
    lines.push("_No numeric metrics captured._");
    lines.push("");
    return lines;
  }

  lines.push("");
  lines.push("| Metric | Samples | Mean | Min | Max | Last |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const entry of metrics) {
    const { name, stats } = entry;
    const mean = stats.count ? stats.sum / stats.count : Number.NaN;
    lines.push(
      `| ${name} | ${formatCount(stats.count)} | ${formatNumber(mean)} | ${formatNumber(stats.min)} | ${formatNumber(stats.max)} | ${formatNumber(stats.last)} |`
    );
  }
  lines.push("");
  return lines;
}

function renderRegressionMarkdown(regressions) {
  if (!regressions.length) return [];
  const lines = [];
  lines.push("## Regression Summary");
  lines.push("");
  lines.push("| Namespace | Metric | Direction | Baseline | Current | Change |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const regression of regressions) {
    const direction = regression.regressed
      ? regression.higherIsBetter ? "⬇️" : "⬆️"
      : "⏺";
    const baseline = formatNumber(regression.baselineMean);
    const current = formatNumber(regression.currentMean);
    const change = formatPercent(regression.percentChange);
    lines.push(
      `| ${regression.namespace} | ${regression.metric} | ${direction} | ${baseline} | ${current} | ${change} |`
    );
  }
  lines.push("");
  return lines;
}

export function renderMarkdownDashboard({ summary, comparison, title } = {}) {
  const normalizedSummary = normalizeSummary(summary);
  const normalizedComparison = normalizeComparison(comparison);
  const lines = [];
  lines.push(`# ${title || "Telemetry Dashboard"}`);
  lines.push("");
  lines.push(`Generated: ${formatDate(normalizedSummary.generatedAt)}`);
  lines.push("");
  lines.push(...renderRegressionMarkdown(normalizedComparison.regressions));
  for (const namespaceSummary of normalizedSummary.namespaces) {
    if (!namespaceSummary || !namespaceSummary.namespace) continue;
    lines.push(...renderNamespaceMarkdown(namespaceSummary));
  }
  if (lines[lines.length - 1] !== "") {
    lines.push("");
  }
  return lines.join("\n");
}

function renderNamespaceText(summary) {
  const lines = [];
  lines.push(`## ${summary.namespace}`);
  lines.push(`Version: ${summary.version !== null && summary.version !== undefined ? summary.version : "n/a"}`);
  lines.push(`Events: ${formatCount(summary.eventCount)}`);
  lines.push(`Duration: ${formatDuration(summary.durationMs)}`);
  lines.push(`Events/sec: ${summary.eventsPerSecond && Number.isFinite(summary.eventsPerSecond) ? formatNumber(summary.eventsPerSecond, { digits: 2 }) : "—"}`);
  lines.push(`Event types: ${formatEventTypes(summary.types)}`);

  const metrics = getMetricEntries(summary);
  if (!metrics.length) {
    lines.push("No numeric metrics captured.");
    return lines;
  }

  for (const entry of metrics) {
    const { name, stats } = entry;
    const mean = stats.count ? stats.sum / stats.count : Number.NaN;
    lines.push(
      `Metric ${name}: samples=${formatCount(stats.count)} mean=${formatNumber(mean)} min=${formatNumber(stats.min)} max=${formatNumber(stats.max)} last=${formatNumber(stats.last)}`
    );
  }
  return lines;
}

function renderRegressionText(regressions) {
  if (!regressions.length) return [];
  const lines = [];
  lines.push("## Regression Summary");
  for (const regression of regressions) {
    const direction = regression.regressed
      ? regression.higherIsBetter ? "decrease" : "increase"
      : "change";
    lines.push(
      `${regression.namespace}.${regression.metric}: baseline=${formatNumber(regression.baselineMean)} current=${formatNumber(regression.currentMean)} change=${formatPercent(regression.percentChange)} (${direction})`
    );
  }
  return lines;
}

export function renderTextDashboard({ summary, comparison, title } = {}) {
  const normalizedSummary = normalizeSummary(summary);
  const normalizedComparison = normalizeComparison(comparison);
  const lines = [];
  lines.push(title || "Telemetry Dashboard");
  lines.push(`Generated: ${formatDate(normalizedSummary.generatedAt)}`);
  lines.push("");
  lines.push(...renderRegressionText(normalizedComparison.regressions));
  if (normalizedComparison.regressions.length) {
    lines.push("");
  }
  for (const namespaceSummary of normalizedSummary.namespaces) {
    if (!namespaceSummary || !namespaceSummary.namespace) continue;
    lines.push(...renderNamespaceText(namespaceSummary));
    lines.push("");
  }
  if (!normalizedSummary.namespaces.length) {
    lines.push("No telemetry namespaces found.");
  }
  return lines.join("\n");
}

export {
  formatNumber as _formatNumber,
  formatDuration as _formatDuration,
  formatPercent as _formatPercent
};
