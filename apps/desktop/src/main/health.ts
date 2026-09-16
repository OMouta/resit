import { Worker } from "node:worker_threads";
import workerPath from "../workers/health?modulePath";
import type { HealthCheckResult } from "../shared/ipc";

export function checkHealth(): Promise<HealthCheckResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath);
    worker.once("message", (message: unknown) => {
      if (message === "ready") resolve({ status: "ok" });
      else reject(new Error("Unexpected health worker response"));
    });
    worker.once("error", reject);
    worker.once("exit", () =>
      reject(new Error("Health worker exited before responding")),
    );
  });
}
