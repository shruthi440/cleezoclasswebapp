require('dotenv').config();
const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true })); // Add this line

// Function to create a school-specific connection
function getDatabaseConnection(schoolCode) {
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode
  });}


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});


router.post('/upload-photo-teacherdata', upload.single('photo'), async (req, res) => {
  console.log('--- Upload Photo Request Received ---');
  
  // Debug: Log all received data
  console.log('Request body fields:', req.body); // Should show schoolCode if properly parsed
  console.log('Request file:', req.file);

  let connection;
  try {
    // Extract schoolCode from form data (now properly accessible via req.body)
    const { schoolCode } = req.body;
    
    if (!schoolCode) {
      console.error('Validation Error: schoolCode is required in form data');
      console.log('Available fields in req.body:', Object.keys(req.body));
      return res.status(400).json({ error: 'schoolCode is required in form data' });
    }


    if (!photoFile) {
      console.error('Validation Error: No photo file uploaded');
      console.log('Multer processing details:');
      console.log('- Fieldname:', req.file ? req.file.fieldname : 'undefined');
      console.log('- Originalname:', req.file ? req.file.originalname : 'undefined');
      console.log('- Encoding:', req.file ? req.file.encoding : 'undefined');
      console.log('- Mimetype:', req.file ? req.file.mimetype : 'undefined');
      console.log('- Size:', req.file ? req.file.size : 'undefined');
      console.log('- Destination:', req.file ? req.file.destination : 'undefined');
      console.log('- Filename:', req.file ? req.file.filename : 'undefined');
      console.log('- Path:', req.file ? req.file.path : 'undefined');
      
      return res.status(400).json({ 
        error: 'No photo file uploaded',
        details: {
          receivedFields: Object.keys(req.body),
          receivedFiles: req.file ? req.file : 'none',
          contentType: req.get('Content-Type'),
          multerError: req.file ? 'none' : 'Multer did not process any file'
        }
      });
    }

    console.log('Reading file from temporary storage:', photoFile.path);
    const photoData = fs.readFileSync(photoFile.path);
    console.log('File read successfully, size:', photoData.length, 'bytes');

    console.log('Attempting database connection for schoolCode:', schoolCode);
    connection = await getDatabaseConnection(schoolCode);
    console.log('Database connection established');

    console.log('Attempting database update for schoolCode:', schoolCode);
    const [result] = await connection.execute(
      `UPDATE management_login_creation 
       SET photo = ? 
       WHERE schoolCode = ?`,
      [photoData, schoolCode]
    );
    console.log('Database update result:', result);

    console.log('Deleting temporary file:', photoFile.path);
    fs.unlinkSync(photoFile.path);
    console.log('Temporary file deleted');

    if (result.affectedRows === 0) {
      console.error('Database Error: No user found with schoolCode:', schoolCode);
      return res.status(404).json({ 
        error: 'User with provided schoolCode not found',
        schoolCode: schoolCode
      });
    }

    console.log('Upload successful for schoolCode:', schoolCode);
    res.json({ 
      success: true,
      message: 'Photo uploaded successfully',
      photoPath: `/photos/${schoolCode}`,
      fileDetails: {
        originalName: photoFile.originalname,
        size: photoFile.size,
        mimetype: photoFile.mimetype,
        encoding: photoFile.encoding
      }
    });

  } catch (error) {
    console.error('!!! UPLOAD ERROR !!!');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request details:', {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      file: req.file
    });

    if (req.file && fs.existsSync(req.file.path)) {
      console.log('Cleaning up temporary file:', req.file.path);
      fs.unlinkSync(req.file.path);
      console.log('Temporary file cleaned up');
    }
    
    res.status(500).json({ 
      error: 'Failed to upload photo', 
      details: error.message,
      internalDetails: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        errorType: error.constructor.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      } : undefined
    });
  } finally {
    // Close the connection in the finally block to ensure it's always closed
    if (connection) {
      try {
        await connection.end();
        console.log('Database connection closed');
      } catch (err) {
        console.error('Error closing database connection:', err);
      }
    }
  }
});






// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      error: 'File upload error',
      details: err.message 
    });
  }
  
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports=router;