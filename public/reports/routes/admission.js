const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mysql = require('mysql2');
const path = require('path');
const router = express.Router();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// ✅ Dynamic DB connection creator
function createDynamicConnection(schoolCode) {
  if (!schoolCode || !/^[a-zA-Z0-9_]+$/.test(schoolCode)) {
    throw new Error('Invalid or missing schoolCode');
  }

  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode,
  });
}

// ✅ POST: /admission
router.post(
  '/admissionprocess',
  upload.fields([
    { name: 'studentPhoto' },
    { name: 'birthCertificate' },
    { name: 'aadharCard' },
    { name: 'tc' },
    { name: 'markSheet' },
  ]),
  (req, res) => {
    const data = req.body;
    const files = req.files;

    console.log('📩 Full req.body:', req.body);
    console.log('📂 Received files:', Object.keys(files || {}));

    const schoolCode = req.body.schoolCode || req.query.schoolCode;
    if (!schoolCode) {
      console.warn('⚠️ schoolCode missing in request');
      return res.status(400).json({ message: 'Missing schoolCode in form data' });
    }

    let db;
    try {
      db = createDynamicConnection(schoolCode);
    } catch (error) {
      console.error('❌ Invalid schoolCode:', error.message);
      return res.status(400).json({ message: error.message });
    }

    db.connect((err) => {
      if (err) {
        console.error('❌ DB connection error:', err.message);
        return res.status(500).json({ message: 'Database connection failed' });
      }

      const insertData = {
        student_name: data.studentName,
        dob: data.dob,
        gender: data.gender,
        blood_group: data.bloodGroup,
        nationality: data.nationality,
        religion: data.religion,
        community: data.community,
        mother_tongue: data.motherTongue,
        aadhar: data.aadhar,
        previous_school: data.previousSchool,
        last_class: data.lastClass,
        applying_for: data.applyingFor,
        student_photo: files?.studentPhoto?.[0]?.filename || null,
        father_name: data.fatherName,
        father_occupation: data.fatherOccupation,
        father_phone: data.fatherPhone,
        mother_name: data.motherName,
        mother_occupation: data.motherOccupation,
        mother_phone: data.motherPhone,
        address: data.address,
        city: data.city,
        state: data.state,
        pin: data.pin,
        email: data.email,
        phone: data.phone,
        birth_certificate: files?.birthCertificate?.[0]?.filename || null,
        aadhar_card: files?.aadharCard?.[0]?.filename || null,
        tc: files?.tc?.[0]?.filename || null,
        mark_sheet: files?.markSheet?.[0]?.filename || null,
        allergies: data.allergies,
        health_issues: data.healthIssues,
        declaration: data.declaration === 'on' || data.declaration === '1' ? 1 : 0,
      };

      console.log('📝 Insert data preview:', insertData);

      const query = `INSERT INTO admission_form SET ?`;
      db.query(query, insertData, (err, result) => {
        db.end();

        if (err) {
          console.error('❌ MySQL insertion error:', err.sqlMessage || err.message);
          return res.status(500).json({ message: 'Database insertion error' });
        }

        console.log('✅ Form inserted with ID:', result.insertId);
        res.json({ message: 'Form submitted successfully' });
      });
    });
  }
);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
module.exports = router;
