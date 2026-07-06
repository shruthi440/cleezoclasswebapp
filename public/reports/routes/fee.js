const express = require("express");
const mysql = require("mysql2/promise");   // ✅ Use promise-based MySQL
const cors = require("cors");
const bodyParser = require("body-parser");
const router = express.Router();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// ✅ MySQL Connection with Pool
const pool = mysql.createPool({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: "SatyaTech",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(() => console.log("✅ Connected to MySQL database."))
    .catch((err) => console.error("❌ Database connection failed:", err));

// ✅ Get years based on the range
router.get("/years/:from-:to", async (req, res) => {
    const { from, to } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT DISTINCT YEAR(date) AS year
             FROM management_login_creation
             WHERE YEAR(date) BETWEEN ? AND ?
             ORDER BY year ASC;`,
            [from, to]
        );

        const years = rows.map((row) => row.year);
        res.json(years);
    } catch (error) {
        console.error("Error fetching years:", error);
        res.status(500).send("Internal Server Error");
    }
});

// ✅ Get classes for a specific year
// Correct endpoint to use route parameters
router.get("/classes/:from-:to", async (req, res) => {
    const { from, to } = req.params;
  
    try {
      const query = `
        SELECT DISTINCT class_name
        FROM management_login_creation
        WHERE YEAR(date) BETWEEN ? AND ?
        ORDER BY class_name ASC;
      `;
  
      const [rows] = await pool.query(query, [from, to]);
      
      // Send the array directly instead of wrapping it in an object
      const classes = rows.map((row) => row.class_name);
      res.json(classes);
  
    } catch (error) {
      console.error("Error fetching classes:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
// Check if category exists
// // Check if category exists
// router.post("/create-category", async (req, res) => {
//     const { category_name, from_year, to_year } = req.body;

//     if (!category_name || !from_year || !to_year) {
//         return res.status(400).json({ error: "All fields are required" });
//     }

//     try {
//         // Insert the category
//         const [result] = await pool.query(
//             "INSERT INTO categories (category_name, from_year, to_year) VALUES (?, ?, ?)",
//             [category_name, from_year, to_year]
//         );

//         const insertedId = result.insertId;

//         // Retrieve the inserted row immediately
//         const [rows] = await pool.query(
//             "SELECT * FROM categories WHERE id = ?",
//             [insertedId]
//         );

//         res.status(201).json({
//             message: "Category created successfully!",
//             category: rows[0]  // Return the full inserted row
//         });

//     } catch (error) {
//         console.error("Error creating category:", error);
//         res.status(500).json({ error: "Failed to create category" });
//     }
// });

  
  // // Retrieve all categories
  // router.get("/categories", async (req, res) => {
  //   try {
  //     const [categories] = await pool.query(
  //       "SELECT id, category_name, from_year, to_year, created_at FROM categories"
  //     );
  
  //     res.status(200).json(categories);
  //   } catch (error) {
  //     console.error("Error fetching categories:", error);
  //     res.status(500).json({ error: "Failed to retrieve categories" });
  //   }
  // });
  
// 🟢 Get all categories
router.get('/categories', async (req, res) => {
  try {
      const query = 'SELECT * FROM categories ORDER BY id ASC';  // Sort by ID in ascending order
      const [categories] = await pool.query(query);
      res.json(categories);
  } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).send('Internal Server Error');
  }
});



// 🟢 Create a new category
router.post('/create-category', async (req, res) => {
  const { category_name, from_year, to_year } = req.body;

  if (!category_name || !from_year || !to_year) {
      return res.status(400).send('All fields are required');
  }

  try {
      const query = `
          INSERT INTO categories (category_name, from_year, to_year) 
          VALUES (?, ?, ?)
      `;
      const [result] = await pool.query(query, [category_name, from_year, to_year]);

      const newCategory = {
          id: result.insertId,
          category_name,
          from_year,
          to_year,
          created_at: new Date()
      };

      res.status(201).json({ message: 'Category created successfully', category: newCategory });
  } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).send('Failed to create category');
  }
});

// 🟢 Get all fees
router.get('/all', async (req, res) => {
  try {
      const query = `
          SELECT f.id, f.class_name, f.fee_category, f.amount, f.duration, 
                 f.from_year, f.to_year, f.created_at, c.category_name
          FROM fees f
          LEFT JOIN categories c ON f.category_id = c.id
          ORDER BY f.created_at DESC
      `;
      const [fees] = await pool.query(query);
      res.json(fees);
  } catch (error) {
      console.error('Error fetching fees:', error);
      res.status(500).send('Internal Server Error');
  }
});

// 🟢 Insert or Update Fees
router.put('/update', async (req, res) => {
  const { fees, from_year, to_year } = req.body;

  if (!from_year || !to_year || !Array.isArray(fees) || fees.length === 0) {
    return res.status(400).send('Invalid fee data or missing years.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const fee of fees) {
      const { class_name, fee_category, amount } = fee;

      // Check if the fee record exists for the selected years
      const checkQuery = `
        SELECT id FROM fees
        WHERE class_name = ? AND fee_category = ? AND from_year = ? AND to_year = ?
      `;
      
      const [existingFees] = await connection.query(checkQuery, [class_name, fee_category, from_year, to_year]);

      if (existingFees.length > 0) {
        // Update the existing fee for the given years
        const updateQuery = `
          UPDATE fees
          SET amount = ?
          WHERE class_name = ? AND fee_category = ? AND from_year = ? AND to_year = ?
        `;
        await connection.query(updateQuery, [amount, class_name, fee_category, from_year, to_year]);

      } else {
        // Insert new fee record with the selected years
        const insertQuery = `
          INSERT INTO fees (class_name, fee_category, amount, duration, from_year, to_year, category_id)
          VALUES (?, ?, ?, 'Annual', ?, ?, NULL)
        `;
        await connection.query(insertQuery, [class_name, fee_category, amount, from_year, to_year]);
      }
    }

    await connection.commit();
    res.status(200).send('Fees updated successfully');
  
  } catch (error) {
    await connection.rollback();
    console.error('Error updating fees:', error);
    res.status(500).send('Failed to update fees');
  
  } finally {
    connection.release();
  }
});
router.get('/fees', async (req, res) => {
  try {
    const query = `
      SELECT id, class_name, fee_category, amount, from_year, to_year
      FROM fees
      ORDER BY id ASC
    `;

    const [fees] = await pool.query(query);
    res.json(fees);
  } catch (error) {
    console.error('Error fetching fees:', error);
    res.status(500).send('Failed to fetch fees');
  }
});



app.use("/", router);


module.exports = router;
