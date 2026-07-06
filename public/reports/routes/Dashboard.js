
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const router = express.Router();
const { Client, LocalAuth } = require("whatsapp-web.js");

const qrcode = require("qrcode");

router.use(cors());
router.use(express.json());

// Sanitize database name
const sanitizeDbName = (name) => {
  return name
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
};

// Dynamic DB connection
async function getDatabaseConnection(schoolCode) {
  try {
    const sanitizedDbName = sanitizeDbName(schoolCode);
    if (!sanitizedDbName || sanitizedDbName.length < 2) {
      throw new Error('Invalid database name after sanitization');
    }

    console.log("🔌 Connecting to dynamic DB:", sanitizedDbName);

    const connection = await mysql.createConnection({
      host: '50.6.194.240',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: sanitizedDbName,
    });

    console.log(`✅ Connected to DB: ${sanitizedDbName}`);
    return connection;
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
    throw err;
  }
}

// Quality DB connection
async function getQualityDatabaseConnection() {
  console.log("🔌 Connecting to Quality DB...");
  const conn = await mysql.createConnection({
    host: '50.6.194.240',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: "Quality",
  });
  console.log("✅ Connected to Quality DB");
  return conn;
}

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Username generator
const generateUsername = (name, mobile_no) => {
  const sanitizeLetters = (str) => (str || "").replace(/[^a-zA-Z]/g, "").toLowerCase();
  const sanitizeDigits = (str) => (str || "").replace(/[^0-9]/g, "");
  const namePart = sanitizeLetters(name).slice(0, 4) || "user";
  const mobilePart = sanitizeDigits(mobile_no).slice(-4) || "0000";
  return namePart + mobilePart;
};

// Password generator
const generatePassword = (name, aadhar_no) => {
  const sanitizeLetters = (str) => (str || "").replace(/[^a-zA-Z]/g, "").toLowerCase();
  const sanitizeDigits = (str) => (str || "").replace(/[^0-9]/g, "");
  const namePart = sanitizeLetters(name).slice(0, 4) || "user";
  const aadharPart = sanitizeDigits(String(aadhar_no)).slice(-4).padStart(4, "0");
  return `${namePart}@${aadharPart}`;
};
// ------------------ POST /submit-form ------------------
router.post("/submit-studentData", async (req, res) => {
  console.log("📥 Incoming request body:", req.body);

  const {
    name,
    gender,
    phone_no,
    aadhar_no,
    father_name,
    father_phone_no,
    class_name,
    section,
    class_teacher,
    school_name,
    address,
    bus_number,
    designation,
    category,       // "student", "teacher", or "management"
    schoolCode,
    dob,
    admission_no,
    cbse_reg_no,
    Curriculum,
    // Teacher-specific fields
    teaches_to_1,
    teaches_to_2,
    teaches_to_3,
    teaches_to_4,
    teaches_to_5,
    teaches_to_6,
    teaches_to_7,
    teaches_to_8,
    teaches_to_9,
    teaches_to_10,
    teaches_to_11,
    teaches_to_12,
  } = req.body;

  if (!name || !category || !schoolCode) {
    console.warn("⚠️ Missing required fields:", { name, category, schoolCode });
    return res.status(400).json({ message: "Name, category, and schoolCode are required" });
  }

  const cleanedPhone = phone_no ? String(phone_no).replace(/\s+/g, "") : null;
  const cleanedFatherPhone = father_phone_no ? String(father_phone_no).replace(/\s+/g, "") : null;
  const cleanedAadhar = aadhar_no ? String(aadhar_no).replace(/\s+/g, "") : null;

  // Decide which phone to use for username
  const phoneToUse = category === "student" ? cleanedFatherPhone : cleanedPhone;

  // Use frontend username/password if provided, otherwise generate
  const username = req.body.username || generateUsername(name, phoneToUse);
  const password = req.body.password || generatePassword(name, cleanedAadhar || phoneToUse);

  console.log("🧹 Cleaned Data:", {
    cleanedPhone,
    cleanedFatherPhone,
    cleanedAadhar,
    phoneToUse,
    username,
    password
  });

  let connection, qualityConnection;
  try {
    // Connect to dynamic DB
    connection = await getDatabaseConnection(schoolCode);
    console.log("✅ Connected to main DB");

    // Connect to Quality DB
    qualityConnection = await getQualityDatabaseConnection();
    console.log("✅ Connected to Quality DB");

    // Check duplicates in main DB
    const [mainMatches] = await connection.query(
      `SELECT id FROM management_login_creation WHERE username = ? AND user_type = ?`,
      [username, category]
    );
    console.log("🔍 Main DB duplicates found:", mainMatches.length);

    // Check duplicates in Quality DB
    const [qualityMatches] = await qualityConnection.query(
      `SELECT id FROM management_login_creation WHERE username = ? AND user_type = ?`,
      [username, category]
    );
    console.log("🔍 Quality DB duplicates found:", qualityMatches.length);

    if (mainMatches.length > 0 || qualityMatches.length > 0) {
      console.warn("🟠 Duplicate record found for:", { name, username });
      return res.status(409).json({ message: "Duplicate record found", name, username });
    }

    // Insert into main DB (match only existing columns)
    let insertQuery = `
      INSERT INTO management_login_creation
      (name, username, password, gender, phone_no, aadhar_no, father_name,
       class_name, section, class_teacher, school_name, address, dob, admission_no,
       cbse_reg_no, schoolCode, Curriculum, designation, user_type, bus_number
    `;

    let insertValues = [
      name,
      username,
      password,
      gender || null,
      cleanedPhone || null,
      cleanedAadhar || null,
      father_name || null,
      class_name || null,
      section || null,
      class_teacher || null,
      school_name || null,
      address || null,
      dob || null,
      admission_no || null,
      cbse_reg_no || null,
      schoolCode,
      Curriculum || null,
      designation || null,
      category,
      bus_number || null
    ];

    // Add teacher-specific fields if user_type is 'teacher'
    if (category === "teacher") {
      insertQuery += `, teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5,
                       teaches_to_6, teaches_to_7, teaches_to_8, teaches_to_9, teaches_to_10,
                       teaches_to_11, teaches_to_12`;
      insertValues.push(
        teaches_to_1 || null,
        teaches_to_2 || null,
        teaches_to_3 || null,
        teaches_to_4 || null,
        teaches_to_5 || null,
        teaches_to_6 || null,
        teaches_to_7 || null,
        teaches_to_8 || null,
        teaches_to_9 || null,
        teaches_to_10 || null,
        teaches_to_11 || null,
        teaches_to_12 || null
      );
    }

    insertQuery += ") VALUES (" + insertValues.map(() => "?").join(", ") + ")";

    const [result] = await connection.query(insertQuery, insertValues);
    console.log("✅ Inserted into main DB with ID:", result.insertId);

    // Insert into Quality DB (only essential info)
    const [qResult] = await qualityConnection.query(
      `INSERT INTO management_login_creation (username, password, user_type, schoolCode) VALUES (?, ?, ?, ?)`,
      [username, password, category, schoolCode]
    );
    console.log("✅ Inserted into Quality DB with ID:", qResult.insertId);

    return res.status(200).json({
      success: true,
      message: "Record inserted successfully",
      data: { name, username, password, category }
    });

  } catch (err) {
    console.error("🔥 Error in /submit-studentData:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Closed main DB connection");
    }
    if (qualityConnection) {
      await qualityConnection.end();
      console.log("🔌 Closed Quality DB connection");
    }
  }
});


