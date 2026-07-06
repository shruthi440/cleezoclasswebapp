const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const consoleTable = require('console.table');



// 🔧 DB connection helper
function getDBConnection() {
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'NOVA',
  });
}

router.post("/schoolprofile", (req, res) => {
  console.log("\n📥 Received POST request to /schoolprofile");

  const { schoolcode } = req.body;
  console.log("📦 Payload received ➜ schoolcode:", schoolcode);

  if (!schoolcode) {
    console.warn("⚠️ Missing schoolcode in request body");
    return res.status(400).json({ 
      status: false,
      error: "Missing schoolcode" 
    });
  }

  const db = getDBConnection();
  const cleanSchoolcode = schoolcode.replace(/_/g, '');

  db.connect((err) => {
    if (err) {
      console.error(`❌ Failed to connect to NOVA DB:`, err.message);
      return res.status(500).json({ 
        status: false,
        error: "DB connection failed" 
      });
    }

    console.log(`✅ Connected to NOVA database`);
    
    const selectQuery = `
      SELECT 
        id,
        institute_name, 
        institute_address, 
        logo, 
        number_of_students,
        number_of_staff, 
        authorized_logo, 
        date_of_inception, 
        registration_no, 
        institute_authorized_person, 
        pan_no AS "pan/no",
        institute_contact_number,
        city_name,
        area_name
      FROM Seller
      WHERE REPLACE(institute_name, '_', '') = ?
      LIMIT 1
    `;

    console.log(`📡 Fetching seller data matching schoolcode '${cleanSchoolcode}'...`);

    db.query(selectQuery, [cleanSchoolcode], (err2, sellerResults) => {
      db.end();

      if (err2) {
        console.error("❌ Seller fetch failed:", err2.message);
        return res.status(500).json({ 
          status: false,
          error: "Error fetching seller data" 
        });
      }

      console.log(`✅ Retrieved ${sellerResults.length} matching seller(s)`);
      
      // Transform the institute_name for specific cases
      if (sellerResults.length > 0) {
        console.log("🏫 First matching institute:", sellerResults[0].institute_name);
        
        // Always set institute_name to "SREE GEETHANJALI E.M" for this schoolcode
        if (schoolcode.toUpperCase() === "SREE_GEETHANJALI_EM") {
          sellerResults[0].institute_name = "SREE GEETHANJALI E.M";
        }
      }

      res.status(200).json({
        status: true,
        sellerData: sellerResults,
        message: "✅ Seller data fetched successfully",
      });
    });
  });
});

router.post("/update-school-profile", (req, res) => {
  console.log("\n📥 Received POST request to /updateSchoolProfile");

  const { schoolcode, updatedData } = req.body;
  
  if (!schoolcode || !updatedData) {
    console.warn("⚠️ Missing required fields in request body");
    return res.status(400).json({ 
      success: false, 
      message: "Missing required fields (schoolcode or updatedData)" 
    });
  }

  // Create sanitized update object
  const dataToUpdate = {};
  const allowedFields = [
    'institute_name', 'institute_gst', 'institute_address',
    'institute_contact_number', 'institute_authorized_person',
    'number_of_students', 'number_of_staff', 'city_name',
    'area_name', 'premium_type', 'folder_path',
    'date_of_inception', 'registration_no', 'pan_no'
  ];

  // Only include allowed fields and transform field names
  Object.keys(updatedData).forEach(key => {
    // Transform field names if needed
    const dbFieldName = key === 'pan/no' ? 'pan_no' : key;
    
    if (allowedFields.includes(dbFieldName) && updatedData[key] !== undefined) {
      dataToUpdate[dbFieldName] = updatedData[key];
    }
  });

  console.log("📦 Sanitized payload:", dataToUpdate);

  const db = getDBConnection();
  const cleanSchoolcode = schoolcode.replace(/_/g, '');

  db.connect((err) => {
    if (err) {
      console.error(`❌ Failed to connect to NOVA DB:`, err.message);
      return res.status(500).json({ 
        success: false, 
        message: "DB connection failed" 
      });
    }

    console.log(`✅ Connected to NOVA database`);

    const updateQuery = "UPDATE Seller SET ? WHERE REPLACE(institute_name, '_', '') = ?";
    
    console.log(`🔄 Updating school profile for code: ${cleanSchoolcode}`);
    
    db.query(updateQuery, [dataToUpdate, cleanSchoolcode], (error, results) => {
      db.end();
      
      if (error) {
        console.error("❌ Update failed:", error.message);
        return res.status(500).json({ 
          success: false, 
          message: "Database update error: " + error.message 
        });
      }
      
      if (results.affectedRows === 0) {
        console.warn("⚠️ No matching school found for code:", cleanSchoolcode);
        return res.status(404).json({ 
          success: false, 
          message: "No matching school found" 
        });
      }
      
      console.log("✅ Profile updated successfully");
      res.json({ 
        success: true, 
        message: "Profile updated successfully",
        updatedData: dataToUpdate
      });
    });
  });
});

module.exports = router;