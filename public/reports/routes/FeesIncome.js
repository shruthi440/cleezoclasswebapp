const express = require('express');
const mysql = require('mysql2');
const app = express();
const router = express.Router();

app.use(express.json());

// Create a MySQL connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

// Connect to the MySQL database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

// router.post('/income', (req, res) => {
//   const {
//     income_type,
//     class_name,
//     class_section,  // Ensure this is properly passed
//     distance,
//     fees_exam,
//     fees_bus,
//     fees_uniform,
//     fees_books,
  
//     other,
//     donor_name,
//     donation_amount,
//     donation_date,
//     investor_name,
//     investment_amount,
//     investment_date
//   } = req.body;

//   console.log('Received class_name:', class_name); // Log class_name to confirm it's correct
//   console.log('Received class_section:', class_section); // Log class_section to confirm it's not null
//   const calculateBusFee = (distance) => {
//     if (distance <= 5) return 100; // Less than 5 km
//     if (distance <= 10) return 150; // 5 to 10 km
//     return 200; // More than 10 km
//   };
//   // Continue with the rest of the logic...
//   const busFee = calculateBusFee(distance);
 
//   const query = `
//     INSERT INTO school_income (
//       class_name,
//       class_section,
//       income_type,
//       fees_exam,
//       fees_bus,
//       fees_uniform,
//       fees_books,
     
