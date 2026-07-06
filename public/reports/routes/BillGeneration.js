const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const router = express.Router()

// Dynamic MySQL connection pool based on schoolCode
const DBConnection = async (schoolCode) => {
  return mysql.createPool({
    host: "162.215.210.38",
    user: "root",
    password: "NavyAtagsoLnovA@$000",
    database: schoolCode,
  });
};

const feeStructureReservedColumns = new Set([
  "id",
  "schoolCode",
  "school_code",
  "class_name",
  "className",
  "Class_name",
  "ClassName",
  "section",
  "Section",
  "sectionName",
  "StudentName",
  "studentName",
  "name",
  "created_at",
  "updated_at",
  "paymentDate",
  "paidDate",
  "paymentdate",
  "paiddate",
  "date",
  "receiptNumber",
  "paymentMode",
  "transactionId",
  "transaction_id",
  "transactionid",
  "Paid_Amount",
  "paidAmount",
  "completeFee",
  "CompleteFee",
  "Tuition_Fee",
  "TuitionFee",
  "Calculated_Tuition_Fee",
  "Admission_fees",
  "Admission_Fee",
  "admissionFee",
  "Admission_paid",
  "admission_paid",
  "Exam_fees",
  "Exam_Fee",
  "examFee",
  "exam_paid",
  "Uniform_fees",
  "Uniform_Fee",
  "uniformFee",
  "uniform_paid",
  "Book_Fees",
  "Book_Fee",
  "bookFee",
  "books_paid",
  "Others",
  "Other_Fee",
  "othersFee",
  "others_paid",
  "ResidentialCompleteFee",
  "residentialFee",
  "Bus_fees",
  "Bus_Fee",
  "busFee",
  "bus_paid",
  "fee_type",
  "fee_discount",
  "tuition_discount",
  "bus_discount",
  "discount_reason",
  "FeeClass",
  "FeeSection",
  "UploadFeeDetails",
  "UpdatedCompleteFee",
  "Installment1_Amount",
  "Installment1_Deadline_Date",
  "Installment1_Fine",
  "Installment2_Amount",
  "Installment2_Deadline_Date",
  "Installment2_Fine",
  "Installment3_Amount",
  "Installment3_Deadline_Date",
  "Installment3_Fine",
  "Installment4_Amount",
  "Installment4_Deadline_Date",
  "Installment4_Fine",
  "Installment5_Amount",
  "Installment5_Deadline_Date",
  "Installment5_Fine",
  "Installment1_Paid",
  "Installment2_Paid",
  "Installment3_Paid",
  "Installment4_Paid",
  "Installment5_Paid",
  "Installment1_PaidDate",
  "Installment2_PaidDate",
  "Installment3_PaidDate",
  "Installment4_PaidDate",
  "Installment5_PaidDate",
  "RES_INST_1",
  "RES_INST_1_DATE",
  "RES_INST_2",
  "RES_INST_2_DATE",
  "RES_INST_3",
  "RES_INST_3_DATE",
  "RES_INST_4",
  "RES_INST_4_DATE",
  "RES_INST_5",
  "RES_INST_5_DATE",
  "Previous_Paid",
  "Previous_Fee_Due",
  "Advance_fee",
  "Discount",
  "Discount_Date",
  "Discount_Referred_By",
  "Discount_Approved_By",
  "Discount_RefNo",
  "marks_obtained",
  "grade",
  "remarks",
  "rank",
  "status",
  "frequency_type",
  "login_id",
]);

const isDynamicFeeColumn = (key) => {
  if (!key) return false;
  if (feeStructureReservedColumns.has(key)) return false;
  if (key.endsWith("_paid") || key.endsWith("_due")) return false;
  return true;
};

