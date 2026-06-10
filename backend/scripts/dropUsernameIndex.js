// One-off fix: drop the stale unique `username_1` index from the users collection.
//
// An older User schema had a unique `username` field. The current schema removed
// it, so every new user is inserted with `username: null`. The leftover unique
// index allows that exactly once, so every signup after the first fails with:
//   E11000 duplicate key error: index: username_1 dup key: { username: null }
//
// Run against the target database (set MONGODB_URI in the environment or .env):
//   node backend/scripts/dropUsernameIndex.js
//
// Safe to run repeatedly — it no-ops if the index is already gone. The same
// cleanup also runs automatically on connect (see services/mongoBootstrap.js),
// so this script is only needed to fix production before the next deploy.
require("dotenv").config();
const mongoose = require("mongoose");

const INDEX_NAME = "username_1";
const COLLECTION = "users";

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Set MONGODB_URI (or MONGO_URI) to the target database.");
  }

  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection(COLLECTION);

  const indexes = await collection.indexes();
  console.log(
    "Current indexes:",
    indexes.map((idx) => idx.name),
  );

  if (indexes.some((idx) => idx.name === INDEX_NAME)) {
    await collection.dropIndex(INDEX_NAME);
    console.log(`Dropped index ${COLLECTION}.${INDEX_NAME}.`);
  } else {
    console.log(`Index ${COLLECTION}.${INDEX_NAME} not found — nothing to do.`);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
