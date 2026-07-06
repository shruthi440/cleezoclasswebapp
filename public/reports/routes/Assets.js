const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2');  // Import MySQL library
const router = express.Router();
const app = express();
const PORT = 5000;

// Middleware to parse JSON data and handle form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/'); // Save files in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Use current timestamp as the filename
  }
});

const upload = multer({ storage });

// MySQL database connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',  // Replace with your database username
  password: 'NavyAtagsoLnovA@$000',  // Replace with your database password
  database: 'NOVA',  // Replace with your database name
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// API endpoint to handle form submission
router.post('/assets', upload.single('supportingDocuments'), (req, res) => {
  const {
    category,
    assetType,
    assetCondition,
    usageType,
    purchaseDate,
    warrantyExpiry,
    lastMaintenanceDate,
    nextMaintenanceDue,
    assetName,
    assetCode,
    vendorName,
    purchaseCost,
    currentValue,
    location,
    assignedTo,
    supplierContact,
    comments,
  } = req.body;

  // Check if a file was uploaded
  const supportingDocuments = req.file ? req.file.path : null;

  // SQL query to insert asset data into the database
  const query = `
    INSERT INTO assets (
      assetCode, category, assetType, assetCondition, usageType, purchaseDate, 
      warrantyExpiry, lastMaintenanceDate, nextMaintenanceDue, assetName, 
      vendorName, purchaseCost, currentValue, location, assignedTo, 
      supplierContact, comments, supportingDocuments
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?);
  `;

  // Values for the SQL query
  const values = [
    assetCode, category, assetType, assetCondition, usageType, purchaseDate,
    warrantyExpiry, lastMaintenanceDate, nextMaintenanceDue, assetName,
    vendorName, purchaseCost, currentValue, location, assignedTo,
    supplierContact, comments, supportingDocuments,
  ];

  // Execute the query
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error inserting data into MySQL:', err);
      return res.status(500).json({ message: 'Error saving asset data.' });
    }
    console.log('Asset data saved successfully:', result);
    res.status(201).json({ message: 'Asset data saved successfully!' });
  });
});
// Route to get asset details by assetCode
router.get('/assets/:assetCode', (req, res) => {
  const { assetCode } = req.params;
  const query = 'SELECT assetCode, purchaseCost FROM assets WHERE assetCode = ?';
  db.query(query, [assetCode], (err, results) => {
    if (err) {
      console.error('Error fetching asset data:', err);
      return res.status(500).json({ message: 'Error fetching asset data' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    res.status(200).json(results[0]);
  });
});

// Route to insert depreciation data
router.post('/depreciation', (req, res) => {
  const { assetCode, purchaseCost, usefulLife, depreciationMethod, depreciationValue } = req.body;
  const query = 'INSERT INTO depreciation (assetCode, purchaseCost, usefulLife, depreciationMethod, depreciationValue) VALUES (?, ?, ?, ?, ?)';
  const values = [assetCode, purchaseCost, usefulLife, depreciationMethod, depreciationValue];
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error inserting depreciation data:', err);
      return res.status(500).json({ message: 'Error inserting depreciation data' });
    }
    res.status(201).json({ message: 'Depreciation data saved successfully', result });
  });
});

module.exports = router;

// Make sure to set up your Express app
app.use('/api', router);