const collectDynamicFeeColumns = (rows = []) => {
  const keys = new Set();
  rows.filter(Boolean).forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (isDynamicFeeColumn(key)) {
        keys.add(key);
      }
    });
  });
  return [...keys];
};
router.post("/attendance/set-login-logout-time", async (req, res) => {
  console.log("Request body:", req.body);

  const { schoolCode, loginTime, logoutTime } = req.body;
const uploadedDate = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  if (!schoolCode || (!loginTime && !logoutTime)) {
    return res.status(400).json({ message: "Missing required fields." });
  }



 function formatDateTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.error("Invalid date passed to formatDateTime:", date);
    return null; // or return a default date if needed
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const loginTimeFormatted = formatDateTime(loginTime);
const logoutTimeFormatted = formatDateTime(logoutTime);



  try {
    const pool = await DBConnection(schoolCode);

    // Insert new row with today's uploaded date
    await pool.execute(
      `INSERT INTO TEACHERS_ATTENDANCE_TIME (LOGIN_TIME, LOGOUT_TIME, UPLOADED_DATE)
       VALUES (?, ?, CURDATE())`,
      [loginTimeFormatted , logoutTimeFormatted , uploadedDate]
    );

    res.status(200).json({ message: "Login/Logout time saved successfully" });
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ message: "Database error", error: error.message });
  }
});
router.get('/studentsName/:className', async (req, res) => {
  const { className } = req.params;
  const { schoolCode, section } = req.query;

  let classParam;

  if (className === 'Nursery') {
    classParam = 'Nursery';
  } else if (className === 'LKG') {
    classParam = 'LKG';
  } else if (className === 'UKG') {
    classParam = 'UKG';
  } else if (className.startsWith('class')) {
    classParam = className.replace('class', '');
  } else {
    classParam = className;
  }

  let sql = `
    SELECT * FROM management_login_creation 
    WHERE user_type = 'student' 
    AND class_name = ?
  `;

  const params = [classParam];

  // ✅ Add section filter if selected
  if (section) {
    sql += ` AND section = ?`;
    params.push(section);
  }

  try {
    const db = await DBConnection(schoolCode);
    const [results] = await db.query(sql, params);

    res.status(200).json({ students: results });

  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------
// Student Transactions: Create / Delete (FeesDetails)
// ------------------------------------------------------
router.post("/studnet-transaction-AddData", async (req, res) => {
  console.log("[studnet-transaction-AddData] body:", req.body);
  const {
    schoolCode,
    StudentName,
    studentName,
    Class_name,
    class_name,
    className,
    section,
    Section,
    sectionName,
    Paid_Amount,
    Admission_paid,
    books_paid,
    uniform_paid,
    exam_paid,
    bus_paid,
    others_paid,
    RES_INST_1,
    Previous_Fee_Due,
    PreviousDue,
    Previous_Paid,
    paidDate,
    paymentMode,
    transaction_id,
    receiptNumber,
  } = req.body || {};

  const finalStudentName = StudentName || studentName || "";
  const finalClassName = Class_name || class_name || className || "";
  const finalSection = section || Section || sectionName || "";
console.log("Received values:", {
  schoolCode,
  StudentName,
  studentName,
  Class_name,
  class_name,
  className,
  section,
  Section,
  sectionName
});
  if (!schoolCode || !finalStudentName || !finalClassName || !finalSection) {
    console.log("[studnet-transaction-AddData] missing fields:", {
      schoolCode,
      finalStudentName,
      finalClassName,
      finalSection,
      raw: { StudentName, studentName, Class_name, class_name, className, section, Section, sectionName },
    });
    return res.status(400).json({
      error: "Missing required fields",
      required: ["schoolCode", "studentName", "class_name", "section"],
      received: {
        schoolCode,
        studentName: finalStudentName,
        class_name: finalClassName,
        section: finalSection,
      },
    });
  }
  console.log("[studnet-transaction-AddData] using values:", {
    schoolCode,
    finalStudentName,
    finalClassName,
    finalSection,
    Paid_Amount,
    Admission_paid,
    books_paid,
    uniform_paid,
    exam_paid,
    bus_paid,
    others_paid,
    RES_INST_1,
    Previous_Fee_Due,
    PreviousDue,
    Previous_Paid,
    paidDate,
    paymentMode,
    transaction_id,
    receiptNumber,
  });

  try {
    console.log("[studnet-transaction-AddData] resolved:", {
      schoolCode,
      finalStudentName,
      finalClassName,
      finalSection,
    });
    const pool = await DBConnection(schoolCode);

    const paidDateValue = paidDate ? new Date(paidDate) : new Date();

    const resolvedPreviousDue = Number(Previous_Fee_Due ?? PreviousDue) || 0;
    const resolvedPreviousPaid = Number(Previous_Paid) || 0;

    const [result] = await pool.execute(
      `INSERT INTO FeesDetails (
        StudentName,
        Class_name,
        section,
        Paid_Amount,
        Admission_paid,
        books_paid,
        uniform_paid,
        exam_paid,
        bus_paid,
        others_paid,
        RES_INST_1,
        Previous_Fee_Due,
        Previous_Paid,
        paidDate,
        paymentMode,
        transaction_id,
        receiptNumber,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        finalStudentName,
        finalClassName,
        finalSection,
        Number(Paid_Amount) || 0,
        Number(Admission_paid) || 0,
        Number(books_paid) || 0,
        Number(uniform_paid) || 0,
        Number(exam_paid) || 0,
        Number(bus_paid) || 0,
        Number(others_paid) || 0,
        Number(RES_INST_1) || 0,
        resolvedPreviousDue,
        resolvedPreviousPaid,
        paidDateValue,
        paymentMode || null,
        transaction_id || null,
        receiptNumber || null,
      ]
    );

    return res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("Failed to create student transaction:", err);
    return res.status(500).json({ error: "Failed to create student transaction" });
  }
});

router.delete("/student-transactions/:id", async (req, res) => {
  const { id } = req.params;
  const { schoolCode: schoolCodeBody } = req.body || {};
  const { schoolCode: schoolCodeQuery } = req.query || {};
  const schoolCode = schoolCodeBody || schoolCodeQuery;

  if (!schoolCode || !id) {
    return res.status(400).json({ error: "Missing schoolCode or id" });
  }

  try {
    const pool = await DBConnection(schoolCode);
    const [result] = await pool.execute(
      `DELETE FROM FeesDetails WHERE id = ?`,
      [id]
    );
    return res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error("Failed to delete student transaction:", err);
    return res.status(500).json({ error: "Failed to delete student transaction" });
  }
});



// Get fee structure for a class (e.g., "class1")


// router.get('/studentsNameAccountant/:className', async (req, res) => {
//   const { className } = req.params;
//   const { schoolCode, section } = req.query;

//   if (!schoolCode) {
//     return res.status(400).json({ error: 'schoolCode is required' });
//   }

//   let classParam;
//   if (className === 'Nursery') classParam = 'Nursery';
//   else if (className.toLowerCase() === 'lkg') classParam = 'LKG';
//   else if (className.toLowerCase() === 'ukg') classParam = 'UKG';
//   else classParam = className;

//   try {
//     const db = await DBConnection(schoolCode);

//     const sql = `
//       SELECT 
//         /* ===== ALL STUDENT DETAILS ===== */
//         m.*,

//         /* ===== PAID BREAKUP ===== */
//         COALESCE(SUM(f.Admission_paid), 0) AS admission_paid,
//         COALESCE(SUM(f.bus_paid), 0) AS bus_paid,
//         COALESCE(SUM(f.books_paid), 0) AS books_paid,
//         COALESCE(SUM(f.uniform_paid), 0) AS uniform_paid,
//         COALESCE(SUM(f.exam_paid), 0) AS exam_paid,
//         COALESCE(SUM(f.others_paid), 0) AS others_paid,

//         /* ===== INSTALLMENTS PAID ===== */
//         COALESCE(SUM(f.Installment1_Paid), 0) AS installment1_paid,
//         COALESCE(SUM(f.Installment2_Paid), 0) AS installment2_paid,
//         COALESCE(SUM(f.Installment3_Paid), 0) AS installment3_paid,
//         COALESCE(SUM(f.Installment4_Paid), 0) AS installment4_paid,
//         COALESCE(SUM(f.Installment5_Paid), 0) AS installment5_paid,

//         /* ===== TOTAL PAID ===== */
//         COALESCE(
//           SUM(
//             f.Admission_paid +
//             f.bus_paid +
//             f.books_paid +
//             f.uniform_paid +
//             f.exam_paid +
//             f.others_paid +
//             f.Installment1_Paid +
//             f.Installment2_Paid +
//             f.Installment3_Paid +
//             f.Installment4_Paid +
//             f.Installment5_Paid
//           ), 0
//         ) AS total_paid

//       FROM management_login_creation m
//       LEFT JOIN FeesDetails f 
//         ON f.login_id = m.id

//       WHERE m.user_type = 'student'
//         AND m.class_name = ?
//         AND m.section = ?

//       GROUP BY m.id
//       ORDER BY m.name ASC
//     `;

//     const [rows] = await db.query(sql, [classParam, section]);

//     res.status(200).json({ students: rows });
//   } catch (err) {
//     console.error('Fetch error:', err);
//     res.status(500).json({ error: err.message });
//   }
// });
// router.get('/studentsNameAccountant/:className', async (req, res) => {
//   const { className } = req.params;
//   const { schoolCode, section } = req.query;

//   if (!schoolCode) {
//     return res.status(400).json({ error: 'schoolCode is required' });
//   }

//   let classParam;
//   if (className === 'Nursery') classParam = 'Nursery';
//   else if (className.toLowerCase() === 'lkg') classParam = 'LKG';
//   else if (className.toLowerCase() === 'ukg') classParam = 'UKG';
//   else classParam = className;

//   try {
//     const db = await DBConnection(schoolCode);

//     const sql = `
//       SELECT 
//         m.*,

//         /* Paid breakup */
//         COALESCE(SUM(f.Admission_paid), 0) AS admission_paid,
//         COALESCE(SUM(f.bus_paid), 0) AS bus_paid,
//         COALESCE(SUM(f.books_paid), 0) AS books_paid,
//         COALESCE(SUM(f.uniform_paid), 0) AS uniform_paid,
//         COALESCE(SUM(f.exam_paid), 0) AS exam_paid,
//         COALESCE(SUM(f.others_paid), 0) AS others_paid,

//         /* Installments: take the sum if >0, else fallback to paid_amount */
//         CASE 
//           WHEN SUM(f.Installment1_Paid) > 0 THEN SUM(f.Installment1_Paid)
//           ELSE MAX(f.paid_amount)
//         END AS installment1_paid,
//         CASE 
//           WHEN SUM(f.Installment2_Paid) > 0 THEN SUM(f.Installment2_Paid)
//           ELSE MAX(f.paid_amount)
//         END AS installment2_paid,
//         CASE 
//           WHEN SUM(f.Installment3_Paid) > 0 THEN SUM(f.Installment3_Paid)
//           ELSE MAX(f.paid_amount)
//         END AS installment3_paid,
//         CASE 
//           WHEN SUM(f.Installment4_Paid) > 0 THEN SUM(f.Installment4_Paid)
//           ELSE MAX(f.paid_amount)
//         END AS installment4_paid,
//         CASE 
//           WHEN SUM(f.Installment5_Paid) > 0 THEN SUM(f.Installment5_Paid)
//           ELSE MAX(f.paid_amount)
//         END AS installment5_paid,

//         /* Total Paid: sum all fees + if all installments are zero, add paid_amount once */
//         COALESCE(
//           SUM(f.Admission_paid + f.bus_paid + f.books_paid + f.uniform_paid + f.exam_paid + f.others_paid) +
//           CASE 
//             WHEN SUM(f.Installment1_Paid + f.Installment2_Paid + f.Installment3_Paid + f.Installment4_Paid + f.Installment5_Paid) > 0
//             THEN SUM(f.Installment1_Paid + f.Installment2_Paid + f.Installment3_Paid + f.Installment4_Paid + f.Installment5_Paid)
//             ELSE MAX(f.paid_amount)
//           END
//         , 0) AS total_paid

//       FROM management_login_creation m

//       LEFT JOIN FeesDetails f 
//         ON f.studentName = m.name
//         AND f.class_name = m.class_name
//         AND f.section = m.section

//       WHERE m.user_type = 'student'
//         AND m.class_name = ?
//         AND m.section = ?

//       GROUP BY m.id
//       ORDER BY m.name ASC
//     `;

//     const [rows] = await db.query(sql, [classParam, section]);
//     res.status(200).json({ students: rows });

//   } catch (err) {
//     console.error('Fetch error:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

router.get('/studentsNameAccountant/:className', async (req, res) => {
  const { className } = req.params;
  const { schoolCode, section } = req.query;

  if (!schoolCode || !section) {
    return res.status(400).json({ error: 'schoolCode and section are required' });
  }

  let classParam;
  if (className === 'Nursery') classParam = 'Nursery';
  else if (className.toLowerCase() === 'lkg') classParam = 'LKG';
  else if (className.toLowerCase() === 'ukg') classParam = 'UKG';
  else classParam = className;

  try {
    const db = await DBConnection(schoolCode);
    const [feeDetailColumns] = await db.query("SHOW COLUMNS FROM FeesDetails");
    const dynamicBaseColumns = (feeDetailColumns || [])
      .map((column) => column?.Field)
      .filter((field) => isDynamicFeeColumn(field));
    const dynamicPaidColumns = dynamicBaseColumns.filter((field) =>
      feeDetailColumns.some((column) => column?.Field === `${field}_paid`)
    );

    const dynamicPaidSelectSql = dynamicPaidColumns
      .map(
        (field) => `COALESCE(SUM(f.\`${field}_paid\`), 0) AS \`${field}_paid\``
      )
      .join(",\n        ");

    const dynamicPaidTotalSql = dynamicPaidColumns.length
      ? dynamicPaidColumns
          .map((field) => `COALESCE(SUM(f.\`${field}_paid\`), 0)`)
          .join(" +\n          ")
      : "0";

    const sql = `
      SELECT 
        m.id,
        m.name,
        m.father_name,
        m.class_name,
        m.section,

        /* ===== Paid breakup ===== */
        COALESCE(SUM(f.Admission_paid), 0) AS admission_paid,
        COALESCE(SUM(f.bus_paid), 0) AS bus_paid,
        COALESCE(SUM(f.books_paid), 0) AS books_paid,
        COALESCE(SUM(f.uniform_paid), 0) AS uniform_paid,
        COALESCE(SUM(f.exam_paid), 0) AS exam_paid,
        COALESCE(SUM(f.others_paid), 0) AS others_paid,
        ${dynamicPaidSelectSql ? `${dynamicPaidSelectSql},` : ""}

        /* ===== Installments ===== */
        COALESCE(SUM(f.Installment1_Paid), 0) AS installment1_paid,
        COALESCE(SUM(f.Installment2_Paid), 0) AS installment2_paid,
        COALESCE(SUM(f.Installment3_Paid), 0) AS installment3_paid,
        COALESCE(SUM(f.Installment4_Paid), 0) AS installment4_paid,
        COALESCE(SUM(f.Installment5_Paid), 0) AS installment5_paid,

        /* ===== Tuition Paid =====
           Add installment totals + direct tuition payments in Paid_Amount. */
        (
          COALESCE(SUM(
            COALESCE(f.Installment1_Paid,0) +
            COALESCE(f.Installment2_Paid,0) +
            COALESCE(f.Installment3_Paid,0) +
            COALESCE(f.Installment4_Paid,0) +
            COALESCE(f.Installment5_Paid,0)
          ), 0)
          +
          COALESCE(SUM(
            CASE
              WHEN COALESCE(f.Installment1_Paid,0) = 0
               AND COALESCE(f.Installment2_Paid,0) = 0
               AND COALESCE(f.Installment3_Paid,0) = 0
               AND COALESCE(f.Installment4_Paid,0) = 0
               AND COALESCE(f.Installment5_Paid,0) = 0
              THEN COALESCE(f.Paid_Amount, f.amount_paid, 0)
              ELSE 0
            END
          ), 0)
        ) AS tuition_paid,

        /* ===== TOTAL PAID ===== */
        (
          COALESCE(SUM(f.Admission_paid),0) +
          COALESCE(SUM(f.bus_paid),0) +
          COALESCE(SUM(f.books_paid),0) +
          COALESCE(SUM(f.uniform_paid),0) +
          COALESCE(SUM(f.exam_paid),0) +
          COALESCE(SUM(f.others_paid),0) +
          (${dynamicPaidTotalSql}) +
          COALESCE(SUM(
            COALESCE(f.Installment1_Paid,0) +
            COALESCE(f.Installment2_Paid,0) +
            COALESCE(f.Installment3_Paid,0) +
            COALESCE(f.Installment4_Paid,0) +
            COALESCE(f.Installment5_Paid,0)
          ), 0) +
          COALESCE(SUM(
            CASE
              WHEN COALESCE(f.Installment1_Paid,0) = 0
               AND COALESCE(f.Installment2_Paid,0) = 0
               AND COALESCE(f.Installment3_Paid,0) = 0
               AND COALESCE(f.Installment4_Paid,0) = 0
               AND COALESCE(f.Installment5_Paid,0) = 0
              THEN COALESCE(f.Paid_Amount, f.amount_paid, 0)
              ELSE 0
            END
          ), 0)
        ) AS total_paid

      FROM management_login_creation m

      LEFT JOIN FeesDetails f 
        ON f.studentName = m.name
        AND f.class_name = m.class_name
        AND f.section = m.section

      WHERE m.user_type = 'student'
        AND m.class_name = ?
        AND m.section = ?

GROUP BY m.id, m.name, m.father_name, m.class_name, m.section      ORDER BY m.name ASC
    `;

    const [rows] = await db.query(sql, [classParam, section]);
    console.log("[studentsNameAccountant] dynamic paid columns", dynamicPaidColumns);

    res.status(200).json({ students: rows });

  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});



router.get('/feeStructure/:className', async (req, res) => {
  const { className } = req.params;
  const { schoolCode } = req.query;

  const classNumber = className.replace(/[^\d]/g, '');

  const sql = `SELECT * FROM FeesDetails WHERE Class_name = ? AND (StudentName IS NULL OR StudentName = '') LIMIT 1`;

  try {
    const db = await DBConnection(schoolCode);
    const [results] = await db.query(sql, [classNumber]);
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found for this class' });
    }

    const feeRow = results[0] || {};
    const dynamicColumns = collectDynamicFeeColumns([feeRow]);
    const completeFee = Number(feeRow.CompleteFee) || 0;
    const staticFeeTotal = [
      "Academic_Fee",
      "Uniform_Fee",
      "Book_Fee",
      "Transport_Fee",
      "Lab_Fee",
      "Miscellaneous_Fee",
      "Hostel_Fee",
      "Mess_Fee",
    ].reduce((sum, key) => sum + (Number(feeRow[key]) || 0), 0);
    const dynamicFeeTotal = dynamicColumns.reduce((sum, key) => sum + (Number(feeRow[key]) || 0), 0);

    const feeStructure = {
      academicFee: Number(feeRow.Academic_Fee) || 0,
      uniformFee: Number(feeRow.Uniform_Fee) || 0,
      bookFee: Number(feeRow.Book_Fee) || 0,
      transportFee: Number(feeRow.Transport_Fee) || 0,
      labFee: Number(feeRow.Lab_Fee) || 0,
      miscellaneousFee: Number(feeRow.Miscellaneous_Fee) || 0,
      hostelFee: Number(feeRow.Hostel_Fee) || 0,
      messFee: Number(feeRow.Mess_Fee) || 0,
      completeFee,
      Tuition_Fee: Number(feeRow.Tuition_Fee) || 0,
      Calculated_Tuition_Fee: Number(feeRow.Calculated_Tuition_Fee) || Math.max(0, completeFee - staticFeeTotal - dynamicFeeTotal),
    };

    dynamicColumns.forEach((column) => {
      feeStructure[column] = Number(feeRow[column]) || 0;
      feeStructure[`${column}_paid`] = Number(feeRow[`${column}_paid`]) || 0;
      feeStructure[`${column}_due`] = Number(feeRow[`${column}_due`]) || 0;
    });

    res.status(200).json({ feeStructure });
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
router.get('/payment/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode' });
  }

  try {
    const db = await DBConnection(schoolCode);
    console.log('[payment] request', { schoolCode, studentId });

    /* STEP 1: Get student details */
    const [studentRows] = await db.query(
      `SELECT 
         id,
         name AS studentName,
         class_name AS className,
         section
       FROM management_login_creation
       WHERE id = ?
       LIMIT 1`,
      [studentId]
    );

    if (!studentRows.length) {
      console.log('[payment] student not found', { schoolCode, studentId });
      return res.status(404).json({ error: 'Student not found' });
    }

    const { studentName, className, section } = studentRows[0];
    console.log('[payment] resolved student', { studentName, className, section, studentId });

    /* STEP 2: Get class-level default fees */
    const [defaultFeeRows] = await db.query(
      `SELECT *
       FROM FeesDetails
       WHERE StudentName IS NULL
         AND class_name = ?
         AND section = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [className, section]
    );

    const df = defaultFeeRows[0] || {};
    console.log('[payment] default fee row keys', Object.keys(df || {}));

    /* STEP 2B: Get Student Fee Rows using login_id first */
    const [studentFeeRows] = await db.query(
      `SELECT *
       FROM FeesDetails
       WHERE login_id = ?
          OR (StudentName = ? AND class_name = ? AND section = ?)
       ORDER BY created_at DESC, id DESC`,
      [studentId, studentName, className, section]
    );

    const studentRow = studentFeeRows[0] || {};
    console.log('[payment] student fee rows', {
      count: studentFeeRows.length,
      firstRowKeys: Object.keys(studentRow || {}),
    });
    const dynamicColumns = collectDynamicFeeColumns([df, ...studentFeeRows]);
    console.log('[payment] dynamic columns', dynamicColumns);

    const busFee = Number(studentRow.Bus_fees || df.Bus_fees || 0) || 0;
    const residentialFeeStudent = Number(studentRow.ResidentialCompleteFee || df.ResidentialCompleteFee || 0) || 0;

    /* STEP 3: Sum all student payments */
    const [sumRows] = await db.query(
      `SELECT
         COALESCE(SUM(books_paid),0) AS bookPaid,
         COALESCE(SUM(bus_paid),0) AS busPaid,
         COALESCE(SUM(uniform_paid),0) AS uniformPaid,
         COALESCE(SUM(exam_paid),0) AS examPaid,
         COALESCE(SUM(others_paid),0) AS othersPaid,
         COALESCE(SUM(Admission_paid),0) AS admissionPaid,
         COALESCE(SUM(RES_INST_1 + RES_INST_2 + RES_INST_3 + RES_INST_4 + RES_INST_5),0) AS residentialPaid,
         COALESCE(SUM(
           COALESCE(Installment1_Paid,0) +
           COALESCE(Installment2_Paid,0) +
           COALESCE(Installment3_Paid,0) +
           COALESCE(Installment4_Paid,0) +
           COALESCE(Installment5_Paid,0)
         ),0) AS tuitionPaid,
         COALESCE(SUM(Paid_Amount),0) AS paidAmountTotal,
         COALESCE(SUM(Discount),0) AS totalDiscount,
         COALESCE(SUM(tuition_discount),0) AS tuitionDiscount,
         COALESCE(SUM(bus_discount),0) AS busDiscount,
         COALESCE(SUM(fee_discount),0) AS feeDiscount,
         COALESCE(SUM(Admission_Discount),0) AS admissionDiscount
       FROM FeesDetails
       WHERE class_name = ?
         AND section = ?
         AND StudentName = ?`,
      [className, section, studentName]
    );

    const sf = sumRows[0] || {};

    /* DEFAULT FEES */
    const completeFee     = Number(df.CompleteFee) || 0;
    const examFee         = Number(df.Exam_fees) || 0;
    const bookFee         = Number(df.Book_Fees) || 0;
    const uniformFee      = Number(df.Uniform_fees) || 0;
    const othersFee       = Number(df.Others) || 0;
    const admissionFee    = Number(df.Admission_fees) || 0;
    const residentialFee  = residentialFeeStudent;
    const dynamicFeeSummary = dynamicColumns.reduce((acc, key) => {
      const defaultTotal = Number(df?.[key] ?? 0) || 0;
      const rowTotals = studentFeeRows.map((row) => Number(row?.[key] ?? 0) || 0);
      const total = Math.max(defaultTotal, ...rowTotals, 0);
      const paid = studentFeeRows.reduce(
        (sum, row) => sum + (Number(row?.[`${key}_paid`] ?? 0) || 0),
        0
      );
      const due = Math.max(total - paid, 0);

      console.log("[payment][dynamicFeeSourceResolution]", {
        studentName,
        className,
        section,
        key,
        classDefaultTotal: defaultTotal,
        studentRowTotals: rowTotals,
        studentRowPaid: studentFeeRows.map((row) => Number(row?.[`${key}_paid`] ?? 0) || 0),
        chosenTotal: total,
        chosenPaid: paid,
        chosenDue: due,
      });

      acc[key] = { total, paid, due };
      return acc;
    }, {});
    console.log('[payment] dynamic fee summary', dynamicFeeSummary);
    const dynamicFeeDueTotal = Object.values(dynamicFeeSummary).reduce((sum, item) => sum + item.due, 0);
    const dynamicFeePaidTotal = Object.values(dynamicFeeSummary).reduce((sum, item) => sum + item.paid, 0);
    const calculatedTuitionFee = Math.max(
      0,
      completeFee -
        (examFee +
          bookFee +
          uniformFee +
          othersFee +
          admissionFee +
          residentialFee +
          Object.values(dynamicFeeSummary).reduce((sum, item) => sum + item.total, 0))
    );

    /* PAID VALUES */
    let tuitionPaid = Number(sf.tuitionPaid) || 0;

    if (tuitionPaid === 0 && Number(sf.paidAmountTotal) > 0) {
      tuitionPaid = Number(sf.paidAmountTotal);
    }

    const examPaid        = Number(sf.examPaid) || 0;
    const busPaid         = Number(sf.busPaid) || 0;
    const bookPaid        = Number(sf.bookPaid) || 0;
    const uniformPaid     = Number(sf.uniformPaid) || 0;
    const othersPaid      = Number(sf.othersPaid) || 0;
    const admissionPaid   = Number(sf.admissionPaid) || 0;
    const residentialPaid = Number(sf.residentialPaid) || 0;
    const totalDiscount   = Number(sf.totalDiscount) || 0;
    const tuitionDiscount = Number(sf.tuitionDiscount) || 0;
    const busDiscount     = Number(sf.busDiscount) || 0;
    const feeDiscount     = Number(sf.feeDiscount) || 0;
    const admissionDiscount = Number(sf.admissionDiscount) || 0;

    /* REMAINING CALCULATIONS */
    const tuitionRemaining   = Math.max(0, calculatedTuitionFee - tuitionPaid);
    const examRemaining      = Math.max(0, examFee - examPaid);
    const busRemaining       = Math.max(0, busFee - busPaid);
    const bookRemaining      = Math.max(0, bookFee - bookPaid);
    const uniformRemaining   = Math.max(0, uniformFee - uniformPaid);
    const othersRemaining    = Math.max(0, othersFee - othersPaid);
    const admissionRemaining = Math.max(0, admissionFee - admissionPaid);
    const residentialRemaining = Math.max(0, residentialFee - residentialPaid);

    const totalRemaining =
      tuitionRemaining +
      examRemaining +
      busRemaining +
      bookRemaining +
      uniformRemaining +
      othersRemaining +
      admissionRemaining +
      residentialRemaining +
      dynamicFeeDueTotal -
      totalDiscount;
    console.log('[payment] computed totals', {
      completeFee,
      calculatedTuitionFee,
      tuitionPaid,
      dynamicFeeDueTotal,
      dynamicFeePaidTotal,
      totalRemaining,
    });

    /* FINAL RESPONSE */
    res.json({
      payments: {
        studentName,
        class: className,
        section,

        completeFee,
        examFee,
        busFee,
        bookFee,
        uniformFee,
        othersFee,
        admissionFee,
        residentialFee,
        Tuition_Fee: Number(df.Tuition_Fee) || calculatedTuitionFee,
        Calculated_Tuition_Fee: calculatedTuitionFee,
        ...dynamicColumns.reduce((acc, key) => {
          const summary = dynamicFeeSummary[key] || { total: 0, paid: 0, due: 0 };
          const total = Number(summary.total) || 0;
          const paid = Number(summary.paid) || 0;
          const due = Number(summary.due) || 0;
          acc[key] = total;
          acc[`${key}_paid`] = paid;
          acc[`${key}_due`] = due;
          return acc;
        }, {}),

        paidAmount: tuitionPaid,
        examPaid,
        busPaid,
        bookPaid,
        uniformPaid,
        othersPaid,
        admissionPaid,
        residentialPaid,

        discounts: {
          totalDiscount,
          tuitionDiscount,
          busDiscount,
          feeDiscount,
          admissionDiscount,
        },
        // Top-level discounts (legacy/front-end access)
        totalDiscount,
        tuitionDiscount,
        busDiscount,
        feeDiscount,
        admissionDiscount,

        tuitionRemaining,
        examRemaining,
        busRemaining,
        bookRemaining,
        uniformRemaining,
        othersRemaining,
        admissionRemaining,
        residentialRemaining,
        dynamicFeeDueTotal,
        dynamicFeePaidTotal,
        totalRemaining
      }
    });
    console.log('[payment] response ready', {
      studentName,
      className,
      section,
      totalRemaining,
      tuitionRemaining,
      dynamicFeeDueTotal,
      dynamicFeePaidTotal,
    });

  } catch (err) {
    console.error('PAYMENT API ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});




router.get('/paymentHistory/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in query parameter' });
  }

  // Helper function to create zero-fee response
  const createZeroFeeResponse = (name = '', cls = '', sec = '') => {
    return {
      studentName: name,
      class: cls,
      section: sec,
      completeFee: 0,
      examFee: 0,
      busFee: 0,
      bookFee: 0,
      uniformFee: 0,
      othersFee: 0,
      admissionFee: 0,
      residentialFee: 0,
      originalCompleteFee: 0,
      originalExamFee: 0,
      originalBusFee: 0,
      originalBookFee: 0,
      originalUniformFee: 0,
      originalOthersFee: 0,
      originalAdmissionFee: 0,
      originalResidentialFee: 0,
      discounts: {
        feeDiscount: 0,
        tuitionDiscount: 0,
        busDiscount: 0,
        appliedTo: '',
        reason: ''
      },
      paidAmount: 0,
      examPaid: 0,
      busPaid: 0,
      bookPaid: 0,
      uniformPaid: 0,
      othersPaid: 0,
      admissionPaid: 0,
      residentialPaid: 0,
      examRemaining: 0,
      busRemaining: 0,
      bookRemaining: 0,
      uniformRemaining: 0,
      othersRemaining: 0,
      admissionRemaining: 0,
      residentialRemaining: 0,
      tuitionRemaining: 0,
      totalRemaining: 0,
      created_at: new Date().toISOString()
    };
  };

  try {
    const db = await DBConnection(schoolCode);

    // Get the student's basic information
    const [studentInfo] = await db.query(
      `SELECT class_name as Class_name, name as StudentName, section
       FROM management_login_creation
       WHERE id = ? AND user_type = 'student' LIMIT 1`,
      [studentId]
    );

    if (studentInfo.length === 0) {
      return res.status(404).json({
        payments: createZeroFeeResponse(),
        error: 'Student not found'
      });
    }

    const studentClass = studentInfo[0].Class_name;
    const studentName = studentInfo[0].StudentName || '';
    const section = studentInfo[0].section || '';

    // Get the default fees for the class
    const [defaultFeesResults] = await db.query(
      `SELECT
         CompleteFee,
         Exam_fees AS examFee,
         Bus_fees AS busFee,
         Book_fees AS bookFee,
         Uniform_fees AS uniformFee,
         Others AS othersFee,
         Admission_fees AS admissionFee,
         ResidentialCompleteFee AS residentialFee
       FROM FeesDetails
       WHERE login_id IS NULL AND Class_name = ? LIMIT 1`,
      [studentClass]
    );

    const defaultFees = defaultFeesResults[0] || {};

    if (Object.keys(defaultFees).length === 0) {
      return res.status(200).json({
        payments: createZeroFeeResponse(studentName, studentClass, section)
      });
    }

    // Get the student's specific payment and discount records, including bus fee
    const [studentPayments] = await db.query(
      `SELECT
         Bus_fees AS studentBusFee,
         Paid_Amount,
         exam_paid,
         bus_paid,
         books_paid,
         uniform_paid,
         others_paid,
         admission_paid,
         fee_type,
         fee_discount,
         tuition_discount,
         bus_discount,
         discount_reason
       FROM FeesDetails
       WHERE login_id = ? LIMIT 1`,
      [studentId]
    );

    const studentRecord = studentPayments[0] || {};

    // Determine the bus fee: use student-specific bus fee if it exists, otherwise use the default
    const finalBusFee = studentRecord.studentBusFee ? parseFloat(studentRecord.studentBusFee) : (defaultFees.busFee || 0);

    // Parse discount amounts from the student's record
    const feeDiscount = parseFloat(studentRecord.fee_discount) || 0;
    const tuitionDiscount = parseFloat(studentRecord.tuition_discount) || 0;
    const busDiscount = parseFloat(studentRecord.bus_discount) || 0;

    // Apply discounts. Only bus fee is based on the student's specific record.
    const completeFee = Math.max(0, (defaultFees.CompleteFee || 0) - tuitionDiscount);
    const examFee = Math.max(0, (defaultFees.examFee || 0) - (studentRecord.fee_type?.includes('Exam Fee') ? feeDiscount : 0));
    const busFee = Math.max(0, finalBusFee - busDiscount); // Use the student-specific bus fee
    const bookFee = Math.max(0, (defaultFees.bookFee || 0) - (studentRecord.fee_type?.includes('Books Fee') ? feeDiscount : 0));
    const uniformFee = Math.max(0, (defaultFees.uniformFee || 0) - (studentRecord.fee_type?.includes('Uniform Fee') ? feeDiscount : 0));
    const othersFee = Math.max(0, (defaultFees.othersFee || 0) - (studentRecord.fee_type?.includes('Others') ? feeDiscount : 0));
    const admissionFee = Math.max(0, (defaultFees.admissionFee || 0) - (studentRecord.fee_type?.includes('Admission Fee') ? feeDiscount : 0));
    const [resFeeRows] = await db.query(
      `SELECT COALESCE(MAX(ResidentialCompleteFee),0) AS residentialFee
       FROM FeesDetails
       WHERE Class_name = ? AND section = ? AND StudentName = ?`,
      [studentClass, section, studentName]
    );
    const residentialFeeRaw = parseFloat(resFeeRows[0]?.residentialFee) || 0;
    const residentialFee = Math.max(0, residentialFeeRaw || (defaultFees.residentialFee || 0));

    // Calculate paid and remaining amounts
    const paidAmount = parseFloat(studentRecord.Paid_Amount) || 0;
    const examPaid = parseFloat(studentRecord.exam_paid) || 0;
    const busPaid = parseFloat(studentRecord.bus_paid) || 0;
    const bookPaid = parseFloat(studentRecord.books_paid) || 0;
    const uniformPaid = parseFloat(studentRecord.uniform_paid) || 0;
    const othersPaid = parseFloat(studentRecord.others_paid) || 0;
    const admissionPaid = parseFloat(studentRecord.admission_paid) || 0;
    const [resPaidRows] = await db.query(
      `SELECT COALESCE(SUM(amount_paid),0) AS residentialPaid
       FROM FeesDetails
       WHERE login_id = ? AND fee_type = 'Residential Fee'`,
      [studentId]
    );
    const residentialPaid = parseFloat(resPaidRows[0]?.residentialPaid) || 0;

    const tuitionRemaining = Math.max(0, completeFee - paidAmount);
    const examRemaining = Math.max(0, examFee - examPaid);
    const busRemaining = Math.max(0, busFee - busPaid);
    const bookRemaining = Math.max(0, bookFee - bookPaid);
    const uniformRemaining = Math.max(0, uniformFee - uniformPaid);
    const othersRemaining = Math.max(0, othersFee - othersPaid);
    const admissionRemaining = Math.max(0, admissionFee - admissionPaid);
    const residentialRemaining = Math.max(0, residentialFee - residentialPaid);

    const totalRemaining = tuitionRemaining + examRemaining + busRemaining + bookRemaining + uniformRemaining + othersRemaining + admissionRemaining + residentialRemaining;

    const payments = {
      // Student details
      studentName: studentName,
      class: studentClass,
      section: section,

      // Fee information (after discounts)
      completeFee: completeFee,
      examFee: examFee,
      busFee: busFee,
      bookFee: bookFee,
      uniformFee: uniformFee,
      othersFee: othersFee,
      admissionFee: admissionFee,
      residentialFee: residentialFee,

      // Original fees (before discounts)
      originalCompleteFee: defaultFees.CompleteFee || 0,
      originalExamFee: defaultFees.examFee || 0,
      originalBusFee: defaultFees.busFee || 0,
      originalBookFee: defaultFees.bookFee || 0,
      originalUniformFee: defaultFees.uniformFee || 0,
      originalOthersFee: defaultFees.othersFee || 0,
      originalAdmissionFee: defaultFees.admissionFee || 0,
      originalResidentialFee: defaultFees.residentialFee || 0,

      // Discount information
      discounts: {
        feeDiscount: feeDiscount,
        tuitionDiscount: tuitionDiscount,
        busDiscount: busDiscount,
        appliedTo: studentRecord.fee_type || '',
        reason: studentRecord.discount_reason || ''
      },
      // Top-level discounts (for legacy/front-end access)
      tuitionDiscount: tuitionDiscount,
      busDiscount: busDiscount,
      feeDiscount: feeDiscount,

      // Payment information
      paidAmount: paidAmount,
      examPaid: examPaid,
      busPaid: busPaid,
      bookPaid: bookPaid,
      uniformPaid: uniformPaid,
      othersPaid: othersPaid,
      admissionPaid: admissionPaid,
      residentialPaid: residentialPaid,

      // Remaining amounts
      tuitionRemaining: tuitionRemaining,
      examRemaining: examRemaining,
      busRemaining: busRemaining,
      bookRemaining: bookRemaining,
      uniformRemaining: uniformRemaining,
      othersRemaining: othersRemaining,
      admissionRemaining: admissionRemaining,
      residentialRemaining: residentialRemaining,

      // Total remaining
      totalRemaining: totalRemaining,

      // Timestamp
      created_at: new Date().toISOString()
    };

    res.status(200).json({ payments });
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({
      error: err.message,
      payments: createZeroFeeResponse()
    });
  }
});
router.post('/rollnumberdata', async (req, res) => {
  const { schoolCode, rollNumber } = req.body;

  if (!schoolCode || !rollNumber) {
    return res.status(400).json({ error: 'Missing schoolCode or rollNumber' });
  }

  try {
    // 1. Connect to the DB for the given schoolCode
    const db = await DBConnection(schoolCode);
    console.log(`🔗 Connected to DB: ${schoolCode}`);

    // 2. Parse rollNumber
    const studentId = parseInt(rollNumber);

    // 3. Get student record
    const [studentRows] = await db.query(
      `SELECT * FROM management_login_creation WHERE id = ?`,
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'No student found with that ID' });
    }

    const student = studentRows[0];
    console.log('🎓 Student Data:');
    console.table(studentRows);

    // 4. Get fee details
    const [feeRows] = await db.query(
      `SELECT * FROM FeesDetails WHERE login_id = ? `,
      [student.id]
    );

    console.log('💰 Fee Details:');
    console.table(feeRows);

    // 5. Get Seller info from same DB using institute_name = schoolCode
    const [sellerRows] = await db.query(
      `SELECT institute_address, institute_contact_number, logo
       FROM Seller
       WHERE institute_name = ?
       LIMIT 1`,
      [schoolCode]
    );

    console.log('🏫 Seller Info:');
    console.table(sellerRows);

    // 6. Final Response
    res.status(200).json({
      studentData: student,
      feeDetails: feeRows,
      sellerInfo: sellerRows.length > 0 ? sellerRows[0] : null
    });

  } catch (err) {
    console.error('❌ Error in /rollnumberdata:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;
