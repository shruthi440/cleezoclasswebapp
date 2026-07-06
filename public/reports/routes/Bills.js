
const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const fs = require('fs');
const admin = require("firebase-admin");

const serviceAccount = require('../firebase-service.json'); // 👈 your Firebase Admin SDK file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const router = express.Router();

// Upload folder path setup
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[INFO] Created uploads directory at: ${UPLOAD_DIR}`);
}

// --- DB Connection ---
async function getDatabaseConnection(schoolCode) {
  if (!schoolCode) {
    throw new Error('School code is undefined and required for a database connection.');
  }
  try {
    const connection = await mysql.createConnection({
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: schoolCode
    });
    return connection;
  } catch (error) {
    if (error.code === 'ER_BAD_DB_ERROR') {
      throw new Error(`Database '${schoolCode}' not found.`);
    }
    throw error;
  }
}
// Backend API: Fetch receipts by student name
// Backend API: Fetch receipts by student name
router.get('/bill/allByName/:studentName', async (req, res) => {
  const { studentName } = req.params;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: 'schoolCode is required' });
  }

  let db;
  try {
    // 🔌 Connect to DB using schoolCode
    db = await getDatabaseConnection(schoolCode);

    const query = `
      SELECT *
      FROM bills_uploads
      WHERE studentName = ?
      ORDER BY receiptNumber DESC
    `;

    const [receipts] = await db.execute(query, [studentName]);

    if (receipts.length === 0) {
      return res.status(404).json({ message: 'No receipts found for this student.' });
    }

    res.status(200).json({ receipts });

  } catch (error) {
    console.error('❌ Error fetching receipts:', error.message);
    res.status(500).json({ message: 'Failed to fetch receipts.' });

  } finally {
    // 🔒 Always close DB connection
    if (db) await db.end();
  }
});

// --- Ensure Table and Column Exists ---
async function ensureTableExists(db) {
  const tableName = 'bills_uploads';

  // 1️⃣ Create table if it doesn't exist
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receiptNumber VARCHAR(255) NOT NULL UNIQUE,
      studentName VARCHAR(255),
      class VARCHAR(50),
      section VARCHAR(20),
      image_path VARCHAR(255),
      regn_no INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await db.query(createTableQuery);

  // 2️⃣ Ensure regn_no column exists
  const [regnColumn] = await db.query(`
    SHOW COLUMNS FROM ${tableName} LIKE 'regn_no';
  `);

  if (regnColumn.length === 0) {
    await db.query(`
      ALTER TABLE ${tableName} ADD COLUMN regn_no INT;
    `);
    console.log(`[INFO] Added 'regn_no' column to ${tableName}`);
  }

  // 3️⃣ Ensure created_at column exists
  const [createdAtColumn] = await db.query(`
    SHOW COLUMNS FROM ${tableName} LIKE 'created_at';
  `);

  if (createdAtColumn.length === 0) {
    await db.query(`
      ALTER TABLE ${tableName} 
      ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log(`[INFO] Added 'created_at' column to ${tableName}`);
  }
}

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const receiptNumber = req.body.receiptNumber || 'bill';
    const studentName = req.body.studentName || 'student';
    const uniqueSuffix = Date.now();
    cb(null, `${receiptNumber}-${studentName.replace(/\s+/g, '_')}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });
router.post('/bill/saveimage', upload.single('billImage'), async (req, res) => {
  const {
    receiptNumber,
    studentName,
    class: studentClass,  // Using alias since 'class' is a reserved word
    section,
    regn_no,
    editReason,
    schoolCode  // Now getting from body instead of query
  } = req.body;

  // Add validation for editReason if needed
  if (!editReason) {
    console.warn('[WARNING] Edit reason is empty');
  }
  if (!req.file) {
    console.error('[ERROR] No bill image file was uploaded');
    return res.status(400).json({ error: 'No bill image file was uploaded.' });
  }

  const imagePathForDb = path.join('uploads', req.file.filename).replace(/\\/g, '/');
  const imageUrl = `${req.protocol}://${req.get('host')}/${imagePathForDb}`;
  console.log('[DEBUG] Generated image paths:', { imagePathForDb, imageUrl });

  if (!schoolCode || !receiptNumber) {
    console.error('[ERROR] Missing required fields:', { schoolCode, receiptNumber });
    return res.status(400).json({ error: 'Missing required schoolCode or receiptNumber.' });
  }

  let db;

  try {
    console.log(`[DEBUG] Connecting to database for school code: ${schoolCode}`);
    db = await getDatabaseConnection(schoolCode);
    console.log(`[DEBUG] Successfully connected to database for school code: ${schoolCode}`);

    await ensureTableExists(db);

const sql = `
  INSERT INTO bills_uploads (receiptNumber, studentName, class, section, image_path, regn_no, edit_reason)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    studentName = VALUES(studentName),
    class = VALUES(class),
    section = VALUES(section),
    image_path = VALUES(image_path),
    regn_no = VALUES(regn_no),
    edit_reason = VALUES(edit_reason);
`;

const params = [receiptNumber, studentName, studentClass, section, imagePathForDb, regn_no, editReason];
    console.log('[DEBUG] Executing SQL query:', sql);
    console.log('[DEBUG] With parameters:', params);
    
    await db.query(sql, params);
    console.log('[DEBUG] Bill record successfully saved to database');

    // --- PUSH NOTIFICATION CODE ---
    console.log(`[DEBUG] Starting push notification process for regn_no: ${regn_no}`);
    
    if (regn_no) {
      console.log(`[DEBUG] Step 1: Finding username from management_login_creation with ID: ${regn_no}`);
      const usernameQuery = `SELECT username FROM management_login_creation WHERE id = ?`;
      console.log(`[DEBUG] Executing query: ${usernameQuery}`);
      
      const [usernameRows] = await db.query(usernameQuery, [regn_no]);
      console.log('[DEBUG] Username query results:', usernameRows);

      if (usernameRows.length > 0 && usernameRows[0].username) {
        const username = usernameRows[0].username;
        console.log(`[DEBUG] Step 2: Found username '${username}'. Now finding push token.`);
        
        const tokenQuery = `SELECT push_token FROM user_tokens WHERE username = ?`;
        console.log(`[DEBUG] Executing query: ${tokenQuery}`);
        
        const [tokenRows] = await db.query(tokenQuery, [username]);
        console.log('[DEBUG] Token query results:', tokenRows);

        if (tokenRows.length > 0 && tokenRows[0].push_token) {
          const push_token = tokenRows[0].push_token;
          console.log(`[DEBUG] Found push token: ${push_token}`);
          console.log(`[DEBUG] Image URL to be sent: ${imageUrl}`);

          const message = {
            notification: {
              title: ' Fee Payment Update',
              body: `your payment has been successfully recorded ${studentName}.`,
              image: imageUrl // This should work for Android notifications
            },
            token: push_token,
            data: {
              // Additional data for custom handling
              type: 'new_bill',
              receiptNumber: receiptNumber,
              studentName: studentName,
              imageUrl: imageUrl, // Include in data payload for iOS or custom handling
              click_action: 'FLUTTER_NOTIFICATION_CLICK' // For Flutter apps
            },
            apns: { // For iOS specific settings
              payload: {
                aps: {
                  'mutable-content': 1 // Required for image notifications on iOS
                }
              },
              fcm_options: {
                image: imageUrl
              }
            },
            android: { // For Android specific settings
              notification: {
                image: imageUrl,
                priority: 'high',
                channel_id: 'bill_notifications' // Make sure this matches your Android channel
              }
            },
            webpush: { // For web notifications
              headers: {
                image: imageUrl
              }
            }
          };

          console.log('[DEBUG] Full notification message:', JSON.stringify(message, null, 2));
          
          try {
            console.log('[DEBUG] Attempting to send push notification via Firebase...');
            const response = await admin.messaging().send(message);
            console.log('[DEBUG] Successfully sent push notification:', response);
          } catch (error) {
            console.error('[ERROR] Failed to send push notification:', error);
            console.error('[ERROR] Full error details:', error.message, error.stack);
          }
        } else {
          console.log('[DEBUG] No push token found for username:', username);
        }
      } else {
        console.log('[DEBUG] No username found for regn_no:', regn_no);
      }
    } else {
      console.log('[DEBUG] No regn_no provided, skipping push notification');
    }

    res.status(200).json({
      message: 'Bill record processed successfully!',
      pathStoredInDb: imagePathForDb,
      imageUrl: imageUrl,
      notificationSent: !!regn_no
    });
  } catch (error) {
    console.error(`[ERROR] Database operation failed for school ${schoolCode}:`, error);
    console.error('[ERROR] Stack trace:', error.stack);
    res.status(500).json({
      message: 'Error saving bill to the database.',
      errorDetail: error.message,
      errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (db) {
      console.log('[DEBUG] Closing database connection');
      await db.end();
    }
  }
});
router.post('/bill/save', upload.single('billImage'), async (req, res) => {
  console.log('[DEBUG] /bill/save endpoint hit');
  console.log('[DEBUG] Request body:', req.body);
  console.log('[DEBUG] Uploaded file:', req.file ? req.file : 'No file uploaded');

  const {
    receiptNumber,
    studentName,
    class: studentClass,
    section,
    schoolCode,
    regn_no // This is the ID for the management_login_creation table
  } = req.body;

  if (!req.file) {
    console.error('[ERROR] No bill image file was uploaded');
    return res.status(400).json({ error: 'No bill image file was uploaded.' });
  }

  const imagePathForDb = path.join('uploads', req.file.filename).replace(/\\/g, '/');
  const imageUrl = `${req.protocol}://${req.get('host')}/${imagePathForDb}`;
  console.log('[DEBUG] Generated image paths:', { imagePathForDb, imageUrl });

  if (!schoolCode || !receiptNumber) {
    console.error('[ERROR] Missing required fields:', { schoolCode, receiptNumber });
    return res.status(400).json({ error: 'Missing required schoolCode or receiptNumber.' });
  }

  let db;

  try {
    console.log(`[DEBUG] Connecting to database for school code: ${schoolCode}`);
    db = await getDatabaseConnection(schoolCode);
    console.log(`[DEBUG] Successfully connected to database for school code: ${schoolCode}`);

    await ensureTableExists(db);

    const sql = `
      INSERT INTO bills_uploads (receiptNumber, studentName, class, section, image_path, regn_no)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        studentName = VALUES(studentName),
        class = VALUES(class),
        section = VALUES(section),
        image_path = VALUES(image_path),
        regn_no = VALUES(regn_no);
    `;

    const params = [receiptNumber, studentName, studentClass, section, imagePathForDb, regn_no];
    console.log('[DEBUG] Executing SQL query:', sql);
    console.log('[DEBUG] With parameters:', params);
    
    await db.query(sql, params);
    console.log('[DEBUG] Bill record successfully saved to database');

    // --- PUSH NOTIFICATION CODE ---
    console.log(`[DEBUG] Starting push notification process for regn_no: ${regn_no}`);
    
    if (regn_no) {
      console.log(`[DEBUG] Step 1: Finding username from management_login_creation with ID: ${regn_no}`);
      const usernameQuery = `SELECT username FROM management_login_creation WHERE id = ?`;
      console.log(`[DEBUG] Executing query: ${usernameQuery}`);
      
      const [usernameRows] = await db.query(usernameQuery, [regn_no]);
      console.log('[DEBUG] Username query results:', usernameRows);

      if (usernameRows.length > 0 && usernameRows[0].username) {
        const username = usernameRows[0].username;
        console.log(`[DEBUG] Step 2: Found username '${username}'. Now finding push token.`);
        
        const tokenQuery = `SELECT push_token FROM user_tokens WHERE username = ?`;
        console.log(`[DEBUG] Executing query: ${tokenQuery}`);
        
        const [tokenRows] = await db.query(tokenQuery, [username]);
        console.log('[DEBUG] Token query results:', tokenRows);

        if (tokenRows.length > 0 && tokenRows[0].push_token) {
          const push_token = tokenRows[0].push_token;
          console.log(`[DEBUG] Found push token: ${push_token}`);
          console.log(`[DEBUG] Image URL to be sent: ${imageUrl}`);

          const message = {
            notification: {
              title: ' Fee Payment Update',
              body: `your payment has been successfully recorded ${studentName}.`,
              image: imageUrl // This should work for Android notifications
            },
            token: push_token,
            data: {
              // Additional data for custom handling
              type: 'new_bill',
              receiptNumber: receiptNumber,
              studentName: studentName,
              imageUrl: imageUrl, // Include in data payload for iOS or custom handling
              click_action: 'FLUTTER_NOTIFICATION_CLICK' // For Flutter apps
            },
            apns: { // For iOS specific settings
              payload: {
                aps: {
                  'mutable-content': 1 // Required for image notifications on iOS
                }
              },
              fcm_options: {
                image: imageUrl
              }
            },
            android: { // For Android specific settings
              notification: {
                image: imageUrl,
                priority: 'high',
                channel_id: 'bill_notifications' // Make sure this matches your Android channel
              }
            },
            webpush: { // For web notifications
              headers: {
                image: imageUrl
              }
            }
          };

          console.log('[DEBUG] Full notification message:', JSON.stringify(message, null, 2));
          
          try {
            console.log('[DEBUG] Attempting to send push notification via Firebase...');
            const response = await admin.messaging().send(message);
            console.log('[DEBUG] Successfully sent push notification:', response);
          } catch (error) {
            console.error('[ERROR] Failed to send push notification:', error);
            console.error('[ERROR] Full error details:', error.message, error.stack);
          }
        } else {
          console.log('[DEBUG] No push token found for username:', username);
        }
      } else {
        console.log('[DEBUG] No username found for regn_no:', regn_no);
      }
    } else {
      console.log('[DEBUG] No regn_no provided, skipping push notification');
    }

    res.status(200).json({
      message: 'Bill record processed successfully!',
      pathStoredInDb: imagePathForDb,
      imageUrl: imageUrl,
      notificationSent: !!regn_no
    });
  } catch (error) {
    console.error(`[ERROR] Database operation failed for school ${schoolCode}:`, error);
    console.error('[ERROR] Stack trace:', error.stack);
    res.status(500).json({
      message: 'Error saving bill to the database.',
      errorDetail: error.message,
      errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (db) {
      console.log('[DEBUG] Closing database connection');
      await db.end();
    }
  }
});

// --- NEW ENDPOINT START ---
// This is the new endpoint that your frontend will call to search for a bill.
router.get('/bill/find/:receiptNumber', async (req, res) => {
  // 1. Extract receipt number from URL and schoolCode from query string
  const { receiptNumber } = req.params;
  const { schoolCode } = req.query;

  // 2. Validate that we have the required information
  if (!receiptNumber || !schoolCode) {
    return res.status(400).json({ error: 'Missing required receiptNumber or schoolCode.' });
  }

  let db;
  try {
    // 3. Connect to the correct school's database
    db = await getDatabaseConnection(schoolCode);

    // 4. Prepare and execute the SQL query to find the bill
    const sql = 'SELECT * FROM bills_uploads WHERE receiptNumber = ?';
    const [results] = await db.query(sql, [receiptNumber]);

    // 5. Check if a bill was found
    if (results.length > 0) {
      const foundBill = results[0];
      // 6. If found, send a success response with the bill data and the image path
      res.status(200).json({
        message: 'Bill found successfully.',
        // The frontend expects the full bill object, so we send it.
        // The `foundBill.image_path` will be something like "uploads/123-John_Doe-1678886400000.png"
        bill: foundBill,
        // The frontend also expects a direct `imageUrl` property. We can use the same path.
        imageUrl: `/${foundBill.image_path}`
      });
    } else {
      // 7. If no bill is found, send a 404 Not Found response
      res.status(404).json({ message: 'Bill with the specified receipt number not found.' });
    }
  } catch (error) {
    // 8. Handle any server or database errors
    console.error(`[ERROR] Failed to fetch bill for school ${schoolCode}:`, error);
    res.status(500).json({
      message: 'Failed to retrieve the bill due to a server error.',
      errorDetail: error.message
    });
  } finally {
    // 9. Always make sure to close the database connection
    if (db) await db.end();
  }
});

const mapFeeReceiptRow = (row) => {
  const toNumber = (value) => parseFloat(value || 0) || 0;
  return {
    receiptNumber: row.receiptNumber,
    studentName: row.studentName || '',
    className: row.className || '',
    sectionName: row.sectionName || '',
    regn_no: row.regn_no ? String(row.regn_no) : '',
    paymentMode: row.paymentMode || 'Cash',
    transactionId: row.transactionId || null,
    paymentDate: row.paymentDate || row.created_at || null,
    created_at: row.created_at || null,
    othersDescription: row.othersDescription || '',
    tuitionPaid: toNumber(row.tuitionPaid),
    admissionPaid: toNumber(row.admissionPaid),
    examPaid: toNumber(row.examPaid),
    busPaid: toNumber(row.busPaid),
    bookPaid: toNumber(row.bookPaid),
    uniformPaid: toNumber(row.uniformPaid),
    othersPaid: toNumber(row.othersPaid),
    totalPaid: toNumber(row.totalPaid)
  };
};

// Data-only bill details from FeesDetails (no image dependency)
router.get('/bill/data/:receiptNumber', async (req, res) => {
  const { receiptNumber } = req.params;
  const { schoolCode } = req.query;

  if (!receiptNumber || !schoolCode) {
    return res.status(400).json({ message: 'Missing required receiptNumber or schoolCode.' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);
    const sql = `
      SELECT
        receiptNumber,
        MAX(StudentName) AS studentName,
        MAX(COALESCE(class_name, Class_name)) AS className,
        MAX(COALESCE(section, Section)) AS sectionName,
        MAX(login_id) AS regn_no,
        MAX(paymentMode) AS paymentMode,
        MAX(transaction_id) AS transactionId,
        MAX(COALESCE(paidDate, created_at)) AS paymentDate,
        MAX(created_at) AS created_at,
        MAX(CASE WHEN COALESCE(others_paid, 0) > 0 THEN fee_type END) AS othersDescription,
        SUM(COALESCE(Paid_Amount, 0) + COALESCE(Installment1_Paid, 0) + COALESCE(Installment2_Paid, 0) + COALESCE(Installment3_Paid, 0) + COALESCE(Installment4_Paid, 0) + COALESCE(Installment5_Paid, 0)) AS tuitionPaid,
        SUM(COALESCE(Admission_paid, 0)) AS admissionPaid,
        SUM(COALESCE(exam_paid, 0)) AS examPaid,
        SUM(COALESCE(bus_paid, 0)) AS busPaid,
        SUM(COALESCE(books_paid, 0)) AS bookPaid,
        SUM(COALESCE(uniform_paid, 0)) AS uniformPaid,
        SUM(COALESCE(others_paid, 0)) AS othersPaid,
        SUM(COALESCE(amount_paid, 0)) AS totalPaid
      FROM FeesDetails
      WHERE receiptNumber = ?
      GROUP BY receiptNumber
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [receiptNumber]);
    if (!rows.length) {
      return res.status(404).json({ message: 'No bill found for the specified receipt number.' });
    }
    return res.status(200).json({ bill: mapFeeReceiptRow(rows[0]) });
  } catch (error) {
    console.error('[ERROR] Failed to fetch bill data from FeesDetails:', error);
    return res.status(500).json({ message: 'Failed to fetch bill data.', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// Data-only previous receipts by student name from FeesDetails
router.get('/bill/data/byStudent/:studentName', async (req, res) => {
  const { studentName } = req.params;
  const { schoolCode } = req.query;

  if (!studentName || !schoolCode) {
    return res.status(400).json({ message: 'Missing required studentName or schoolCode.' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);
    const sql = `
      SELECT
        receiptNumber,
        MAX(StudentName) AS studentName,
        MAX(COALESCE(class_name, Class_name)) AS className,
        MAX(COALESCE(section, Section)) AS sectionName,
        MAX(login_id) AS regn_no,
        MAX(paymentMode) AS paymentMode,
        MAX(transaction_id) AS transactionId,
        MAX(COALESCE(paidDate, created_at)) AS paymentDate,
        MAX(created_at) AS created_at,
        MAX(CASE WHEN COALESCE(others_paid, 0) > 0 THEN fee_type END) AS othersDescription,
        SUM(COALESCE(Paid_Amount, 0) + COALESCE(Installment1_Paid, 0) + COALESCE(Installment2_Paid, 0) + COALESCE(Installment3_Paid, 0) + COALESCE(Installment4_Paid, 0) + COALESCE(Installment5_Paid, 0)) AS tuitionPaid,
        SUM(COALESCE(Admission_paid, 0)) AS admissionPaid,
        SUM(COALESCE(exam_paid, 0)) AS examPaid,
        SUM(COALESCE(bus_paid, 0)) AS busPaid,
        SUM(COALESCE(books_paid, 0)) AS bookPaid,
        SUM(COALESCE(uniform_paid, 0)) AS uniformPaid,
        SUM(COALESCE(others_paid, 0)) AS othersPaid,
        SUM(COALESCE(amount_paid, 0)) AS totalPaid
      FROM FeesDetails
      WHERE StudentName = ? AND receiptNumber IS NOT NULL AND receiptNumber <> ''
      GROUP BY receiptNumber
      ORDER BY MAX(COALESCE(paidDate, created_at)) DESC, CAST(receiptNumber AS UNSIGNED) DESC
    `;
    const [rows] = await db.query(sql, [studentName]);
    return res.status(200).json({ receipts: rows.map(mapFeeReceiptRow) });
  } catch (error) {
    console.error('[ERROR] Failed to fetch student bill data from FeesDetails:', error);
    return res.status(500).json({ message: 'Failed to fetch student bill data.', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

router.delete('/bill/delete/:receiptNumber', async (req, res) => {
  console.log('[DEBUG] /bill/delete endpoint hit');

  const { receiptNumber } = req.params;
  const { schoolCode } = req.query;

  if (!receiptNumber || !schoolCode) {
    return res.status(400).json({
      error: 'Missing receiptNumber or schoolCode.'
    });
  }

  let db;

  try {
    console.log(`[DEBUG] Connecting to database for school: ${schoolCode}`);
    db = await getDatabaseConnection(schoolCode);

    await ensureTableExists(db);

    // Step 1: Get image path + regn_no before deleting
    const [rows] = await db.query(
      `SELECT image_path, regn_no, studentName 
       FROM bills_uploads 
       WHERE receiptNumber = ?`,
      [receiptNumber]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Bill not found.'
      });
    }

    const { image_path, regn_no, studentName } = rows[0];

    // Step 2: Delete record from bills_uploads
    await db.query(
      `DELETE FROM bills_uploads WHERE receiptNumber = ?`,
      [receiptNumber]
    );
    console.log('[DEBUG] Bill deleted from bills_uploads');

    // Step 2a: Delete record from FeesDetails with the same receiptNumber
    const [feesRows] = await db.query(
      `DELETE FROM FeesDetails WHERE receiptNumber = ?`,
      [receiptNumber]
    );
    console.log('[DEBUG] Bill deleted from FeesDetails');

    // Step 3: Delete image file from uploads folder
    if (image_path) {
      const fullImagePath = path.join(__dirname, '..', image_path);

      if (fs.existsSync(fullImagePath)) {
        fs.unlinkSync(fullImagePath);
        console.log('[DEBUG] Image file deleted:', fullImagePath);
      }
    }

    // Optional: Send delete notification
    if (regn_no) {
      const [usernameRows] = await db.query(
        `SELECT username FROM management_login_creation WHERE id = ?`,
        [regn_no]
      );

      if (usernameRows.length > 0) {
        const username = usernameRows[0].username;

        const [tokenRows] = await db.query(
          `SELECT push_token FROM user_tokens WHERE username = ?`,
          [username]
        );

        if (tokenRows.length > 0) {
          const push_token = tokenRows[0].push_token;

          const message = {
            notification: {
              title: 'Bill Deleted',
              body: `Your payment receipt ${receiptNumber} has been removed.`,
            },
            token: push_token
          };

          await admin.messaging().send(message);
          console.log('[DEBUG] Delete notification sent');
        }
      }
    }

    res.status(200).json({
      message: 'Bill deleted successfully from all relevant tables.',
      deletedReceiptNumber: receiptNumber
    });

  } catch (error) {
    console.error('[ERROR] Failed to delete bill:', error);

    res.status(500).json({
      message: 'Error deleting bill.',
      error: error.message
    });

  } finally {
    if (db) {
      await db.end();
    }
  }
});
// --- NEW ENDPOINT END ---

// --- Fetch Student Bill History API ---
router.get('/student-bill-history', async (req, res) => {
   const { schoolCode, regn_no } = req.query;

  if (!schoolCode || !regn_no) {
    return res.status(400).json({ error: 'Missing required details. schoolCode and regn_no are required.' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);

    const sql = `
      SELECT
        receiptNumber,
        studentName,
        class,
        section,
        image_path,
        regn_no
      FROM
        bills_uploads
       WHERE
        regn_no = ?
      ORDER BY
        receiptNumber DESC;
    `;

    const [results] = await db.query(sql, [regn_no]);

    res.status(200).json(results);

  } catch (error) {
    console.error(`[ERROR] Failed to fetch bills:`, error);
    res.status(500).json({ message: 'Failed to retrieve bills due to a server or database error.' });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;
