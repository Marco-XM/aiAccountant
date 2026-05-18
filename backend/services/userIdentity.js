const mongoose = require("mongoose");

const isMongoObjectId = (value) => mongoose.isValidObjectId(value);

module.exports = {
  isMongoObjectId,
};