// server.js (or another relevant file)
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const port = 5000;
const router = express.Router();

// Setup CORS
app.use(cors());

// MySQL connection setup
const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'NOVA',
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database.');
});


router.get('/photos', (req, res) => {
    const query = 'SELECT photo_id, attached_file FROM management_photo_upload';
  
    db.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching images:', err);
        res.status(500).send('Error fetching images');
      } else {
        // Log the results to check the photo data
        console.log(results);
  
        const photos = results.map(photo => {
          // Convert the image to base64 format
          const base64Image = photo.attached_file.toString('base64');
          console.log(base64Image);  // Log base64 data to verify it's valid
          return {
            photo_id: photo.photo_id,
            photo_base64: base64Image
          };
        });
        res.json(photos);  // Send the photos in base64 format
      }
    });
  });
  
  
module.exports = router;
