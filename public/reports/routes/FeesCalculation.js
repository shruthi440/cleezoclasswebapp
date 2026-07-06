const express = require('express');
const mysql = require('mysql');
const app = express();
const router = express.Router();

// Setup database connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

// Fee details route
router.get('/fee-details', (req, res) => {
  const { className, section } = req.query; // Receive className and section

  console.log(`Received request for fee details with className: ${className} and section: ${section}`);

  // Step 1: Get the number of students for the specified class and section
  const getStudentCountQuery = `SELECT COUNT(*) AS student_count 
                                FROM management_login_creation 
                                WHERE class_name = ? AND section = ? AND user_type = 'student'`;

  console.log('Executing query to count students...');
  db.query(getStudentCountQuery, [className, section], (err, results) => {
    if (err) {
      console.error('Error fetching student data:', err);
      return res.status(500).send('Error fetching student data');
    }

    const studentCount = results[0].student_count;
    console.log(`Found ${studentCount} students for class ${className}, section ${section}`);

    // Step 2: Get fee structure and income details from school_income table
    const getIncomeDetailsQuery = `SELECT * FROM school_income WHERE class_name = ? AND section = ? AND income_type = 'fees'`;

    console.log('Executing query to fetch income details...');
    db.query(getIncomeDetailsQuery, [className, section], (err, incomeResults) => {
      if (err) {
        console.error('Error fetching income details:', err);
        return res.status(500).send('Error fetching income details');
      }

      if (incomeResults.length === 0) {
        console.warn(`No income details found for class: ${className}, section: ${section}`);
        // Return an empty response instead of sending an error
        return res.status(200).send({
          message: `No income details found for class: ${className}, section: ${section}`,
          totalIncome: 0,
          totalFeePerStudent: 0,
          studentCount: 0,
          donations: 0,
          investments: 0,
        });
      }
      

      const incomeDetails = incomeResults[0];
      console.log(`Income details for class ${className}, section ${section}:`, incomeDetails);

      // Step 3: Fetch tuition fees from the FeesDetails table (UpdatedCompleteFee)
      const getTuitionFeesQuery = `SELECT UpdatedCompleteFee FROM FeesDetails WHERE FeeClass = ?`;

      console.log('Executing query to fetch tuition fee from FeesDetails...');
      db.query(getTuitionFeesQuery, [className], (err, tuitionResults) => {
        if (err) {
          console.error('Error fetching tuition fee details:', err);
          return res.status(500).send('Error fetching tuition fee details');
        }

        // Ensure we get the correct tuition fee value from the result
        const tuitionFee = tuitionResults.length > 0 ? tuitionResults[0].UpdatedCompleteFee : 0;
        console.log(`Tuition fee for class ${className}: ${tuitionFee}`);

        // Step 4: Calculate total fee per student (including additional fees)
        const feesExam = incomeDetails.fees_exam || 0;
        const feesBus = incomeDetails.fees_bus || 0;
        const feesUniform = incomeDetails.fees_uniform || 0;
        const feesBooks = incomeDetails.fees_books || 0;
        const donations = incomeDetails.donations || 0;
        const investments = incomeDetails.investments || 0;

        console.log('Calculating total fee per student...');
        // Calculate total fee per student including tuition fees
        const totalFeePerStudent = feesExam + feesBus + feesUniform + feesBooks + tuitionFee;
        console.log(`Total fee per student for class ${className}, section ${section}: ${totalFeePerStudent}`);

        // Step 5: Calculate total income from fees (based on number of students)
        const totalIncomeFromFees = totalFeePerStudent * studentCount;
        console.log(`Total income from fees for ${studentCount} students: ${totalIncomeFromFees}`);

        // Step 6: Calculate total income (fees + donations + investments)
        const totalIncome = totalIncomeFromFees + donations + investments;
        console.log(`Total income (fees + donations + investments) for class ${className}, section ${section}: ${totalIncome}`);

        // Prepare the response object with fee details
        const feeDetails = {
          className,
          section,
          studentCount,
          totalFeePerStudent,
          donations,
          investments,
          totalIncome, // Send total income as part of the response
        };

        console.log('Sending fee details response...');
        res.json(feeDetails); // Send calculated fee details to the frontend
      });
    });
  });
});

module.exports = router;
