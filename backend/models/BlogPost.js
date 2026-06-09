const mongoose = require("mongoose");

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, trim: true },
    content: { type: String, default: "" }, // markdown
    coverImage: { type: String },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    author: { type: String, default: "Admin" },
    tags: [{ type: String, trim: true }],
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto-set publishedAt when publishing
blogPostSchema.pre("save", function (next) {
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model("BlogPost", blogPostSchema);
