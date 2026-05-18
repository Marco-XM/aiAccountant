const legacy = require("./chartController");

// Adapter controller that will host the redesigned AI Charts APIs.
// For now delegate to existing implementations; this file is the
// entry point for future enhancements (LLM orchestration, caching,
// async insights, etc.).

const getWorkspace = async (req, res) => {
  return legacy.getWorkspace(req, res);
};

const generate = async (req, res) => {
  return legacy.generateChart(req, res);
};

// Async job endpoints
const jobQueue = require("../services/chartJobQueue");

const createJob = async (req, res) => {
  try {
    const job = await jobQueue.createJob({ userId: req.user?._id, payload: req.body || {} });
    res.json({ jobId: job.id, status: job.status });
  } catch (err) {
    res.status(500).json({ error: "Failed to create job", details: err.message });
  }
};

const getJob = async (req, res) => {
  try {
    const job = jobQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: "Failed to get job", details: err.message });
  }
};

const streamJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = jobQueue.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    // Subscribe SSE
    jobQueue.subscribe(jobId, res);
    // keep connection open
  } catch (err) {
    res.status(500).json({ error: "Failed to stream job", details: err.message });
  }
};

const listReports = async (req, res) => {
  return legacy.listReports(req, res);
};

const saveReport = async (req, res) => {
  return legacy.saveReport(req, res);
};

const deleteReport = async (req, res) => {
  return legacy.deleteReport(req, res);
};

// Admin: trigger a reconciliation run (scaffold)
const triggerReconcile = async (req, res) => {
  const reconciler = require("../services/reconciler");
  try {
    const result = await reconciler.reconcileAll({ force: true, userId: req.query.userId });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: "Reconcile failed", details: err.message });
  }
};

module.exports = {
  getWorkspace,
  generate,
  createJob,
  getJob,
  streamJob,
  listReports,
  saveReport,
  deleteReport,
  triggerReconcile,
};
