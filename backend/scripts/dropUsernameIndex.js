// One-off fix: drop the stale unique user-name index from the users collection.
//
// An older User schema had a unique user-name field. The current schema removed
// it, so every new user is inserted with that field absent (indexed as `null`).
// The leftover unique index allows that exactly once, so every signup after the
// first fails with:
//   E11000 duplicate key error: index: userName_1 dup key: { userName: null }
//
// The live index is named `userName_1` (camelCase); `username_1` is also dropped
// in case an older environment created the lowercase variant.
//
// Run against the target database (set MONGODB_URI in the environment or .env):
//   node backend/scripts/dropUsernameIndex.js
//
// Safe to run repeatedly — it no-ops if the index is already gone. The same
// cleanup also runs automatically on connect (see services/mongoBootstrap.js),
// so this script is only needed to fix production before the next deploy.
require("dotenv").config();
const mongoose = require("mongoose");

const INDEX_NAMES = ["userName_1", "username_1"];
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

  const present = new Set(indexes.map((idx) => idx.name));
  let dropped = 0;

  for (const indexName of INDEX_NAMES) {
    if (present.has(indexName)) {
      await collection.dropIndex(indexName);
      console.log(`Dropped index ${COLLECTION}.${indexName}.`);
      dropped += 1;
    } else {
      console.log(`Index ${COLLECTION}.${indexName} not found — nothing to do.`);
    }
  }

  console.log(`Done. Dropped ${dropped} index(es).`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
