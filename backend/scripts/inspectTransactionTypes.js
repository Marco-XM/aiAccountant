require("dotenv").config();
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const types = await Transaction.distinct("type");
  const counts = await Transaction.aggregate([
    { $group: { _id: "$type", c: { $sum: 1 } } },
    { $sort: { c: -1 } },
  ]);

  console.log("Distinct types:", types);
  console.log("Counts by type:", counts);

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
