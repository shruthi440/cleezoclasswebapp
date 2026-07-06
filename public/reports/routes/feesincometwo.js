const express = require('express');
const mysql = require('mysql2');
const app = express();
const router = express.Router();

app.use(express.json());

// Function to create a MySQL connection based on the database name
const createConnection = (database) => {
  const connection = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: database // Use the provided database name
  });

  // Connect to the MySQL database
  connection.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return;
    }
    console.log('Connected to the database:', database);
  });

  return connection;
};

// Calculate bus fee based on distance
const calculateBusFee = (distance) => {
  if (distance <= 5) return 100; // Less than 5 km
  if (distance <= 10) return 150; // 5 to 10 km
  return 200; // More than 10 km
};

router.post('/income', (req, res) => {
  console.log('Received POST /income request'); // Debug 1: Route entry
  console.log('Request body:', JSON.stringify(req.body, null, 2)); // Debug 2: Full request body

  const {
    income_type,
    class_name,
    class_section,
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
    other_name,
    other_amount,
    other_date,
    schoolCode
  } = req.body;

  console.log('Extracted schoolCode:', schoolCode); // Debug 3: schoolCode value

  if (!schoolCode) {
    console.error('Missing schoolCode in request body. Full body:', req.body); // Debug 4: Missing schoolCode
    return res.status(400).json({ 
      success: false,
      message: 'School Code is required',
      receivedBody: req.body // Include received body for debugging
    });
  }

  try {
    console.log(`Creating connection to database: ${schoolCode}`); // Debug 5: DB connection
    const db = createConnection(schoolCode);

    // Calculate bus fee based on distance
    const busFee = calculateBusFee(distance || 0); // Added fallback for distance
    console.log(`Calculated bus fee: ${busFee} for distance: ${distance}`); // Debug 6: Bus fee calculation

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
        other_name,
        other_amount,
        other_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      class_name || null,
      class_section || null,
      income_type,
      fees_exam || null,
      busFee,
      fees_uniform || null,
      fees_books || null,
      other || null,
      donor_name || null,
      donation_amount || null,
      donation_date || null,
      investor_name || null,
      investment_amount || null,
      investment_date || null,
      other_name || null,
      other_amount || null,
      other_date || null
    ];

    console.log('Executing query with parameters:', params); // Debug 7: Query parameters

    db.query(query, params, (err, result) => {
      if (err) {
        console.error('Database error:', {
          error: err,
          sqlMessage: err.sqlMessage,
          sql: err.sql,
          parameters: params
        }); // Debug 8: Detailed DB error
        return res.status(500).json({ 
          success: false,
          message: 'Error inserting income data',
          error: err.sqlMessage,
          details: {
            query: query,
            parameters: params
          }
        });
      }

      console.log('Insert successful. Result:', result); // Debug 9: Success
      res.status(201).json({ 
        success: true,
        message: `Data added successfully for school: ${schoolCode}!`,
        id: result.insertId,
        schoolCode: schoolCode
      });
    });
  } catch (err) {
    console.error('Unexpected error in /income route:', err); // Debug 10: Catch-all
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});

// router.post('/pay-fee', (req, res) => {
//   console.log("Received Payment Data:", req.body);
//   const { studentName, feeType, className, sectionName, paidAmount, schoolCode } = req.body;

//   // Validate input data
//   if (!studentName || !feeType || !className || !sectionName || !paidAmount || !schoolCode) {
//     console.log("Validation failed: Missing fields");
//     return res.status(400).json({ message: 'Invalid data. All fields are required.' });
//   }

//   const db = createConnection(schoolCode);

//   // Dynamically select the fee column based on the fee type
//   let feeColumn;
//   switch (feeType) {
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

//     const finalAmount = results[0].finalamount;
//     console.log("Fetched final amount:", finalAmount);

//     // Check if the student has already paid for this fee type
//     const checkQuery = 'SELECT * FROM school_income_student WHERE name = ? AND typeofpayment = ? AND class_name = ? AND section = ?';

