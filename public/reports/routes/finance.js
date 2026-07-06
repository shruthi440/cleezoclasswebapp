

const express = require('express');
const bodyParser = require('body-parser');

const mysql = require('mysql2/promise');
const app = express();
const router = express.Router();

// Middleware to parse JSON requests
app.use(bodyParser.json());

let db;
   const pools = {};

const DBConnection = async (schoolCode) => {
  if (!pools[schoolCode]) {
    pools[schoolCode] = mysql.createPool({
      host: "119.18.62.140",
      user: "root",
      password: "NavyAtagsoLnovA@$000",
      database: schoolCode,
    });
  }
  return pools[schoolCode];
};
 router.post("/getClassFeeDetailsledger", async (req, res) => {
  const { schoolCode, classNames } = req.body;

  if (!Array.isArray(classNames) || classNames.length === 0) {
    return res.status(400).json({ success: false, message: "classNames must be a non-empty array." });
  }

  try {
    const db = await DBConnection(schoolCode);

    const placeholders = classNames.map(() => '?').join(', ');
    const query = `
      SELECT Class_name, CompleteFee
      FROM FeesDetails
      WHERE Class_name IN (${placeholders})
      ORDER BY FIELD(Class_name, ${placeholders})
    `;

    // Pass classNames twice — for WHERE and FIELD()
    const [rows] = await db.execute(query, [...classNames, ...classNames]);

    // New filtering: pick first non-null CompleteFee per class,
    // if none found assign CompleteFee null for that class
    const uniqueFeesMap = new Map();

    for (const row of rows) {
      if (!uniqueFeesMap.has(row.Class_name)) {
        if (row.CompleteFee != null && row.CompleteFee !== '') {
          uniqueFeesMap.set(row.Class_name, row);
        } else {
          uniqueFeesMap.set(row.Class_name, null);
        }
      } else {
        if (
          uniqueFeesMap.get(row.Class_name) === null &&
          row.CompleteFee != null &&
          row.CompleteFee !== ''
        ) {
          uniqueFeesMap.set(row.Class_name, row);
        }
      }
    }

    // Convert map entries to array, fill null fee if needed
    const uniqueFees = [];
    for (const [className, row] of uniqueFeesMap.entries()) {
      if (row === null) {
        uniqueFees.push({ Class_name: className, CompleteFee: null });
      } else {
        uniqueFees.push(row);
      }
    }

    res.status(200).json({
      success: true,
      data: uniqueFees
    });

  } catch (err) {
    console.error("Error fetching unique class fees:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
router.post('/feeDataFinanceNew', async (req, res) => {
  const { schoolCode } = req.query;
  const { fromDate, toDate } = req.body;

  console.log("======================================================");
  console.log("📡 API HIT → /feeDataFinanceNew");
  console.log("📥 Incoming Query Params:", req.query);
  console.log("📥 Incoming Body:", req.body);
  console.log("======================================================");

  if (!schoolCode) {
    console.log("❌ ERROR: 'schoolCode' missing in request");
    return res.status(400).json({ error: 'Missing required schoolCode' });
  }

  if (!fromDate || !toDate) {
    console.log("❌ ERROR: fromDate or toDate missing");
    return res.status(400).json({ error: 'fromDate and toDate are required.' });
  }

  try {
    console.log(`🔌 Attempting DB connection → SchoolCode: ${schoolCode}`);
    const db = await DBConnection(schoolCode);
    console.log(`✅ DB Connection SUCCESS → ${schoolCode}`);

    // -------------------------------------------------------------
    // 1️⃣ Fetch fee records WITH DATE RANGE filter
    console.log("------------------------------------------------------");
    console.log("📘 QUERY 1: Fetching fee details WITH date range filter...");
    console.log("📝 SQL:", `
      SELECT
        f.id,
        f.StudentName AS studentName,
        f.Class_name AS className,
        f.Section,
        f.CompleteFee,
        f.UpdatedCompleteFee,
        f.Paid_Amount,
        f.Discount,
        f.books_paid,
        f.bus_paid,
        f.uniform_paid,
        f.exam_paid,
        f.others_paid,
        f.Final_Amount,
        f.created_at
      FROM FeesDetails f
      WHERE DATE(f.created_at) BETWEEN '${fromDate}' AND '${toDate}'
      ORDER BY f.created_at DESC
    `);

    const [feeResults] = await db.query(
      `
      SELECT
        f.id,
        f.StudentName AS studentName,
        f.Class_name AS className,
        f.Section,
        f.CompleteFee,
        f.UpdatedCompleteFee,
        f.Paid_Amount,
        f.Discount,
        f.books_paid,
        f.bus_paid,
        f.uniform_paid,
        f.exam_paid,
        f.others_paid,
        f.Final_Amount,
        f.created_at
      FROM FeesDetails f
      WHERE DATE(f.created_at) BETWEEN ? AND ?
      ORDER BY f.created_at DESC
      `,
      [fromDate, toDate]
    );

    console.log(`📊 QUERY 1 → Completed`);
    console.log(`📊 Total Fee Records Retrieved: ${feeResults.length}`);
    console.log("📊 Sample Record:", feeResults[0] || "No Records");

    // -------------------------------------------------------------
    // 2️⃣ Get student count per class
    console.log("------------------------------------------------------");
    console.log("📘 QUERY 2: Fetching student counts by class...");
    const [studentCounts] = await db.query(`
      SELECT 
        class_name AS className,
        COUNT(*) AS studentCount
      FROM management_login_creation
      WHERE user_type = 'student'
      GROUP BY class_name
    `);

    console.log("📊 QUERY 2 → Completed");
    console.log("📊 StudentCounts Raw Result:", studentCounts);

    const classStudentCounts = {};
    studentCounts.forEach(row => {
      classStudentCounts[row.className] = row.studentCount;
    });

    console.log("📦 classStudentCounts (Map):", classStudentCounts);

    // -------------------------------------------------------------
    // 3️⃣ Compute pending amounts by Class + Section
    console.log("------------------------------------------------------");
    console.log("🧮 Starting pending computation per class-section...");

    const pendingByClass = feeResults.reduce((acc, fee, index) => {
      console.log(`\n----- 🧪 STUDENT FEE PROCESSING [${index + 1}] -----`);
      console.log("Record:", fee);

      const className = fee.className || 'Unknown';
      const section = fee.Section || 'Unknown';
      const key = `${className}-${section}`;

      const completeFee = Number(fee.CompleteFee) || 0;
      const paidAmount = Number(fee.Paid_Amount) || 0;
      const booksPaid = Number(fee.books_paid) || 0;
      const busPaid = Number(fee.bus_paid) || 0;
      const uniformPaid = Number(fee.uniform_paid) || 0;
      const examPaid = Number(fee.exam_paid) || 0;
      const othersPaid = Number(fee.others_paid) || 0;
      const discount = Number(fee.Discount) || 0;

      const pending = completeFee - (
        paidAmount +
        booksPaid +
        busPaid +
        uniformPaid +
        examPaid +
        othersPaid +
        discount
      );

      console.log(`🧮 Calculated Pending: ${pending}`);

      if (!acc[key]) {
        console.log(`📌 New group created → ${key}`);
        acc[key] = {
          className,
          section,
          totalPending: 0,
          studentCount: classStudentCounts[className] || 0,
          projectedPending: 0
        };
      }

      if (pending > 0) {
        acc[key].totalPending += pending;
      }

      acc[key].projectedPending =
        acc[key].studentCount > 0
          ? acc[key].totalPending * acc[key].studentCount
          : 0;

      console.log(`📈 Aggregated for ${key}:`, acc[key]);

      return acc;
    }, {});

    console.log("------------------------------------------------------");
    console.log("📌 FINAL PENDING SUMMARY (per class-section)");
    console.log(JSON.stringify(pendingByClass, null, 2));

    // -------------------------------------------------------------
    console.log("======================================================");
    console.log("✅ RESPONSE SENT for /feeDataFinanceNew");
    console.log("======================================================");

    return res.status(200).json({
      success: true,
      message: "Data Found",
      results: feeResults,
      classStatistics: pendingByClass,
      studentCounts
    });

  } catch (err) {
    console.log("======================================================");
    console.log("❌ ERROR OCCURRED in /feeDataFinanceNew");
    console.log("📕 Error Message:", err.message);
    console.log("📕 Error Stack:", err.stack);
    console.log("======================================================");

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch finance data',
      details: err.message
    });
  }
});

router.post('/studentCounts', async (req, res) => {
  const { schoolCode } = req.query;
  
  try {
    const db = await DBConnection(schoolCode);
    const [results] = await db.query(`
      SELECT 
        class_name AS className, 
        COUNT(*) AS count 
      FROM management_login_creation 
      WHERE user_type = 'student'
      GROUP BY class_name
    `);
    
    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('Error fetching student counts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
 
 


router.get('/studentsName/feeData/:className/:sectionName', async (req, res) => {
  const { className,sectionName } = req.params; // e.g., "class4"
  const { rollNumber, schoolCode } = req.query;

  // Extract digits from className (e.g., "class4" → "4")
  const classNumber = className.replace(/[^\d]/g, '');

  const sql = `
    SELECT * FROM FeesDetails
    WHERE user_type = 'student' AND class_name =   ? 
  `;

  try {
    const db = await DBConnection(schoolCode);
    const [results] = await db.query(sql, [classNumber,sectionName]);
    res.status(200).json({ students: results });
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


router.post("/getFeesDataOfStudents", async (req, res) => {
  const { schoolCode, className, sectionName } = req.body;
  const classNumber = className.replace(/[^\d]/g, '');
  
  const sql = `
    SELECT fd.*, mlc.father_name, mlc.phone_no 
    FROM FeesDetails fd
    JOIN management_login_creation mlc ON fd.login_id = mlc.id
    WHERE fd.class_name = ? AND fd.section = ?
  `;

  try {
    const db = await DBConnection(schoolCode);
    const [results] = await db.query(sql, [classNumber, sectionName]);
    res.status(200).json({ data: results });
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});







router.get('/totalexpensesData', async (req, res) => {
  console.log("this is server 7.js file");
  console.log('Received request for total expenses value');

  const { schoolCode } = req.query;
  console.log('Query Parameters:', req.query);

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in query' });
  }

  try {
    const db = await DBConnection(schoolCode);

    // Always get all rows without date filtering
    const query =
    `SELECT * FROM Accountant`
   
    // `
    //   SELECT id, person_name, description, expense_name, price, payment_mode,
    //          paid_amount, balance_amount, expense_date, expense_type
    //   FROM Accountant
    //   GROUP BY id, person_name, description, expense_name, price,
    //            payment_mode, paid_amount, balance_amount, expense_date, expense_type
    // `;

    console.log('Executing SQL query:', query);

    const [rows] = await db.query(query);

    rows.forEach(row => {
      row.paid_amount = parseFloat(row.paid_amount);
      row.balance_amount = parseFloat(row.balance_amount);
      row.price = parseFloat(row.price);
    });

    res.json(rows);
    console.log('Sent total expenses data to frontend:', rows);
  } catch (err) {
    console.error('Error executing SQL query:', err.message);
    res.status(500).json({ error: 'Failed to retrieve total expenses data' });
  }
});



module.exports = router;

