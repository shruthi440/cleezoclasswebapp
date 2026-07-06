const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const path = require('path');
const router = express.Router();

const app = express();

/* =======================
   DATABASE CONNECTION
======================= */
const db = mysql.createPool({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/* =======================
   MIDDLEWARE
======================= */
app.use(cors());
app.use(express.json());

const fs = require('fs');
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Files will be saved in this folder
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalName
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });
/* =======================
   LOGIN API
======================= */
router.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required',
    });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, username, password, institute_name FROM Seller WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = rows[0];

    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password',
      });
    }

    // ✅ SUCCESS RESPONSE
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        institute_name: user.institute_name,
      },
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// GET school details including photos
router.get('/api/school/:instituteName', async (req, res) => {
  const { instituteName } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT * FROM Seller WHERE institute_name = ?',
      [instituteName]
    );

    if (!rows.length) return res.status(404).json({ message: 'School not found' });

    const school = rows[0];
    const baseUrl = 'http://localhost:5000/uploads/'; // adjust if needed

    res.json({
      ...school,
      authorized_logo: school.authorized_logo ? baseUrl + school.authorized_logo : null,
      school_photo: school.school_photo ? baseUrl + school.school_photo : null,
      correspondent: school.correspondent ? baseUrl + school.correspondent : null,
      front_office: school.front_office ? baseUrl + school.front_office : null,
      other_photo: school.other_photo ? baseUrl + school.other_photo : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Fetch failed' });
  }
});



router.put(
  '/api/school/:schoolCode',
  upload.fields([
    { name: 'authorized_logo', maxCount: 1 },
    { name: 'school_photo', maxCount: 1 },
    { name: 'correspondent', maxCount: 1 },
    { name: 'front_office', maxCount: 1 },
    { name: 'other_photo', maxCount: 1 },
  ]),
  async (req, res) => {
    const { schoolCode } = req.params;
    const files = req.files;
    const body = req.body;

    try {
      const [existing] = await db.query('SELECT * FROM Seller WHERE institute_name = ?', [schoolCode]);
      if (!existing.length) return res.status(404).json({ message: 'School not found' });

      const school = existing[0];

      // Access uploaded files or fallback to existing filenames
      const authorized_logo = files.authorized_logo ? files.authorized_logo[0].filename : school.authorized_logo;
      const school_photo   = files.school_photo   ? files.school_photo[0].filename   : school.school_photo;
      const correspondent  = files.correspondent  ? files.correspondent[0].filename  : school.correspondent;
      const front_office   = files.front_office   ? files.front_office[0].filename   : school.front_office;
      const other_photo    = files.other_photo    ? files.other_photo[0].filename    : school.other_photo;

await db.query(
  `UPDATE Seller SET 
      institute_name = ?, curriculum = ?, institute_address = ?, city_name = ?, 
      state = ?, pincode = ?, school_code = ?, number_of_students = ?, 
      number_of_staff = ?, tagline = ?, registration_no = ?,
      authorized_logo = ?, school_photo = ?, correspondent = ?, 
      front_office = ?, other_photo = ?, latitude = ?, longitude = ?,
      radius = ?, use_radius = ?
  WHERE institute_name = ?`,
  [
    body.school_name, body.curriculum, body.address, body.city,
    body.state, body.pincode, body.school_code, body.school_strength,
    body.staff_strength, body.tagline, body.registration_no,
    authorized_logo, school_photo, correspondent, front_office, other_photo,
    body.latitude || school.latitude,
    body.longitude || school.longitude,
    body.radius || school.radius,
    body.use_radius || school.use_radius, // <--- save text directly
    schoolCode
  ]
);


      res.json({ success: true, message: 'Updated successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Update failed' });
    }
  }
);

module.exports = router;
