

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
  }
});

// Database connection function
const getDbConnection = (schoolCode) => {
  return mysql.createConnection({
    host: '119.18.62.140',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode // Use the school code as the database name
  });
};

// Get all classes
router.get('/api/classes', (req, res) => {
  const db = getDbConnection(req.schoolCode);
  const query = 'SELECT DISTINCT class_name FROM management_login_creation WHERE class_name IS NOT NULL';

  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results.map(item => item.class_name));
    db.end();
  });
});

// Get sections by class
router.get('/api/sections/:class', (req, res) => {
  const className = req.params.class;
  const db = getDbConnection(req.schoolCode);
  const query = 'SELECT DISTINCT section FROM management_login_creation WHERE class_name = ? AND section IS NOT NULL';

  db.query(query, [className], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results.map(item => item.section));
    db.end();
  });
});

// Get users by class and section
router.get('/api/users/:class', (req, res) => {
  const className = req.params.class;
  const userType = req.query.user_type || '';
  const section = req.query.section || '';
  const db = getDbConnection(req.schoolCode);

  let query = 'SELECT * FROM management_login_creation WHERE class_name = ?';
  const params = [className];

  if (userType) {
    query += ' AND user_type = ?';
    params.push(userType);
  }

  if (section) {
    query += ' AND section = ?';
    params.push(section);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }

    // Convert binary photo data to base64
    const studentsWithPhotos = results.map(student => {
      if (student.photo) {
        // Convert the binary data to base64
        const base64Photo = student.photo.toString('base64');
        return {
          ...student,
          photo: `data:image/jpeg;base64,${base64Photo}`
        };
      }
      return student;
    });

    res.json(studentsWithPhotos);
    db.end();
  });
});

// Photo upload endpoint
router.post('/api/upload-photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const photoPath = `/uploads/${req.file.filename}`;
  res.json({ photoPath });
});

// Update user
router.put('/api/users/:id', (req, res) => {
  console.log('--- Debug: Incoming PUT request to /api/users/:id ---');
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);

  const userId = req.params.id;
  const { photoPath, dob, ...updatedData } = req.body;
  const db = getDbConnection(req.schoolCode);

  // Log the parsed data
  console.log('User ID:', userId);
  console.log('Photo path:', photoPath);
  console.log('Date of birth (raw):', dob);
  console.log('Updated data (before processing):', updatedData);

  // Validate and format dob if present
  if (dob) {
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      console.error('Invalid date format for dob:', dob);
      return res.status(400).send('Invalid date format for dob');
    }
    updatedData.dob = dobDate.toISOString().split('T')[0];
    console.log('Date of birth (formatted):', updatedData.dob);
  }

  // Update photoPath if provided
  if (photoPath) {
    updatedData.photo = photoPath;
    console.log('Updated photo path:', updatedData.photo);
  }

  const query = 'UPDATE management_login_creation SET ? WHERE id = ?';
  console.log('SQL query:', query);
  console.log('Query params:', [updatedData, userId]);

  db.query(query, [updatedData, userId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Server error');
    }
    console.log('Database result:', result);
    if (result.affectedRows === 0) {
      console.warn('No rows affected. User not found.');
      return res.status(404).send('User not found');
    }
    console.log('User updated successfully');
    res.json({ message: 'User updated successfully' });
  });
});


// Delete user
router.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const db = getDbConnection(req.schoolCode);

  // First get the user to check if they have a photo
  const getQuery = 'SELECT photo FROM management_login_creation WHERE id = ?';
  db.query(getQuery, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    if (results.length === 0) {
      return res.status(404).send('User not found');
    }

    const user = results[0];

    // Delete the user
    const deleteQuery = 'DELETE FROM management_login_creation WHERE id = ?';
    db.query(deleteQuery, [userId], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }

      // If user had a photo, delete it from the filesystem
      if (user.photo) {
        const photoPath = path.join(__dirname, 'public', user.photo);
        fs.unlink(photoPath, (err) => {
          if (err) console.error('Error deleting photo:', err);
        });
      }

      res.json({ message: 'User deleted successfully' });
      db.end();
    });
  });
});

module.exports = router;
