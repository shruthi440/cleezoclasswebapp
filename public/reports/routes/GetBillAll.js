const express = require("express");
const getBillRoute = express.Router();
const path = require("path");
const mysql = require("mysql2/promise");
const router=express.Router();
// Dynamic DB connection function
const DBConnection = async (schoolCode) => {
  return mysql.createPool({
    host: "162.215.210.38",
    user: "root",
    password: "NavyAtagsoLnovA@$000",
    database: schoolCode,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
};

// Serve static files from /uploads folder (in man server.js or here if needed)

// Get all bills dynamically based on schoolCode query parameter
router.post("/getAllBills", async (req, res) => {
  const {schoolCode} = req.body;
  if (!schoolCode) {
    return res.status(400).json({ error: "Missing schoolCode query parameter" });
  }

  try {
    const db = await DBConnection(schoolCode); // get dynamic pool

    const [rows] = await db.query("SELECT * FROM bills ORDER BY date DESC");
      const bills = rows.map((row) => {
      const filename = row.image_path ? path.basename(row.image_path) : null;
      const imageUrl = filename ? `http://localhost:3020/uploads/${filename}` : null;

      return {
        id: row.id,
        billType: row.billType,
        amount: row.amount,
        date: row.date,
        imageUrl, // ✅ Send proper public URL
      };
    });


  

    res.json(bills);
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports=router;