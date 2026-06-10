const express = require("express");
const auth = require("../middleware/auth.mw");
const {
  listTaxes,
  createTax,
  updateTax,
  deleteTax,
  calculate,
  report,
} = require("../controllers/taxController");

const router = express.Router();

router.use(auth);

router.get("/", listTaxes);
router.post("/", createTax);
router.post("/calculate", calculate);
router.get("/report", report);
router.put("/:id", updateTax);
router.delete("/:id", deleteTax);

module.exports = router;
