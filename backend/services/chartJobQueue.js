const { EventEmitter } = require("events");
const crypto = require("crypto");
const chartController = require("../controllers/chartController");

// In-memory job queue and SSE broadcaster for local dev.
// Replace with Redis + BullMQ in production.

const jobs = new Map();
const emitter = new EventEmitter();

const createJob = async ({ userId, payload }) => {
  const jobId = crypto.randomUUID();
  const job = {
    id: jobId,
    userId: String(userId || ""),
    payload: payload || {},
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    result: null,
    error: null,
  };

  jobs.set(jobId, job);
  process.nextTick(() => processJob(jobId));
  return job;
};

const getJob = (jobId) => {
  return jobs.get(jobId) || null;
};

const emit = (jobId, event, data) => {
  const payload = { jobId, event, data, ts: new Date().toISOString() };
  emitter.emit(jobId, payload);
  // Update stored job
  const j = jobs.get(jobId);
  if (j) {
    j.updatedAt = new Date().toISOString();
    if (event === "progress") j.progress = data.progress || j.progress;
    if (event === "completed") {
      j.status = "completed";
      j.result = data;
    }
    if (event === "error") {
      j.status = "failed";
      j.error = data.error || String(data);
    }
    jobs.set(jobId, j);
  }
};

const processJob = async (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return;
  try {
    emit(jobId, "progress", { progress: 10, message: "Parsing intent and dataset" });

    // Build a fake req/res to call legacy generateChart logic and reuse its analysis code
    const fakeReq = {
      user: { _id: job.userId },
      body: {
        query: job.payload.query || job.payload.prompt || "",
        filters: job.payload.filters || {},
      },
    };

    let captured = null;
    const fakeRes = {
      json: (obj) => {
        captured = obj;
      },
      status: (code) => ({ json: (obj) => { captured = obj; } }),
    };

    emit(jobId, "progress", { progress: 30, message: "Running analytics" });

    // Call legacy generateChart controller to build chart payload
    await chartController.generateChart(fakeReq, fakeRes);

    if (!captured) {
      emit(jobId, "error", { error: "Chart generation returned empty result" });
      return;
    }

    emit(jobId, "progress", { progress: 80, message: "Enhancing insights" });

    // Finalize
    emit(jobId, "completed", { chartJobResult: captured });
  } catch (err) {
    emit(jobId, "error", { error: err.message });
  }
};

const subscribe = (jobId, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const listener = (payload) => {
    try {
      res.write(`event: ${payload.event}\n`);
      res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
    } catch (err) {
      // ignore
    }
  };

  emitter.on(jobId, listener);

  // Send initial state
  const job = jobs.get(jobId);
  if (job) {
    res.write(`event: init\n`);
    res.write(`data: ${JSON.stringify({ status: job.status, progress: job.progress })}\n\n`);
  }


  // Cleanup on client disconnect
  const cleanup = () => {
    emitter.removeListener(jobId, listener);
    try { res.end(); } catch (e) {}
  };

  // Node's http.ServerResponse emits 'close' on client disconnect
  res.on && res.on("close", cleanup);

  return () => {
    emitter.removeListener(jobId, listener);
  };
};

module.exports = { createJob, getJob, subscribe };