router.post("/upload-excel/:category", upload.single("file"), async (req, res) => {
  console.log("📥 Incoming POST request to /upload-excel/:category");
  console.log("🧑 Category:", req.params.category);
  console.log("📄 Request Query:", req.query);
  console.log("📄 Request Body:", req.body);

  const school_code = req.query.schoolCode || req.body.school_code;

  if (!school_code) {
    console.warn("⚠️ Missing school_code in request query or body");
    return res.status(400).json({ message: "School code is required" });
  }

  if (!req.file) {
    console.warn("⚠️ No file uploaded");
    return res.status(400).json({ message: "No file uploaded" });
  }

  let connection, qualityConnection;

  try {
    console.log("🔌 Attempting dynamic DB connection...");
    connection = await getDatabaseConnection(sanitizeDbName(school_code));
    console.log("✅ Connected to dynamic database:", sanitizeDbName(school_code));

    console.log("🔌 Connecting to Quality DB...");
    qualityConnection = await getQualityDatabaseConnection();
    console.log("✅ Connected to Quality DB");

    console.log("📂 Parsing Excel file...");
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    console.log("📊 Sheet name:", sheetName);

    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    console.log(`📊 Total rows parsed from Excel: ${sheetData.length}`);

    if (!sheetData.length) {
      return res.status(400).json({ message: "Excel file is empty" });
    }

    const insertedData = [];
    const duplicates = [];

    for (let row of sheetData) {
      console.log("📋 Raw Row:", row);
row = Object.keys(row).reduce((acc, key) => {
  const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");

  // Map original Excel headers to expected field names
const mappedKey = {
  class: "class_name",
  phone: "phone_no",
  fathername: "father_name",
  teacher_name: "class_teacher",
  designation: "designation",   // ✅ ADD THIS
  fatherphone: "father_phone_no",
}[cleanKey] || cleanKey;


  acc[mappedKey] = row[key];
  return acc;
}, {});


      console.log("🧽 Cleaned Row:", row);

      const {
        name,
        gender,
        phone_no,
        aadhar_no,
        father_name,
        father_phone_no,
        class_name,
        section,
        class_teacher,
        school_name,
        address,
        bus_number,
        designation
      } = row;

      if (!name) continue;
const finalDesignation =
  req.params.category === "teacher" || req.params.category === "management"
    ? designation || req.params.category
    : null;

      const cleanedAadhar = aadhar_no ? String(aadhar_no).replace(/\s+/g, "") : null;
      const cleanedPhone =
  phone_no === undefined || phone_no === null || String(phone_no).trim() === ""
    ? null
    : String(phone_no).replace(/\s+/g, "");

const cleanedFatherPhone =
  father_phone_no === undefined || father_phone_no === null || String(father_phone_no).trim() === ""
    ? null
    : String(father_phone_no).replace(/\s+/g, "");

      const phoneToUse = req.params.category === "student" ? cleanedFatherPhone : cleanedPhone;

      const username = generateUsername(name, phoneToUse);
      const password = generatePassword(name, cleanedAadhar || phoneToUse);

      const [mainMatches] = await connection.query(
        `SELECT * FROM management_login_creation WHERE name = ? AND user_type = ? AND schoolCode = ?`,
        [name, req.params.category, sanitizeDbName(school_code)]
      );

      const isDuplicateInMain = mainMatches.some((existing) => {
        return [
          "name",
          "gender",
          "phone_no",
          "aadhar_no",
          "father_name",
          "father_phone_no",
          "class_name",
          "section",
          "class_teacher",
          "school_name",
          "address",
          "bus_number"
        ].every((field) => String(existing[field] || "").trim() === String(row[field] || "").trim());
      });

      const [qualityMatches] = await qualityConnection.query(
        `SELECT * FROM management_login_creation WHERE username = ? AND password = ? AND user_type = ? AND schoolCode = ?`,
        [username, password, req.params.category, sanitizeDbName(school_code)]
      );

      const isDuplicateInQuality = qualityMatches.length > 0;

      if (isDuplicateInMain || isDuplicateInQuality) {
        console.log("🟠 Skipping duplicate record:", name);
duplicates.push({
  name,
  username,
  phone_no: cleanedPhone || cleanedFatherPhone || "",
  father_name: father_name || ""
});

        continue;
      }

      let insertQuery, insertValues;

      if (req.params.category === "teacher" || req.params.category === "management") {
        insertQuery = `INSERT INTO management_login_creation
          (name, gender, phone_no, aadhar_no, father_name, address,designation, user_type, username, password, teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5, schoolCode)
          VALUES (?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        insertValues = [
          name,
          gender,
          cleanedPhone,
          cleanedAadhar,
          father_name,
          address,
          req.params.category,
          username,
          password,
          req.body.assigned_class_1 || null,
          req.body.assigned_class_2 || null,
          req.body.assigned_class_3 || null,
          req.body.assigned_class_4 || null,
          req.body.assigned_class_5 || null,
          sanitizeDbName(school_code)
        ];
      } else {
  insertQuery = `
  INSERT INTO management_login_creation
  (
    name, gender, phone_no, aadhar_no, father_name, address,
    designation, user_type, username, password,
    teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5,
    schoolCode
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

insertValues = [
  name,
  gender,
  cleanedPhone,
  cleanedAadhar,
  father_name,
  address,
  finalDesignation,            // ✅ designation from Excel
  req.params.category,         // ✅ user_type
  username,
  password,
  req.body.assigned_class_1 || null,
  req.body.assigned_class_2 || null,
  req.body.assigned_class_3 || null,
  req.body.assigned_class_4 || null,
  req.body.assigned_class_5 || null,
  sanitizeDbName(school_code)
];

         
     
      }

      await connection.query(insertQuery, insertValues);
      await qualityConnection.query(
        `INSERT INTO management_login_creation (username, password, user_type, schoolCode) VALUES (?, ?, ?, ?)`,
        [username, password, req.params.category, sanitizeDbName(school_code)]
      );

     insertedData.push({
  Name: name,
  Gender: gender || "",
  Phone: cleanedPhone || "",
  "Father Name": father_name || "",
  Class: class_name || "",
  Username: username,
  Password: password,
  Role: req.params.category,
  WhatsApp: cleanedFatherPhone || ""
});

      console.log("✅ Inserted:", name);
    }

    return res.status(200).json({
      success: true,
      message: "Upload processed",
      insertedRecords: insertedData,
      duplicates
    });

  } catch (error) {
    console.error("🔥 Server error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) await connection.end();
    if (qualityConnection) await qualityConnection.end();
  }
});
// GET API to fetch counts for the tracker and dashboard

router.get("/upload-excel/test", async (req, res) => {
  const schoolCode = req.query.schoolCode || "BLUEBELLS";
  try {
    const connection = await getDatabaseConnection(schoolCode);
    await connection.end();
    res.send(`✅ Connected to DB: ${schoolCode}`);
  } catch (err) {
    res.status(500).json({ error: "DB connect failed", details: err.message });
  }
});

module.exports = router;



