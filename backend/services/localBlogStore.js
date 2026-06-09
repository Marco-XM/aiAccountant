const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const STORE_DIR = process.env.VERCEL === "1" ? require("path").join("/tmp", "blog") : path.join(__dirname, "..", "uploads", "blog");
const STORE_FILE = path.join(STORE_DIR, "store.json");

const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify({ posts: [] }, null, 2), "utf8");
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return Array.isArray(parsed.posts) ? parsed.posts : [];
};

const writeStore = async (posts) => {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify({ posts }, null, 2), "utf8");
};

const slugify = (title) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const getAllPosts = async (includeUnpublished = false) => {
  const posts = await readStore();
  if (includeUnpublished) return posts;
  return posts.filter((p) => p.status === "published");
};

const getPostById = async (id) => {
  const posts = await readStore();
  return posts.find((p) => p._id === id) || null;
};

const getPostBySlug = async (slug) => {
  const posts = await readStore();
  return posts.find((p) => p.slug === slug) || null;
};

const createPost = async (data) => {
  const posts = await readStore();
  const slug = data.slug || slugify(data.title);
  const post = {
    _id: crypto.randomBytes(12).toString("hex"),
    title: data.title,
    slug,
    excerpt: data.excerpt || "",
    content: data.content || "",
    coverImage: data.coverImage || null,
    status: data.status || "draft",
    author: data.author || "Admin",
    tags: data.tags || [],
    publishedAt: data.status === "published" ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  posts.unshift(post);
  await writeStore(posts);
  return post;
};

const updatePost = async (id, data) => {
  const posts = await readStore();
  const index = posts.findIndex((p) => p._id === id);
  if (index === -1) return null;
  const existing = posts[index];
  const updated = {
    ...existing,
    ...data,
    _id: existing._id,
    updatedAt: new Date().toISOString(),
  };
  if (data.status === "published" && !existing.publishedAt) {
    updated.publishedAt = new Date().toISOString();
  }
  posts[index] = updated;
  await writeStore(posts);
  return updated;
};

const deletePost = async (id) => {
  const posts = await readStore();
  const filtered = posts.filter((p) => p._id !== id);
  if (filtered.length === posts.length) return false;
  await writeStore(filtered);
  return true;
};

module.exports = {
  getAllPosts,
  getPostById,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  slugify,
};
