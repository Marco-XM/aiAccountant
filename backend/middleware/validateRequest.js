const { ZodError } = require("zod");

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function validateQuery(schema) {
  return (req, res, next) => {
    try {
      // Build a normalized object from req.query with numbers parsed
      const parsed = Object.fromEntries(
        Object.entries(req.query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
      );

      const result = schema.parse(parsed);
      req.query = result;
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: "invalid_request", message: err.errors });
      }
      return next(err);
    }
  };
}

module.exports = { validateQuery };
