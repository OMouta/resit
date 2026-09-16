import { parentPort } from "node:worker_threads";

if (!parentPort) throw new Error("Health check must run in a worker");
parentPort.postMessage("ready");
