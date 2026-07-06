const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const app = express();

app.use(cors());
app.use(bodyParser.json());

// ✅ MySQL Connection
const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
  database: "SatyaTech"       // Your database name
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database.");
  }
});
// 🔥 Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");  // Save Excel files in 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// 🔥 Upload and Insert Fees from Excel
// 🔥 Upload Fees from Excel or Manual Form
// router.post("/upload-fees", upload.single("file"), async (req, res) => {
//   let feesData = [];

//   try {
//     // 📊 Handle Excel Upload
//     if (req.file) {
//       const filePath = req.file.path;

//       const workbook = xlsx.readFile(filePath);
//       const sheetName = workbook.SheetNames[0]; // First sheet
//       const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//       if (!Array.isArray(data) || data.length === 0) {
//         return res.status(400).json({ message: "Invalid or empty Excel file" });
//       }

//       feesData = data.map((row) => [
//         row.class_name,
//         row.fee_category,
//         row.amount,
//         row.duration,
//         row.from_year,
//         row.to_year,
//       ]);
//     }

//     // 📝 Handle Manual Form Data
//     if (req.body.fees) {
//       const formData = JSON.parse(req.body.fees);
//       const manualFees = formData.map((row) => [
//         row.class_name,
//         row.fee_category,
//         row.amount,
//         row.duration,
//         row.from_year,
//         row.to_year,
//       ]);
//       feesData = [...feesData, ...manualFees];  // Combine both Excel and manual data
//     }

//     if (feesData.length === 0) {
//       return res.status(400).json({ message: "No valid fee data provided." });
//     }

//     // 🚀 Insert Fees into Database
//     const insertQuery = `
//       INSERT INTO fees (class_name, fee_category, amount, duration, from_year, to_year)
//       VALUES ?;
//     `;

//     db.query(insertQuery, [feesData], (err, result) => {
//       if (err) {
//         console.error("❌ Error inserting fees:", err);
//         return res.status(500).send("Failed to add fees.");
//       }

//       // Fetch the newly inserted rows
//       const insertedIds = result.insertId;  // Get the first inserted ID
//       const selectQuery = `
//         SELECT * FROM fees
//         WHERE id >= ?  -- Fetch only the newly inserted rows
//         ORDER BY id DESC;
//       `;

//       db.query(selectQuery, [insertedIds], (err, rows) => {
//         if (err) {
//           console.error("❌ Error fetching inserted data:", err);
//           return res.status(500).send("Failed to retrieve inserted fees.");
//         }

//         res.status(201).json({
//           message: "✅ Fees added successfully.",
//           insertedRows: rows,  // Send the inserted data back to frontend
//         });
//       });
//     });

//   } catch (error) {
//     console.error("❌ Error processing fees:", error);
//     res.status(500).send("Failed to process fees.");
//   }
// });
// router.post("/upload-fees", upload.single("file"), async (req, res) => {
//   let feesData = [];

//   try {
//     // 📊 Handle Excel Upload
//     if (req.file) {
//       const filePath = req.file.path;
//       const workbook = xlsx.readFile(filePath);
//       const sheetName = workbook.SheetNames[0];
//       const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//       if (!Array.isArray(data) || data.length === 0) {
//         return res.status(400).json({ message: "Invalid or empty Excel file" });
//       }

//       feesData = data.map((row) => [
//         row.class_name,
//         row.fee_category,
//         row.amount,
//         row.duration,
//         row.from_year,
//         row.to_year,
//       ]);
//     }

//     // 📝 Handle Manual Form Data
//     if (req.body.fees) {
//       const formData = JSON.parse(req.body.fees);
//       const manualFees = formData.map((row) => [
//         row.class_name,
//         row.fee_category,
//         row.amount,
//         row.duration,
//         row.from_year,
//         row.to_year,
//       ]);
//       feesData = [...feesData, ...manualFees];  // Combine Excel and manual data
//     }