//       other,
//       donor_name,
//       donation_amount,
//       donation_date,
//       investor_name,
//       investment_amount,
//       investment_date
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?)`;

//   db.query(
//     query,
//     [
//       class_name,
//       class_section,
//       income_type,
//       fees_exam,
//       busFee,
//       fees_uniform,
//       fees_books,
    
//       other,
//       donor_name,
//       donation_amount,
//       donation_date,
//       investor_name,
//       investment_amount,
//       investment_date
//     ],
//     (err, result) => {
//       if (err) {
//         console.error('Error inserting income data:', err);
//         res.status(500).send('Error inserting income data');
//         return;
//       }
//       res.status(201).send({ message: 'Income data added successfully', id: result.insertId });
//     }
//   );
// });
router.post('/income', (req, res) => {
  const {
    income_type,
    class_name,
    class_section, // Ensure this is properly passed
    distance,
    fees_exam,
    fees_bus,
    fees_uniform,
    fees_books,
    other,
    donor_name,
    donation_amount,
    donation_date,
    investor_name,
    investment_amount,
    investment_date,
    other_name,  // Added other_name
    other_amount, // Added other_amount
    other_date   // Added other_date
  } = req.body;

  console.log('Received class_name:', class_name); // Log class_name to confirm it's correct
  console.log('Received class_section:', class_section); // Log class_section to confirm it's not null

  // Calculate bus fee based on distance
  const calculateBusFee = (distance) => {
    if (distance <= 5) return 100; // Less than 5 km
    if (distance <= 10) return 150; // 5 to 10 km
    return 200; // More than 10 km
  };
  
  const busFee = calculateBusFee(distance);

  // SQL query to insert data into the school_income table
  const query = `
    INSERT INTO school_income (
      class_name,
      class_section,
      income_type,
      fees_exam,
      fees_bus,
      fees_uniform,
      fees_books,
      other,
      donor_name,
      donation_amount,
      donation_date,
      investor_name,
      investment_amount,
      investment_date,
      other_name,      -- New field
      other_amount,    -- New field
      other_date       -- New field
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`;

  // Executing the query
  db.query(
    query,
    [
      class_name,
      class_section,
      income_type,
      fees_exam,
      busFee,  // We use the calculated bus fee
      fees_uniform,
      fees_books,
      other,
      donor_name,
      donation_amount,
      donation_date,
      investor_name,
      investment_amount,
      investment_date,
      other_name,  // Add the new field for other_name
      other_amount, // Add the new field for other_amount
      other_date   // Add the new field for other_date
    ],
    (err, result) => {
      if (err) {
        console.error('Error inserting income data:', err);
        res.status(500).send('Error inserting income data');
        return;
      }
      res.status(201).send({ message: 'Income data added successfully', id: result.insertId });
    }
  );
});

router.get('/get-students', (req, res) => {
  const { className, section } = req.query;

  if (!className || !section) {
      return res.status(400).json({ success: false, message: 'Class and Section are required' });
  }

  const query = `
      SELECT name, class_name, section
      FROM management_login_creation
      WHERE class_name = ? AND section = ?;
  `;

  db.query(query, [className, section], (error, results) => {
      if (error) {
          console.error('Database query error:', error);
          return res.status(500).json({ success: false, message: 'Database query failed', error });
      }

      if (results.length === 0) {
          return res.status(404).json({ success: false, message: 'No students found for the selected class and section' });
      }

      res.json({ success: true, students: results });
  });
});

// API Endpoint to fetch student payment details
router.get('/student/:name', (req, res) => {
  const studentName = req.params.name;

  // Query to fetch student payment details from school_income_student table
  const query = 'SELECT * FROM school_income_student WHERE name = ?';

  db.query(query, [studentName], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database query failed', error: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(results);  // Return the student payment records
  });
});

// API Endpoint to handle new fee payment submission (Insert)
// API Endpoint to handle new fee payment submission (Insert)
// // API Endpoint to handle new fee payment submission (Insert)
// router.post('/pay-fee', (req, res) => {
//   console.log("Received Payment Data:", req.body); // Debugging step
//   const { studentName, feeType, amount, className, sectionName } = req.body;

//   // Validate input data
//   if (!studentName || !feeType || !amount || !className || !sectionName) {
//     console.log("Validation failed: Missing fields");
//     return res.status(400).json({ message: 'Invalid data. All fields are required.' });
//   }

//   // Parse the amount and check if it's a valid number
//   const amountValue = parseFloat(amount);
//   if (isNaN(amountValue) || amountValue <= 0) {
//     console.log("Validation failed: Invalid amount value");
//     return res.status(400).json({ message: 'Amount must be a valid number greater than zero.' });
//   }

//   // Dynamically select the fee column based on the fee type
//   let feeColumn;
//   switch(feeType) {
//     case 'exam':
//       feeColumn = 'fees_exam';
//       break;
//     case 'bus':
//       feeColumn = 'fees_bus';
//       break;
//     case 'uniform':
//       feeColumn = 'fees_uniform';
//       break;
//     case 'books':
//       feeColumn = 'fees_books';
//       break;
//     case 'other':
//       feeColumn = 'other';
//       break;
//     default:
//       return res.status(400).json({ message: 'Invalid fee type.' });
//   }

//   // Fetch the fee details for the given class, section, and fee type
//   const feeQuery = `SELECT ${feeColumn} AS finalamount FROM school_income WHERE class_name = ? AND class_section = ?`;

//   db.query(feeQuery, [className, sectionName], (err, results) => {
//     if (err) {
//       console.error("Database error while fetching fee details:", err);
//       return res.status(500).json({ message: 'Failed to fetch fee details', error: err });
//     }

//     if (results.length === 0) {
//       console.log("No fee details found for the class/section/feeType:", className, sectionName, feeType);
//       return res.status(404).json({ message: 'Fee details not found for this class/section/fee type' });
//     }

//     // Extract the final amount from the query result
//     const finalAmount = results[0].finalamount;
//     console.log("Fetched final amount:", finalAmount);

//     // Check if the fee record exists for this student and fee type
//     const checkQuery = 'SELECT * FROM school_income_student WHERE name = ? AND typeofpayment = ? AND class_name = ? AND section = ?';

//     db.query(checkQuery, [studentName, feeType, className, sectionName], (err, results) => {
//       if (err) {
//         console.error("Database error while checking existing payment record:", err);
//         return res.status(500).json({ message: 'Database query failed', error: err });
//       }

//       if (results.length === 0) {
//         console.log("No existing payment record found, inserting new record.");
        
//         const insertQuery = `
//           INSERT INTO school_income_student (name, typeofpayment, paidamount, finalamount, class_name, section, created_at)
//           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
//         `;

//         // Insert the new fee payment record
//         db.query(insertQuery, [studentName, feeType, amountValue, finalAmount, className, sectionName], (err, insertResults) => {
//           if (err) {
//             console.error("Database error while inserting new payment:", err);
//             return res.status(500).json({ message: 'Failed to insert payment data', error: err });
//           }

//           console.log("Payment inserted successfully:", insertResults);
//           return res.json({
//             message: `Payment of ${amountValue} for ${feeType} has been successfully recorded for ${studentName}.`
//           });
//         });
//       } else {
//         console.log("Payment record exists, updating paid amount.");

//         // If a record exists for this student/fee type, update the paid amount
//         const paymentRecord = results[0];
//         const newPaidAmount = parseFloat(paymentRecord.paidamount) + amountValue;

//         if (newPaidAmount > finalAmount) {
//           console.log("Paid amount exceeds the final amount.");
//           return res.status(400).json({ message: 'Paid amount exceeds the final amount.' });
//         }

//         const updateQuery = `
//           UPDATE school_income_student
//           SET paidamount = ?, created_at = CURRENT_TIMESTAMP
//           WHERE id = ?
//         `;

//         db.query(updateQuery, [newPaidAmount, paymentRecord.id], (err, updateResults) => {
//           if (err) {
//             console.error("Database error while updating payment record:", err);
//             return res.status(500).json({ message: 'Payment update failed', error: err });
//           }

//           console.log("Payment updated successfully:", updateResults);
//           return res.json({
//             message: `Payment of ${amountValue} for ${feeType} has been successfully updated for ${studentName}.`
//           });
//         });
//       }
//     });
//   });
// });

router.post('/pay-fee', (req, res) => {
  console.log("Received Payment Data:", req.body); // Debugging step
  const { studentName, feeType, className, sectionName } = req.body;

  // Validate input data
  if (!studentName || !feeType || !className || !sectionName) {
    console.log("Validation failed: Missing fields");
    return res.status(400).json({ message: 'Invalid data. All fields are required.' });
  }

  // Dynamically select the fee column based on the fee type
  let feeColumn;
  switch(feeType) {
    case 'exam':
      feeColumn = 'fees_exam';
      break;
    case 'bus':
      feeColumn = 'fees_bus';
      break;
    case 'uniform':
      feeColumn = 'fees_uniform';
      break;
    case 'books':
      feeColumn = 'fees_books';
      break;
    case 'other':
      feeColumn = 'other';
      break;
    default:
      return res.status(400).json({ message: 'Invalid fee type.' });
  }

  // Fetch the fee details for the given class, section, and fee type
  const feeQuery = `SELECT ${feeColumn} AS finalamount FROM school_income WHERE class_name = ? AND class_section = ?`;

  db.query(feeQuery, [className, sectionName], (err, results) => {
    if (err) {
      console.error("Database error while fetching fee details:", err);
      return res.status(500).json({ message: 'Failed to fetch fee details', error: err });
    }

    if (results.length === 0) {
      console.log("No fee details found for the class/section/feeType:", className, sectionName, feeType);
      return res.status(404).json({ message: 'Fee details not found for this class/section/fee type' });
    }

    // Extract the final amount from the query result
    const finalAmount = results[0].finalamount;
    console.log("Fetched final amount:", finalAmount);

    // Proceed with the payment logic (insert or update)
    // You may need to check if the student has already paid for this fee type or not
    // Insert or update logic follows from the previous code

    // For example:
    const checkQuery = 'SELECT * FROM school_income_student WHERE name = ? AND typeofpayment = ? AND class_name = ? AND section = ?';

    db.query(checkQuery, [studentName, feeType, className, sectionName], (err, results) => {
      if (err) {
        console.error("Database error while checking existing payment record:", err);
        return res.status(500).json({ message: 'Database query failed', error: err });
      }

      if (results.length === 0) {
        // No existing payment record, insert new payment record
        const insertQuery = `
          INSERT INTO school_income_student (name, typeofpayment, paidamount, finalamount, class_name, section, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        db.query(insertQuery, [studentName, feeType, finalAmount, finalAmount, className, sectionName], (err, insertResults) => {
          if (err) {
            console.error("Database error while inserting new payment:", err);
            return res.status(500).json({ message: 'Failed to insert payment data', error: err });
          }
          return res.json({
            message: `Payment of ${finalAmount} for ${feeType} has been successfully recorded for ${studentName}.`
          });
        });
      } else {
        // Existing payment record, update the payment amount
        const paymentRecord = results[0];
        const newPaidAmount = parseFloat(paymentRecord.paidamount) + finalAmount;

        if (newPaidAmount > finalAmount) {
          return res.status(400).json({ message: 'Paid amount exceeds the final amount.' });
        }

        const updateQuery = `
          UPDATE school_income_student
          SET paidamount = ?, created_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        db.query(updateQuery, [newPaidAmount, paymentRecord.id], (err, updateResults) => {
          if (err) {
            console.error("Database error while updating payment record:", err);
            return res.status(500).json({ message: 'Payment update failed', error: err });
          }
          return res.json({
            message: `Payment of ${finalAmount} for ${feeType} has been successfully updated for ${studentName}.`
          });
        });
      }
    });
  });
});


// Endpoint to calculate total profit
router.get('/total-profit', (req, res) => {
  const query = `
    SELECT SUM(fees_exam + fees_bus + fees_uniform + fees_books) AS total_fees,
           SUM(donations) AS total_donations,
           SUM(investments) AS total_investments,
           SUM(other) AS total_other
    FROM school_income`;

  db.query(query, (err, result) => {
    if (err) {
      res.status(500).send('Error calculating total profit');
      return;
    }
    const totalProfit = {
      total_fees: result[0].total_fees || 0,
      total_donations: result[0].total_donations || 0,
      total_investments: result[0].total_investments || 0,
      total_other: result[0].total_other || 0,
      total_profit:
        (result[0].total_fees || 0) +
        (result[0].total_donations || 0) +
        (result[0].total_investments || 0) +
        (result[0].total_other || 0),
    };
    res.status(200).json(totalProfit);
  });
});

module.exports = router;
