const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files allowed'));
  }
});

// 👉 Database connection function
const getDbConnection = (schoolCode) => {
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode
  }).promise();
};

// 👉 Middleware to extract schoolCode
router.use((req, res, next) => {
  const schoolCode = req.query.schoolCode || req.body.schoolCode;
  if (!schoolCode) {
    return res.status(400).json({ error: "Missing schoolCode parameter" });
  }
  req.schoolCode = schoolCode;
  next();
});
router.post('/getClassSectionFeeTotal', async (req, res) => {
  console.log("=== /getClassSectionFeeTotal called ===");
  const { className, section } = req.body;
  const db = getDbConnection(req.schoolCode);

  if (!className || !section) {
    return res.status(400).json({ message: "Missing className or section." });
  }

  try {
    const generalFeeSql = `
      SELECT CompleteFee, Admission_fees, Discount, fee_discount, tuition_discount
      FROM FeesDetails
      WHERE StudentName IS NULL AND class_name = ? AND section = ? LIMIT 1;
    `;
    const [generalRows] = await db.execute(generalFeeSql, [className, section]);

    if (!generalRows.length) 
      return res.status(404).json({ message: "General fee structure not found." });

    const general = generalRows[0];

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS Number_of_Students 
       FROM management_login_creation 
       WHERE class_name=? AND section=? AND user_type='student'`,
      [className, section]
    );
    const Number_of_Students = countRows[0].Number_of_Students;

    const [paidRows] = await db.execute(
      `SELECT
        COALESCE(SUM(Paid_Amount),0) AS Total_Paid_Amount,
        COALESCE(SUM(books_paid),0) AS Total_Books_Paid,
        COALESCE(SUM(bus_paid),0) AS Total_Bus_Paid,
        COALESCE(SUM(uniform_paid),0) AS Total_Uniform_Paid,
        COALESCE(SUM(exam_paid),0) AS Total_Exam_Paid,
        COALESCE(SUM(others_paid),0) AS Total_Others_Paid,
        COALESCE(SUM(Admission_paid),0) AS Total_Admission_Paid
      FROM FeesDetails
      WHERE StudentName IS NOT NULL AND class_name=? AND section=?`,
      [className, section]
    );

    const paid = paidRows[0];

    const CompleteFee = parseFloat(general.CompleteFee || 0);
    const AdmissionFee = parseFloat(general.Admission_fees || 0);

    const Total_General_Discount =
      parseFloat(general.Discount || 0) +
      parseFloat(general.fee_discount || 0) +
      parseFloat(general.tuition_discount || 0);

    const Total_Calculated_Due =
      Number_of_Students * (CompleteFee - Total_General_Discount);

    const Paid_Amount = parseFloat(paid.Total_Paid_Amount || 0);
    const Books_Paid = parseFloat(paid.Total_Books_Paid || 0);
    const Bus_Paid = parseFloat(paid.Total_Bus_Paid || 0);
    const Uniform_Paid = parseFloat(paid.Total_Uniform_Paid || 0);
    const Exam_Paid = parseFloat(paid.Total_Exam_Paid || 0);
    const Others_Paid = parseFloat(paid.Total_Others_Paid || 0);
    const Admission_Paid = parseFloat(paid.Total_Admission_Paid || 0);

    const Total_Paid_Without_Admission =
      Paid_Amount + Books_Paid + Bus_Paid +
      Uniform_Paid + Exam_Paid + Others_Paid;

    const Total_Paid_With_Admission =
      Total_Paid_Without_Admission + Admission_Paid;

    const Percent_Paid = ((Total_Paid_With_Admission /
      (Total_Calculated_Due + (AdmissionFee * Number_of_Students))) * 100).toFixed(2);

    const Percent_Due = (100 - Percent_Paid).toFixed(2);

    const Total_Admission_Fee = AdmissionFee * Number_of_Students;

    const Percent_Admission_Paid = ((Admission_Paid / Total_Admission_Fee) * 100).toFixed(2);
    const Percent_Admission_Due = (100 - Percent_Admission_Paid).toFixed(2);

    res.json({
      Number_of_Students,
      CompleteFee,
      AdmissionFee,
      Total_General_Discount,
      Total_Paid_Without_Admission,
      Total_Admission_Paid: Admission_Paid,
      Total_Paid_With_Admission,
      Total_Calculated_Due,
      Percent_Paid,
      Percent_Due,
      Percent_Admission_Paid,
      Percent_Admission_Due
    });

  } catch (error) {
    console.error("❌ Database Error:", error.message);
    res.status(500).json({ error: "Internal server error while fetching class fee totals." });
  }
});


router.post('/getStudentTotals', async (req, res) => {
  const { studentName, className, section } = req.body;
  const db = getDbConnection(req.schoolCode);

  if (!studentName || !className || !section) {
    return res.status(400).json({ message: "Missing studentName, className, or section." });
  }

  try {
    const [generalRows] = await db.execute(
      `SELECT CompleteFee, Admission_fees, Discount, fee_discount, tuition_discount
       FROM FeesDetails
       WHERE StudentName IS NULL AND class_name=? AND section=? LIMIT 1`,
      [className, section]
    );

    if (!generalRows.length) {
      return res.status(404).json({ message: "General fee structure not found." });
    }

    const general = generalRows[0];

    const CompleteFee = parseFloat(general.CompleteFee || 0);
    const AdmissionFee = parseFloat(general.Admission_fees || 0);

    const Total_General_Discount =
      parseFloat(general.Discount || 0) +
      parseFloat(general.fee_discount || 0) +
      parseFloat(general.tuition_discount || 0);

    const [paidRows] = await db.execute(
      `SELECT
        COALESCE(Paid_Amount,0) AS Paid_Amount,
        COALESCE(books_paid,0) AS Books_Paid,
        COALESCE(bus_paid,0) AS Bus_Paid,
        COALESCE(uniform_paid,0) AS Uniform_Paid,
        COALESCE(exam_paid,0) AS Exam_Paid,
        COALESCE(others_paid,0) AS Others_Paid,
        COALESCE(Admission_paid,0) AS Admission_Paid
       FROM FeesDetails
       WHERE StudentName=? AND class_name=? AND section=?`,
      [studentName, className, section]
    );

    if (!paidRows.length) {
      return res.status(404).json({ message: `No fee record found for student ${studentName}.` });
    }

    const paid = paidRows[0];

    const Total_Paid_Without_Admission =
      parseFloat(paid.Paid_Amount) +
      parseFloat(paid.Books_Paid) +
      parseFloat(paid.Bus_Paid) +
      parseFloat(paid.Uniform_Paid) +
      parseFloat(paid.Exam_Paid) +
      parseFloat(paid.Others_Paid);

    const Total_Admission_Paid = parseFloat(paid.Admission_Paid);
    const Total_Paid_With_Admission = Total_Paid_Without_Admission + Total_Admission_Paid;

    const Total_Calculated_Due = CompleteFee - Total_General_Discount;

    const Percent_Paid = ((Total_Paid_With_Admission / (Total_Calculated_Due + AdmissionFee)) * 100).toFixed(2);

    const Percent_Due = (100 - Percent_Paid).toFixed(2);

    const Percent_Admission_Paid = ((Total_Admission_Paid / AdmissionFee) * 100).toFixed(2);
    const Percent_Admission_Due = (100 - Percent_Admission_Paid).toFixed(2);

    res.json({
      Number_of_Students: 1,
      CompleteFee,
      AdmissionFee,
      Total_General_Discount,
      Total_Paid_Without_Admission,
      Total_Admission_Paid,
      Total_Paid_With_Admission,
      Total_Calculated_Due,
      Percent_Paid,
      Percent_Due,
      Percent_Admission_Paid,
      Percent_Admission_Due
    });

  } catch (error) {
    console.error("❌ Database Error:", error.message);
    res.status(500).json({ error: "Internal server error while fetching student totals." });
  }
});

/// Get only dynamic options
router.get("/get-expense-master", async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  try {
    const [rows] = await db.execute(
      "SELECT category, expense_name FROM expense_master ORDER BY category"
    );

    const dynamicOptions = {};

    rows.forEach(row => {
      if (!dynamicOptions[row.category]) dynamicOptions[row.category] = [];
      dynamicOptions[row.category].push(row.expense_name);
    });

    res.json(dynamicOptions);

  } catch (err) {
    res.status(500).json({ message: "Database Error", error: err });
  }
});

router.post("/add-expense", async (req, res) => {
  const db = getDbConnection(req.schoolCode);
  const { categoryName, categoryDescription, expenseName, expenseDescription } = req.body;

  if (!categoryName || !expenseName) {
    return res.status(400).json({ message: "Category and Expense Name required" });
  }

  try {
    await db.execute(
      `INSERT INTO expense_master 
       (category, category_description, expense_name, expense_description) 
       VALUES (?, ?, ?, ?)`,
      [categoryName, categoryDescription || "", expenseName, expenseDescription || ""]
    );

    res.json({ message: "Saved successfully!" });

  } catch (err) {
    res.status(500).json({ message: "Database Error", error: err });
  }
});


/* ========================================================
    1) GET: Fetch Class & Staff Metadata
========================================================= */
router.get('/api/metadata/class-staff-options', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  try {
    const [staffResults] = await db.execute(
      `SELECT name FROM management_login_creation 
       WHERE user_type = 'teacher' AND is_deleted = 0`
    );

    const [classResults] = await db.execute(
      `SELECT DISTINCT class_name FROM management_login_creation 
       WHERE class_name IS NOT NULL AND class_name != '' AND is_deleted = 0`
    );

    res.json({
      classOptions: classResults.map(r => r.class_name),
      staffOptions: staffResults.map(r => r.name)
    });

  } catch (error) {
    console.error("Error fetching class/staff metadata:", error);
    res.status(500).json({ message: "Failed to fetch necessary metadata." });
  }
});

// SQL constant: Selects all teaches_to columns from the schema
const TEACHES_TO_COLUMNS_SQL = [
    'teaches_to_1', 'teaches_to_2', 'teaches_to_3', 'teaches_to_4',
    'teaches_to_5', 'teaches_to_6', 'teaches_to_7', 'teaches_to_8',
    'teaches_to_9', 'teaches_to_10', 'teaches_to_11', 'teaches_to_12'
].join(', ');

router.get('/api/metadata', async (req, res) => {

  const db = getDbConnection(req.schoolCode);   // ✔ connect to correct database

  try {
    // Query 1: Fetch ALL teacher records + subjects
    const teacherQuery = `
        SELECT 
            name,
            designation,
            class_name,
            ${TEACHES_TO_COLUMNS_SQL}
        FROM management_login_creation
        WHERE user_type = 'teacher'
          AND is_deleted = 0;
    `;
    
    const [teachers] = await db.query(teacherQuery);

    // Query 2: Fetch ALL unique classes
    const classesQuery = `
        SELECT DISTINCT class_name
        FROM management_login_creation
        WHERE class_name IS NOT NULL
          AND class_name != ''
          AND is_deleted = 0;
    `;

    const [classes] = await db.query(classesQuery);

    // Prepare class list
    const classesList = classes.map(c => c.class_name).filter(Boolean);

    // Send full metadata
    res.json({
      teachers: teachers,
      classes: classesList
    });

  } catch (error) {
    console.error("Error fetching metadata:", error);
    res.status(500).json({
      message: "Error fetching metadata from the database."
    });
  }
});
/* ========================================================
    2) POST: Extra/Special Class Request
========================================================= */
router.post('/api/request-class', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  const { request_type, class_name, date, time, duration_minutes, staff_name, requestedByUserId } = req.body;

  if (!request_type || !class_name || !date || !time || !duration_minutes || !staff_name) {
    return res.status(400).json({ message: "All form fields are required." });
  }

  try {
    await db.execute(
      `INSERT INTO extra_special_class_requests 
       (request_type, class_name, request_date, start_time, duration_minutes, staff_name, requested_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [request_type, class_name, date, time, duration_minutes, staff_name, requestedByUserId]
    );

    res.json({ message: `${request_type} class request submitted successfully and is PENDING approval.` });

  } catch (error) {
    console.error("Error submitting request:", error);
    res.status(500).json({ message: "Error submitting class request." });
  }
});

