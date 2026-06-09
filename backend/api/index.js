// Vercel serverless entry point.
// Sets VERCEL=1 before requiring server.js so that server.js
// does NOT call app.listen() — Vercel handles the HTTP listener.
process.env.VERCEL = "1";

// ── Browser-API polyfills ─────────────────────────────────────────────────────
// pdf-parse v2 bundles pdfjs-dist which references DOMMatrix, ImageData, and
// Path2D at module initialisation time. These don't exist in the Vercel Node.js
// runtime, so we provide minimal stubs BEFORE any require() chain loads pdf-parse.
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0;
      this.m11=1;this.m12=0;this.m13=0;this.m14=0;
      this.m21=0;this.m22=1;this.m23=0;this.m24=0;
      this.m31=0;this.m32=0;this.m33=1;this.m34=0;
      this.m41=0;this.m42=0;this.m43=0;this.m44=1;
      this.is2D=true;this.isIdentity=true;
    }
    static fromMatrix() { return new globalThis.DOMMatrix(); }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
    toFloat32Array() { return new Float32Array(16); }
    toFloat64Array() { return new Float64Array(16); }
  };
}
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class ImageData {
    constructor(sw, sh) {
      this.width = sw;
      this.height = sh;
      this.data = new Uint8ClampedArray(sw * sh * 4);
    }
  };
}
if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = class Path2D {
    addPath(){}arc(){}arcTo(){}bezierCurveTo(){}closePath(){}
    ellipse(){}lineTo(){}moveTo(){}quadraticCurveTo(){}rect(){}
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { connectMongoDatabase } = require("../services/mongoBootstrap");

// Kick off DB connection once per cold start (non-blocking).
// Requests will degrade gracefully if MongoDB is still warming up.
connectMongoDatabase().catch((err) =>
  console.error("[vercel] MongoDB connection error:", err.message)
);

module.exports = require("../server");
