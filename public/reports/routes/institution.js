const express = require("express");
const multer = require("multer");
const mysql = require("mysql2");
const fs = require("fs");
const router = express.Router();

// Set up MySQL connection
const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'NOVA',
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error("Error connecting to the database:", err);
        return;
    }
    console.log("Connected to the database.");
});

// Set up multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
        }
    }
}).single('logo');

// Handle uploading the logo and other institution details
router.post("/insert-institution", upload, (req, res) => {
    const {
        date,
        institute_name,
        institute_gst,
        institute_address,
        institute_contact_number,
        institue_autorized_person,
        number_of_students,
        number_of_staff,
        city_name,
        area_name
    } = req.body;

    if (!req.file) {
        return res.status(400).send("Logo file is required.");
    }

    // Convert the logo buffer to Base64
    const logo = req.file.buffer.toString('base64');  // Convert binary to Base64 string

    // Check if all necessary fields are provided
    if (!date || !institute_name || !institute_gst || !institute_address || !institute_contact_number || 
        !institue_autorized_person || !number_of_students || !number_of_staff || !city_name || !area_name) {
        return res.status(400).send("All fields are required.");
    }

    const query = `
        INSERT INTO institution (
            date, 
            institute_name, 
            institute_gst, 
            institute_address, 
            institute_contact_number, 
            institue_autorized_person, 
            number_of_students, 
            number_of_staff, 
            city_name, 
            area_name, 
            logo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [
        date, 
        institute_name, 
        institute_gst, 
        institute_address, 
        institute_contact_number, 
        institue_autorized_person, 
        number_of_students, 
        number_of_staff, 
        city_name, 
        area_name, 
        logo
    ], (err, result) => {
        if (err) {
            console.error("Error inserting logo:", err);
            return res.status(500).send("Error inserting data into the database.");
        }
        res.status(200).send({ message: "Logo uploaded and institution details inserted successfully!" });
    });
});

// Get the logo of a particular institution by ID
router.get("/get-logo/:institutionId", (req, res) => {
    const institutionId = req.params.institutionId;

    const query = "SELECT logo FROM institution WHERE id = ?";
    db.query(query, [institutionId], (err, results) => {
        if (err) {
            console.error("Error fetching logo:", err);
            return res.status(500).send("Error fetching logo from the database.");
        }

        if (results.length > 0) {
            const logo = results[0].logo;
            res.status(200).send({ logo: `data:image/png;base64,${logo}` });  // Send the logo as a Base64 string
        } else {
            res.status(404).send("Logo not found.");
        }
    });
});
router.get('/institution-details/:id', (req, res) => {
    const institutionId = req.params.id;
  
    const query = `
      SELECT 
        institute_name AS name, 
        institute_address AS address, 
        institute_contact_number AS contact,
        number_of_students,
        number_of_staff
      FROM institution
      WHERE id = ?
    `;
    db.query(query, [institutionId], (err, results) => {
      if (err) {
        console.error('Error fetching institution details:', err.message);
        return res.status(500).json({ error: 'Error fetching institution details' });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ error: 'Institution not found' });
      }
  
      res.json(results[0]);
    });
  });
// Export the router
module.exports = router;