//     if (feesData.length === 0) {
//       return res.status(400).json({ message: "No valid fee data provided." });
//     }

//     // 🚀 Insert Fees into Database
//     const insertQuery = `
//       INSERT INTO fees (class_name, fee_category, amount, duration, from_year, to_year)
//       VALUES ?;
//     `;

//     db.query(insertQuery, [feesData], (err, result) => {
//       if (err) {
//         console.error("❌ Error inserting fees:", err);
//         return res.status(500).send("Failed to add fees.");
//       }

//       const insertedIds = result.insertId;  // First inserted ID
//       const selectQuery = `
//         SELECT * FROM fees
//         WHERE id >= ?
//         ORDER BY id ASC;
//       `;

//       db.query(selectQuery, [insertedIds], (err, rows) => {
//         if (err) {
//           console.error("❌ Error fetching inserted data:", err);
//           return res.status(500).send("Failed to retrieve inserted fees.");
//         }

//         res.status(201).json({
//           message: "✅ Fees added successfully.",
//           savedFees: rows,  // Send the inserted rows to frontend
//         });
//       });
//     });

//   } catch (error) {
//     console.error("❌ Error processing fees:", error);
//     res.status(500).send("Failed to process fees.");
//   }
// });

// // 🔥 Add Fees
router.post("/addfees", (req, res) => {
    const feesData = req.body;
  
    if (!Array.isArray(feesData)) {
      return res.status(400).json({ message: "Invalid data format" });
    }
  
    const values = feesData.map((fee) => [
      fee.class_name,
      fee.fee_category,
      fee.amount,
      fee.duration,
      fee.from_year,
      fee.to_year,
    ]);
  
    const insertQuery = `
      INSERT INTO fees (class_name, fee_category, amount, duration, from_year, to_year)
      VALUES ?;
    `;
  
    db.query(insertQuery, [values], (err) => {
      if (err) {
        console.error("❌ Error inserting fees:", err);
        return res.status(500).send("Failed to add fees.");
      }
  
      const selectQuery = `
        SELECT * FROM fees
        ORDER BY id DESC LIMIT ?;
      `;
  
      db.query(selectQuery, [feesData.length], (err, results) => {
        if (err) {
          console.error("❌ Error fetching saved fees:", err);
          return res.status(500).send("Failed to retrieve saved fees.");
        }
  
        // Ensure the response always returns an array
        res.status(201).json({
          message: "✅ Fees added successfully.",
          savedFees: Array.isArray(results) ? results : [results]
        });
      });
    });
  });
  
  

// 🛠️ Edit Fee
router.put("/editfee/:id", (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  const query = `UPDATE fees SET amount = ? WHERE id = ?`;

  db.query(query, [amount, id], (err) => {
    if (err) {
      console.error("❌ Error updating fee:", err);
      return res.status(500).send("Failed to update fee.");
    }
    res.send("✅ Fee updated successfully.");
  });
});


// 🚮 Delete Fee
router.delete("/deletefee/:id", (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM fees WHERE id = ?`;

  db.query(query, [id], (err) => {
    if (err) {
      console.error("❌ Error deleting fee:", err);
      return res.status(500).send("Failed to delete fee.");
    }
    res.send("✅ Fee deleted successfully.");
  });
});


// 🔍 Get Fees with Year Range
// router.get("/getfees", (req, res) => {
//   const fromYear = parseInt(req.query.fromYear) || new Date().getFullYear();
//   const toYear = parseInt(req.query.toYear) || new Date().getFullYear() + 1;

//   const query = `
//     SELECT * FROM fees
//     WHERE from_year >= ? AND to_year <= ?
//     ORDER BY from_year, class_name;
//   `;

//   db.query(query, [fromYear, toYear], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching fees:", err);
//       return res.status(500).send("Failed to retrieve fees.");
//     }
//     res.json(results);
//   });
// });
module.exports = router;


