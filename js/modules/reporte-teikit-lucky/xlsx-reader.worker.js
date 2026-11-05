import { readXlsxIncrementally } from "./xlsx-stream-reader.js";
import { createReaderDiagnostics } from "./xlsx-reader-diagnostics.js";
import { createReportAccumulator } from "./incremental-accumulator.js";

const memorySnapshot = () => {
  const memory = globalThis.performance?.memory;
  return memory ? { usedJSHeapSize: memory.usedJSHeapSize, totalJSHeapSize: memory.totalJSHeapSize, jsHeapSizeLimit: memory.jsHeapSizeLimit } : null;
};

self.addEventListener("message", async (event) => {
  if (!["read-xlsx", "analyze-xlsx"].includes(event.data?.type)) return;
  const { file, sampleRowNumbers = [] } = event.data;
  const analyze = event.data.type === "analyze-xlsx";
  const diagnostics = createReaderDiagnostics(sampleRowNumbers);
  const accumulator = analyze ? createReportAccumulator() : null;
  const memory = { start: memorySnapshot(), peak: null, end: null };
  let lastProgressAt = 0;
  try {
    const result = await readXlsxIncrementally(file, {
      onRow: (row) => { diagnostics.consume(row); accumulator?.consume(row); },
      onHeaders: (headers) => self.postMessage({ type: "headers", ...headers }),
      onProgress: (progress) => {
        const now = performance.now(), snapshot = memorySnapshot();
        if (snapshot && (!memory.peak || snapshot.usedJSHeapSize > memory.peak.usedJSHeapSize)) memory.peak = snapshot;
        if (now - lastProgressAt >= 200 || progress.percent === 100) {
          lastProgressAt = now;
          self.postMessage({ type: "progress", ...progress, memory: snapshot });
        }
      },
    });
    memory.end = memorySnapshot();
    self.postMessage({ type: "complete", result: { ...result, diagnostics: diagnostics.finish(), analysis: accumulator?.finish() || null, memory } });
  } catch (error) {
    memory.end = memorySnapshot();
    self.postMessage({ type: "error", error: { name: error.name, code: error.code || "UNKNOWN", message: error.message, cause: error.cause?.message || null }, memory });
  }
});