/* ========================================================
    3) GET /classes
========================================================= */
router.get('/classes', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  try {
    const [rows] = await db.execute(
      "SELECT DISTINCT class_name FROM management_login_creation WHERE user_type='student' AND is_deleted=0"
    );
    res.json(rows.map(r => r.class_name).filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch classes." });
  }
});

/* ========================================================
    4) GET /sections
========================================================= */
router.get('/sections', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  try {
    const [rows] = await db.execute(
      "SELECT DISTINCT section FROM management_login_creation WHERE user_type='student' AND is_deleted=0"
    );
    res.json(rows.map(r => r.section).filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch sections." });
  }
});
router.get('/sectionFilter', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  try {
    const [rows] = await db.execute(`
      SELECT DISTINCT class_name, section
      FROM management_login_creation
      WHERE user_type = 'student'
        AND is_deleted = 0
        AND class_name IS NOT NULL
        AND section IS NOT NULL
      ORDER BY class_name, section
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch sections." });
  }
});

/* ========================================================
    5) GET /students
========================================================= */
router.get('/students', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  const { class_name, section } = req.query;

  let query = "SELECT id, username, name, class_name, section FROM management_login_creation WHERE user_type='student' AND is_deleted=0";
  let params = [];

  if (class_name) {
    query += " AND class_name=?";
    params.push(class_name);
  }
  if (section) {
    query += " AND section=?";
    params.push(section);
  }

  query += " ORDER BY name ASC";

  try {
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch students." });
  }
});

/* ========================================================
    6) GET Attendance
========================================================= */
router.get('/student/attendance/:username', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  try {
    const [rows] = await db.execute(
      "SELECT date, leavetype, submission_time, class, section, name FROM attendance_frontend WHERE username=? ORDER BY date DESC",
      [req.params.username]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch attendance." });
  }
});

/* ========================================================
    7) GET Discipline Reports
========================================================= */
router.get('/student/discipline/:username', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  try {
    const [rows] = await db.execute(
      "SELECT created_at, report, comment, class_name, section FROM teachers_student_report WHERE username=? ORDER BY created_at DESC",
      [req.params.username]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch report." });
  }
});

/* ========================================================
    8) POST Academics
========================================================= */
router.post('/student/academics', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  const { name, class_name, section } = req.body;

  if (!name || !class_name || !section) {
    return res.status(400).json({ message: "Missing required identifiers." });
  }

  try {
    const [rows] = await db.execute(
      "SELECT test_type, subject, marks, createdAt FROM academic_performance_of_student WHERE name=? AND class_name=? AND section=? ORDER BY createdAt DESC",
      [name, class_name, section]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch academic data." });
  }
});

/* ========================================================
    9) POST Extra-Curricular Fetch
========================================================= */
router.post('/student/extra-curricular-data', async (req, res) => {
  const db = getDbConnection(req.schoolCode);
  const { name, class_name, section } = req.body;

  try {
    const [rows] = await db.execute(
      `SELECT program_name, winning_event, winning_rank, winning_date, created_at 
       FROM ExtraCurcularActivities 
       WHERE student_name=? AND class_name=? AND section=?
       ORDER BY winning_date DESC, created_at DESC`,
      [name, class_name, section]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch extra-curricular data." });
  }
});

/* ========================================================
    10) POST Extra-Curricular Submit
========================================================= */
router.post('/student/extra-curricular', async (req, res) => {
  const db = getDbConnection(req.schoolCode);

  const {
    student_name, class_name, section,
    program_name, winning_event, winning_rank, winning_date
  } = req.body;

  try {
    await db.execute(
      `INSERT INTO ExtraCurcularActivities 
       (student_name, class_name, section, program_name, winning_event, winning_rank, winning_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        student_name, class_name, section,
        program_name, winning_event || null,
        winning_rank || null, winning_date || null
      ]
    );

    res.json({ message: "Extra-curricular activity recorded successfully." });
  } catch (err) {
    res.status(500).json({ message: "Failed to record activity." });
  }
});

module.exports = router;
