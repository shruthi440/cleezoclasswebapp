const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const router = express.Router();

// Middleware to handle CORS and JSON requests
app.use(cors());
app.use(express.json());

const dbConfig = {
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'NOVA',
};
app.use(express.static('public'));

// Create a promise-based connection to the MySQL database
let db;
(async () => {
    try {
        db = await mysql.createConnection(dbConfig);  // ✅ Using `db` instead of `connection`
        console.log('Connected to the database');
    } catch (error) {
        console.error('Error connecting to database:', error);
    }
})();

router.get('/getteacher', async (req, res) => {
    const query = `
      SELECT class_name, section, class_teacher
      FROM management_login_creation
      WHERE class_name IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'Nursery')
    `;

    try {
        const [results] = await db.promise().query(query);  // ✅ Using `db.query()` instead of `connection.query()`
        
        if (results.length === 0) {
            return res.status(404).json({ message: 'No class teachers found' });
        }
        
        console.log('Fetched class teacher data:', results);
        res.json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', message: err.message });
    }
});

// Handle 404 errors for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'The requested route does not exist' });
});

module.exports = router;
