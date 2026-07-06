const express = require("express");
const router = express.Router();
const { getDatabaseConnection } = require("../config/db");

// ===============================
// GET LEDGER DATA
// ===============================
router.get("/ledger", async (req, res) => {
  try {
    const { schoolCode, type, from, to } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ error: "schoolCode is required" });
    }

    const db = getDatabaseConnection(schoolCode);

    let condition = "";
    let values = [];

    if (type === "today") {
      condition = "WHERE DATE(paidDate) = CURDATE()";
    }

    else if (type === "lastWeek") {
      condition = "WHERE paidDate >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
    }

    else if (type === "custom" && from && to) {
      condition = "WHERE DATE(paidDate) BETWEEN ? AND ?";
      values.push(from, to);
    }

    const query = `
      SELECT 
        id,
        StudentName,
        Class_name,
        section,
        CompleteFee,
        Paid_Amount,
        Previous_Paid,
        Previous_Fee_Due,
        Discount,
        paymentMode,
        transaction_id,
        paidDate,fee_type,
        receiptNumber,amount_paid,
        created_at
      FROM FeesDetails
      ${condition}
      ORDER BY paidDate DESC
    `;

    const [rows] = await db.query(query, values);

    res.json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