//     db.query(checkQuery, [studentName, feeType, className, sectionName], (err, results) => {
//       if (err) {
//         console.error("Database error while checking existing payment record:", err);
//         return res.status(500).json({ message: 'Database query failed', error: err });
//       }

//       if (results.length === 0) {
//         // No existing payment record, insert new payment record
//         const insertQuery = `
//           INSERT INTO school_income_student (name, typeofpayment, paidamount, finalamount, class_name, section, created_at)
//           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
//         `;
//         db.query(insertQuery, [studentName, feeType, paidAmount, finalAmount, className, sectionName], (err, insertResults) => {
//           if (err) {
//             console.error("Database error while inserting new payment:", err);
//             return res.status(500).json({ message: 'Failed to insert payment data', error: err });
//           }
//           return res.json({
//             message: `Payment of ${paidAmount} for ${feeType} has been successfully recorded for ${studentName}.`
//           });
//         });
//       } else {
//         // Existing payment record, update the payment amount
//         const paymentRecord = results[0];
//         const newPaidAmount = parseFloat(paymentRecord.paidamount) + parseFloat(paidAmount);

//         if (newPaidAmount > finalAmount) {
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
//           return res.json({
//             message: `Payment of ${paidAmount} for ${feeType} has been successfully updated for ${studentName}.`
//           });
//         });
//       }
//     });
//   });
// });
  router.post('/pay-fee', (req, res) => {
    console.log("Received Payment Data:", req.body);

    const {
      studentName,
      className,
      sectionName,
      schoolCode,
      Discount = 0,
      Paid_Amount = 0
    } = req.body;

    if (!studentName || !className || !sectionName || !schoolCode) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    

    const db = createConnection(schoolCode);

    const feeQuery = `
      SELECT CompleteFee FROM FeesDetails
      WHERE FeeClass = ? AND FeeSection = ?
      LIMIT 1
    `;

    db.query(feeQuery, [className, sectionName], (err, results) => {
      if (err) return res.status(500).json({ message: 'Error fetching fee', error: err });

      if (results.length === 0) {
        return res.status(404).json({ message: 'Fee structure not found for this class/section' });
      }

      const originalFee = parseFloat(results[0].CompleteFee || 0);
      const newDiscount = parseFloat(Discount || 0);
      const newPaidAmount = parseFloat(Paid_Amount || 0);

      const checkQuery = `
        SELECT * FROM FeesDetails
        WHERE StudentName = ? AND Class_name = ? AND section = ?
      `;

      db.query(checkQuery, [studentName, className, sectionName], (err, existing) => {
        if (err) return res.status(500).json({ message: 'Error checking existing record', error: err });

        let totalDiscount = newDiscount;
        let totalPaidAmount = newPaidAmount;

        if (existing.length > 0) {
          const previousDiscount = parseFloat(existing[0].Discount || 0);
          const previousPaid = parseFloat(existing[0].Paid_Amount || 0);
          totalDiscount += previousDiscount;
          totalPaidAmount += previousPaid;
        }

        const finalAmount = originalFee - totalDiscount;

        const installment1 = Math.round(finalAmount * 0.2);
        const installment2 = Math.round(finalAmount * 0.2);
        const installment3 = Math.round(finalAmount * 0.2);
        const installment4 = Math.round(finalAmount * 0.2);
        const installment5 = finalAmount - (installment1 + installment2 + installment3 + installment4);

        if (existing.length === 0) {
          // Insert new record
          const insertQuery = `
            INSERT INTO FeesDetails (
              StudentName, Class_name, section,
              Discount, Final_Amount, Paid_Amount,
              Installment1_Amount, Installment2_Amount,
              Installment3_Amount, Installment4_Amount,
              Installment5_Amount, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `;

          db.query(insertQuery, [
            studentName, className, sectionName,
            totalDiscount, finalAmount, totalPaidAmount,
            installment1, installment2, installment3, installment4, installment5
          ], (err, result) => {
            if (err) return res.status(500).json({ message: 'Insert failed', error: err });

            return res.json({
              message: `Fee record added. Discount: ₹${totalDiscount}, Paid: ₹${totalPaidAmount}, Final Due: ₹${finalAmount - totalPaidAmount}`
            });
          });
        } else {
          // Update existing record
          const updateQuery = `
            UPDATE FeesDetails
            SET Discount = ?, Final_Amount = ?, Paid_Amount = ?,
                Installment1_Amount = ?, Installment2_Amount = ?,
                Installment3_Amount = ?, Installment4_Amount = ?,
                Installment5_Amount = ?, created_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;

          db.query(updateQuery, [
            totalDiscount, finalAmount, totalPaidAmount,
            installment1, installment2, installment3, installment4, installment5,
            existing[0].id
          ], (err, result) => {
            if (err) return res.status(500).json({ message: 'Update failed', error: err });

            // return res.json({
            //   message: `Record updated.  Total Paid: ₹${totalPaidAmount}, Final Due: ₹${finalAmount - totalPaidAmount}`
            // });

            let message = '';

  if (newDiscount > 0 && newPaidAmount > 0) {
    message = `Record updated. Total Discount: ₹${totalDiscount}, Total Paid: ₹${totalPaidAmount}, Final Due: ₹${finalAmount - totalPaidAmount}`;
  } else if (newDiscount > 0) {
    message = `Record updated. Total Discount: ₹${totalDiscount}, Final Due: ₹${finalAmount - totalPaidAmount}`;
  } else {
    message = `Record updated. Total Paid: ₹${totalPaidAmount}, Final Due: ₹${finalAmount - totalPaidAmount}`;
  }

  return res.json({ message });
});
        };
      });
    });





router.get('/get-students', (req, res) => {
  const { className, section, schoolCode } = req.query;

  if (!className || !section || !schoolCode) {
    return res.status(400).json({ success: false, message: 'Class, Section, and School Code are required' });
  }

  const db = createConnection(schoolCode);

  const query = `
    SELECT name, class_name, section
    FROM management_login_creation
    WHERE class_name = ? AND section = ?`;

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


router.get('/student/:name', (req, res) => {
  const studentName = req.params.name;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: 'School Code is required' });
  }

  const db = createConnection(schoolCode);

  const query = 'SELECT * FROM school_income_student WHERE name = ?';

  db.query(query, [studentName], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database query failed', error: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(results);
  });
});



router.get('/total-profit', (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: 'School Code is required' });
  }

  const db = createConnection(schoolCode);

  const query = `
    SELECT SUM(fees_exam + fees_bus + fees_uniform + fees_books) AS total_fees,
           SUM(donation_amount) AS total_donations,
           SUM(investment_amount) AS total_investments,
           SUM(other_amount) AS total_other
    FROM school_income`;

  db.query(query, (err, result) => {
    if (err) {
      console.error('Error calculating total profit:', err);
      return res.status(500).send('Error calculating total profit');
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
});
router.get('/get-students', (req, res) => {
  const { className, section, schoolCode } = req.query;

  if (!className || !section || !schoolCode) {
    return res.status(400).json({ success: false, message: 'Class, Section, and School Code are required' });
  }

  const db = createConnection(schoolCode);

  const query = `
    SELECT name, class_name, section
    FROM management_login_creation
    WHERE class_name = ? AND section = ?`;

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

router.get('/student/:name', (req, res) => {
  const studentName = req.params.name;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: 'School Code is required' });
  }

  const db = createConnection(schoolCode);

  const query = 'SELECT * FROM school_income_student WHERE name = ?';

  db.query(query, [studentName], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database query failed', error: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(results);
  });
});

router.get('/total-profit', (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: 'School Code is required' });
  }

  const db = createConnection(schoolCode);

  const query = `
    SELECT SUM(fees_exam + fees_bus + fees_uniform + fees_books) AS total_fees,
           SUM(donation_amount) AS total_donations,
           SUM(investment_amount) AS total_investments,
           SUM(other_amount) AS total_other
    FROM school_income`;

  db.query(query, (err, result) => {
    if (err) {
      console.error('Error calculating total profit:', err);
      return res.status(500).send('Error calculating total profit');
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