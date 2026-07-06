const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const path = require('path');
const app = express();

// Middleware
app.use(cors()); // Enable CORS
app.use(bodyParser.json()); // Parse JSON bodies

// Create MySQL connection pool
const db = mysql.createPool({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'NOVA',
});

// Test database connection
db.getConnection((err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to the database.');
    }
});

// Serve the HTML file for root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'fee.html'));
});
app.use(express.static(path.join(__dirname))); // Serve static files from the current directory

// Route to handle fee details upload
router.post('/upload-fee-details', (req, res) => {
    console.log('Received request to upload fee details:', req.body);

    const {
        FeeClass,
        FeeSection,
        CompleteFee,
        UpdatedCompleteFee,
        Installments,
        Class_name,
        section,
        StudentName,
        Paid_Amount,
        Final_Amount
    } = req.body;

    // Validate mandatory fields
    if (!FeeClass || !FeeSection || !CompleteFee || !Installments || Installments.length === 0 || !StudentName || !Paid_Amount || !Final_Amount) {
        console.error('Validation error: Missing required fields');
        return res.status(400).json({ success: false, message: 'Missing required fields: FeeClass, FeeSection, CompleteFee, Installments, StudentName, Paid_Amount, Final_Amount' });
    }

    const values = [];

    // Parse CompleteFee and UpdatedCompleteFee, default to 0 if NaN
    const parsedCompleteFee = parseFloat(CompleteFee) || 0;
    const parsedUpdatedCompleteFee = parseFloat(UpdatedCompleteFee) || 0;

    // Extract installment details or set to null if not provided
    const installment1 = Installments[0] || {};
    const installment2 = Installments[1] || {};
    const installment3 = Installments[2] || {};
    const installment4 = Installments[3] || {};
    const installment5 = Installments[4] || {};

    // Utility function to safely convert date strings
    const toValidDate = (dateString) => {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 19).replace('T', ' ');
    };

    const installment1Amount = parseFloat(installment1.Installment1_Amount || '0');
    const installment1DeadlineDate = toValidDate(installment1.Installment1_Deadline_Date);
    const installment1Fine = parseFloat(installment1.Installment1_Fine || '0');

    const installment2Amount = parseFloat(installment2.Installment2_Amount || '0');
    const installment2DeadlineDate = toValidDate(installment2.Installment2_Deadline_Date);
    const installment2Fine = parseFloat(installment2.Installment2_Fine || '0');

    const installment3Amount = parseFloat(installment3.Installment3_Amount || '0');
    const installment3DeadlineDate = toValidDate(installment3.Installment3_Deadline_Date);
    const installment3Fine = parseFloat(installment3.Installment3_Fine || '0');

    const installment4Amount = parseFloat(installment4.Installment4_Amount || '0');
    const installment4DeadlineDate = toValidDate(installment4.Installment4_Deadline_Date);
    const installment4Fine = parseFloat(installment4.Installment4_Fine || '0');

    const installment5Amount = parseFloat(installment5.Installment5_Amount || '0');
    const installment5DeadlineDate = toValidDate(installment5.Installment5_Deadline_Date);
    const installment5Fine = parseFloat(installment5.Installment5_Fine || '0');

    // Debugging the extracted installment values
    console.log('Installment 1:', installment1Amount, installment1DeadlineDate, installment1Fine);
    console.log('Installment 2:', installment2Amount, installment2DeadlineDate, installment2Fine);
    console.log('Installment 3:', installment3Amount, installment3DeadlineDate, installment3Fine);
    console.log('Installment 4:', installment4Amount, installment4DeadlineDate, installment4Fine);
    console.log('Installment 5:', installment5Amount, installment5DeadlineDate, installment5Fine);

    // Push values into the array
    values.push(
        FeeClass,
        FeeSection,
        parsedCompleteFee,
        parsedUpdatedCompleteFee,
        installment1Amount,
        installment1DeadlineDate,
        installment1Fine,
        installment2Amount,
        installment2DeadlineDate,
        installment2Fine,
        installment3Amount,
        installment3DeadlineDate,
        installment3Fine,
        installment4Amount,
        installment4DeadlineDate,
        installment4Fine,
        installment5Amount,
        installment5DeadlineDate,
        installment5Fine,
        Class_name,
        section,
        StudentName,
        Paid_Amount,
        Final_Amount
    );

    // Ensure we have the correct number of values
    if (values.length !== 24) {
        console.error('Validation error: Values array length does not match column count');
        return res.status(500).json({ success: false, message: 'Mismatch between column count and value count' });
    }

    // Debugging the values before SQL query
    console.log('Prepared Values:', values);

    // Construct the SQL query
    const sql = `
        INSERT INTO FeesDetails (
            FeeClass, FeeSection, CompleteFee, UpdatedCompleteFee,
            Installment1_Amount, Installment1_Deadline_Date, Installment1_Fine,
            Installment2_Amount, Installment2_Deadline_Date, Installment2_Fine,
            Installment3_Amount, Installment3_Deadline_Date, Installment3_Fine,
            Installment4_Amount, Installment4_Deadline_Date, Installment4_Fine,
            Installment5_Amount, Installment5_Deadline_Date, Installment5_Fine,
            Class_name, section, StudentName, Paid_Amount, Final_Amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Debugging SQL query and values
    console.log('SQL Query:', sql);
    console.log('Values:', values);

    db.query(sql, values, (error, results) => {
        if (error) {
            console.error('Error inserting data: ', error);
            return res.status(500).json({ success: false, message: 'Error inserting data', error });
        }
        res.json({ success: true, message: 'Fee details successfully uploaded!', results });
    });
});

// Endpoint to get students by class and section
router.post('/stu', (req, res) => {
    const { className, section } = req.body;
    const sql = 'SELECT * FROM management_login_creation WHERE class_name = ? AND section = ?';

    db.query(sql, [className, section], (error, results) => {
        if (error) return res.status(500).json({ error });
        res.json(results);
    });
});

// Endpoint to record fee payment
router.post('/record-fee-payment', [
    body('className').isString().notEmpty(),
    body('section').isString().notEmpty(),
    body('paidAmount').isNumeric().isFloat({ gt: 0 })
], (req, res) => {
    // Validate request data
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const { className, section, paidAmount } = req.body;

    // Log the incoming request data
    console.log('Received payment request:', req.body);

    // Step 1: Find the studentName from management_login_creation table where userType is 'student'
    const findStudentSql = `
        SELECT name 
        FROM management_login_creation 
        WHERE class_name = ? AND section = ? AND user_type = 'student' 
        LIMIT 1
    `;

    db.query(findStudentSql, [className, section], (error, results) => {
        if (error) {
            console.error('Error fetching student name: ', error);
            return res.status(500).json({ success: false, message: 'Error fetching student name', error });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'No student found for this class and section' });
        }

        const studentName = results[0].name;
        console.log('Student found:', studentName);

        // Step 2: Insert payment data into the fees payment table
        const insertPaymentSql = `
            INSERT INTO fee_payments (class_name, section, student_name, paid_amount) 
            VALUES (?, ?, ?, ?)
        `;

        db.query(insertPaymentSql, [className, section, studentName, paidAmount], (err, result) => {
            if (err) {
                console.error('Error inserting fee payment: ', err);
                return res.status(500).json({ success: false, message: 'Error inserting fee payment', error: err });
            }
            res.json({ success: true, message: 'Fee payment recorded successfully', result });
        });
    });
});
router.get('/getStudents', (req, res) => {
    const { class: className, section } = req.query;
  
    // Query to fetch students from BIZPULSE_ADMISSION_ENTRIES based on class and section
    const query = `
      SELECT id, name FROM bizpulse_admission_entries
      WHERE  class_applied = ? AND section = ?
    `;
    
    db.query(query, [className, section], (error, results) => {
      if (error) {
        console.error('Error fetching students:', error);
        return res.status(500).send('Server Error');
      }
  
      res.json(results); // Send the students data back to the frontend
    });
  });
module.exports = router;
