const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const consoleTable = require('console.table');

// 🔧 DB connection helper
function getDBConnection(databaseName) {
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: databaseName,
  });
}

// ✅ POST /radius
router.post("/radius", (req, res) => {
  console.log("\n📥 Received POST request to /radius");

  const { radius, schoolcode } = req.body;
  console.log("📦 Payload received ➜ radius:", radius, "schoolcode:", schoolcode);

  if (typeof radius !== "number" || radius < 0) {
    console.warn("⚠️ Invalid radius value:", radius);
    return res.status(400).json({ error: "Invalid radius" });
  }

  if (!schoolcode) {
    console.warn("⚠️ Missing schoolcode in request body");
    return res.status(400).json({ error: "Missing schoolcode" });
  }

  const insertDB = getDBConnection(schoolcode);
  const fetchDB = getDBConnection('NOVA');

  insertDB.connect((err) => {
    if (err) {
      console.error(`❌ Failed to connect to INSERT DB (${schoolcode}):`, err.message);
      return res.status(500).json({ error: "DB connection failed (Insert DB)" });
    }

    console.log(`✅ Connected to INSERT DB: '${schoolcode}'`);

    const insertQuery = "INSERT INTO radius_log (radius) VALUES (?)";
    console.log(`📤 Inserting radius into ${schoolcode}.radius_log...`);

    insertDB.query(insertQuery, [radius], (err, insertResult) => {
      insertDB.end();

      if (err) {
        console.error("❌ Radius insert failed:", err.message);
        return res.status(500).json({ error: "Database insert error" });
      }

      console.log("✅ Radius inserted with ID:", insertResult.insertId);

      fetchDB.connect((err2) => {
        if (err2) {
          console.error("❌ FETCH DB connection failed:", err2.message);
          return res.status(500).json({ error: "DB connection failed (Fetch DB)" });
        }

        console.log("✅ Connected to FETCH DB: 'NOVA'");

        const addressQuery = `
          SELECT institute_address, area_name, city_name
          FROM Seller 
          WHERE REPLACE(institute_name, ' ', '') = ?
        `;

        fetchDB.query(addressQuery, [schoolcode], (err3, result) => {
          fetchDB.end();

          if (err3) {
            console.error("❌ Address fetch failed:", err3.message);
            return res.status(500).json({ error: "Error fetching address" });
          }

          let fullAddress = "Address not found";

          if (result.length > 0) {
            const { institute_address, area_name, city_name } = result[0];
            fullAddress = [institute_address, area_name, city_name, 'India']
              .filter(Boolean)
              .join(', ');
          }

          console.log("✅ Full Address:", fullAddress);

          console.log("\n📊 Summary Table:");
          console.table([{
            Insert_DB: schoolcode,
            Fetch_DB: "NOVA",
            Inserted_Radius: radius,
            Inserted_ID: insertResult.insertId,
            Institute_Address: fullAddress,
          }]);

          res.status(200).json({
            status: true,
            radius,
            address: fullAddress,
            message: "✅ Radius inserted and address fetched successfully",
          });
        });
      });
    });
  });
});

module.exports = router;

// const express = require('express');
// const router = express.Router();
// const mysql = require('mysql2');
// const consoleTable = require('console.table');

// // 🔧 Dynamic DB connector
// function getDBConnection(databaseName) {
//   return mysql.createConnection({
//     host: '162.215.210.38',
//     user: 'root',
//     password: 'NavyAtagsoLnovA@$000',
//     database: databaseName,
//   });
// }

// // ✅ POST /radius
// router.post("/radius", (req, res) => {
//   console.log("\n📥 Received POST request to /radius");

//   const { radius, schoolcode } = req.body;
//   console.log("📦 Payload received ➜ radius:", radius, "schoolcode:", schoolcode);

//   if (typeof radius !== "number" || radius < 0) {
//     console.warn("⚠️ Invalid radius value:", radius);
//     return res.status(400).json({ error: "Invalid radius" });
//   }

//   if (!schoolcode) {
//     console.warn("⚠️ Missing schoolcode in request body");
//     return res.status(400).json({ error: "Missing schoolcode" });
//   }

//   const insertDB = getDBConnection(schoolcode); // e.g., 'CLEEZOCLASS'
//   const fetchDB = getDBConnection('NOVA');

//   // 👉 Connect INSERT DB
//   insertDB.connect((err) => {
//     if (err) {
//       console.error(`❌ Failed to connect to INSERT DB (${schoolcode}):`, err.message);
//       return res.status(500).json({ error: "DB connection failed (Insert DB)" });
//     }

//     console.log(`✅ Connected to INSERT DB: '${schoolcode}'`);

//     const insertQuery = "INSERT INTO radius_log (radius) VALUES (?)";
//     console.log(`📤 Inserting radius into ${schoolcode}.radius_log...`);

//     insertDB.query(insertQuery, [radius], (err, insertResult) => {
//       insertDB.end(); // ✅ Close connection after use

//       if (err) {
//         console.error("❌ Radius insert failed:", err.message);
//         return res.status(500).json({ error: "Database insert error" });
//       }

//       console.log("✅ Radius inserted with ID:", insertResult.insertId);

//       // 👉 Connect FETCH DB (NOVA)
//       fetchDB.connect((err2) => {
//         if (err2) {
//           console.error("❌ FETCH DB connection failed:", err2.message);
//           return res.status(500).json({ error: "DB connection failed (Fetch DB)" });
//         }

//         console.log("✅ Connected to FETCH DB: 'NOVA'");

//         const addressQuery = `
//           SELECT institute_address FROM Seller
//           WHERE REPLACE(institute_name, ' ', '') = ?
//         `;

//         fetchDB.query(addressQuery, [schoolcode], (err3, addressResult) => {
//           fetchDB.end(); // ✅ Close connection after use

//           if (err3) {
//             console.error("❌ Address fetch failed:", err3.message);
//             return res.status(500).json({ error: "Error fetching address" });
//           }

//           const address = addressResult.length
//             ? addressResult[0].institute_address
//             : "Address not found";

//           console.log("✅ Address fetched:", address);

//           // 📊 Console summary
//           console.log("\n📊 Summary Table:");
//           console.table([
//             {
//               Insert_DB: schoolcode,
//               Fetch_DB: "NOVA",
//               Inserted_Radius: radius,
//               Inserted_ID: insertResult.insertId,
//               Institute_Address: address,
//             }
//           ]);

//           res.status(200).json({
//             status: true,
//             radius,
//             address,
//             message: "✅ Radius inserted and address fetched successfully",
//           });
//         });
//       });
//     });
//   });
// });

// module.exports = router;


















// const express = require('express');
// const router = express.Router();
// const mysql = require('mysql2');
// const consoleTable = require('console.table');

// // ✅ Create 2 separate connections
// const insertDB = mysql.createConnection({
//   host: '162.215.210.38',
//   user: 'root',
//   password: 'NavyAtagsoLnovA@$000',
//   database: 'CLEEZOCLASS', // INSERT DB
// });

// const fetchDB = mysql.createConnection({
//   host: '162.215.210.38',
//   user: 'root',
//   password: 'NavyAtagsoLnovA@$000',
//   database: 'NOVA', // FETCH DB
// });

// // ✅ Connect to INSERT DB
// insertDB.connect((err) => {
//   if (err) {
//     console.error("❌ INSERT DB Connection Failed (CLEEZOCLASS):", err.message);
//   } else {
//     console.log("✅ Connected to INSERT DB: 'CLEEZOCLASS'");
//   }
// });

// // ✅ Connect to FETCH DB
// fetchDB.connect((err) => {
//   if (err) {
//     console.error("❌ FETCH DB Connection Failed (NOVA):", err.message);
//   } else {
//     console.log("✅ Connected to FETCH DB: 'NOVA'");
//   }
// });

// // ✅ POST /radius
// router.post("/radius", (req, res) => {
//   console.log("\n📥 Received POST request to /radius");
//   const { radius } = req.body;
//   console.log("📦 Payload received ➜ radius:", radius);

//   if (typeof radius !== "number" || radius < 0) {
//     console.warn("⚠️ Invalid radius value:", radius);
//     return res.status(400).json({ error: "Invalid radius" });
//   }

//   // 🛠️ Insert into CLEEZOCLASS.radius_log
//   const insertQuery = "INSERT INTO radius_log (radius) VALUES (?)";
//   console.log("📤 Inserting radius into CLEEZOCLASS.radius_log...");

//   insertDB.query(insertQuery, [radius], (err, insertResult) => {
//     if (err) {
//       console.error("❌ Radius insert failed:", err.message);
//       return res.status(500).json({ error: "Database insert error" });
//     }

//     console.log("✅ Radius inserted with ID:", insertResult.insertId);

//     // 🔍 Fetch address from NOVA.Seller
//     const addressQuery = `
//       SELECT institute_address FROM Seller 
//       WHERE REPLACE(institute_name, ' ', '') = 'CLEEZOCLASS'
//     `;
//     console.log("📡 Querying address from NOVA.Seller...");

//     fetchDB.query(addressQuery, (err2, addressResult) => {
//       if (err2) {
//         console.error("❌ Address fetch failed:", err2.message);
//         return res.status(500).json({ error: "Error fetching address" });
//       }

//       const address = addressResult.length
//         ? addressResult[0].institute_address
//         : "Address not found";

//       console.log("✅ Address fetched:", address);

//       // ✅ Show formatted table in terminal
//       console.log("\n📊 Summary Table:");
//       console.table([
//         {
//           Database_Used_For_Insert: "CLEEZOCLASS",
//           Database_Used_For_Fetch: "NOVA",
//           Inserted_Radius: radius,
//           Inserted_ID: insertResult.insertId,
//           Institute_Address: address,
//         }
//       ]);

//       // 🎯 Final response
//       res.status(200).json({
//         status: true,
//         radius,
//         address,
//         message: "✅ Radius inserted and address fetched successfully",
//       });
//     });
//   });
// });

// module.exports = router;













// const express = require('express');
// const router = express.Router();
// const mysql = require('mysql2');
// const consoleTable = require('console.table');

// // 🔧 Dynamic DB connector
// function getDBConnection(databaseName) {
//   return mysql.createConnection({
//     host: '162.215.210.38',
//     user: 'root',
//     password: 'NavyAtagsoLnovA@$000',
//     database: databaseName,
//   });
// }

// // ✅ POST /radius
// router.post("/radius", (req, res) => {
//   console.log("\n📥 Received POST request to /radius");

//   const { radius, schoolcode } = req.body;
//   console.log("📦 Payload received ➜ radius:", radius, "schoolcode:", schoolcode);

//   if (typeof radius !== "number" || radius < 0) {
//     console.warn("⚠️ Invalid radius value:", radius);
//     return res.status(400).json({ error: "Invalid radius" });
//   }

//   if (!schoolcode) {
//     console.warn("⚠️ Missing schoolcode in request body");
//     return res.status(400).json({ error: "Missing schoolcode" });
//   }

//   const insertDB = getDBConnection(schoolcode); // e.g., 'CLEEZOCLASS'
//   const fetchDB = getDBConnection('NOVA');

//   // 👉 Connect INSERT DB
//   insertDB.connect((err) => {
//     if (err) {
//       console.error(`❌ Failed to connect to INSERT DB (${schoolcode}):`, err.message);
//       return res.status(500).json({ error: "DB connection failed (Insert DB)" });
//     }

//     console.log(`✅ Connected to INSERT DB: '${schoolcode}'`);

//     const insertQuery = "INSERT INTO radius_log (radius) VALUES (?)";
//     console.log(`📤 Inserting radius into ${schoolcode}.radius_log...`);

//     insertDB.query(insertQuery, [radius], (err, insertResult) => {
//       insertDB.end(); // ✅ Close connection after use

//       if (err) {
//         console.error("❌ Radius insert failed:", err.message);
//         return res.status(500).json({ error: "Database insert error" });
//       }

//       console.log("✅ Radius inserted with ID:", insertResult.insertId);

//       // 👉 Connect FETCH DB (NOVA)
//       fetchDB.connect((err2) => {
//         if (err2) {
//           console.error("❌ FETCH DB connection failed:", err2.message);
//           return res.status(500).json({ error: "DB connection failed (Fetch DB)" });
//         }

//         console.log("✅ Connected to FETCH DB: 'NOVA'");

//         const addressQuery = `
//           SELECT institute_address FROM Seller 
//           WHERE REPLACE(institute_name, ' ', '') = ?
//         `;

//         fetchDB.query(addressQuery, [schoolcode], (err3, addressResult) => {
//           fetchDB.end(); // ✅ Close connection after use

//           if (err3) {
//             console.error("❌ Address fetch failed:", err3.message);
//             return res.status(500).json({ error: "Error fetching address" });
//           }

//           const address = addressResult.length
//             ? addressResult[0].institute_address
//             : "Address not found";

//           console.log("✅ Address fetched:", address);

//           // 📊 Console summary
//           console.log("\n📊 Summary Table:");
//           console.table([
//             {
//               Insert_DB: schoolcode,
//               Fetch_DB: "NOVA",
//               Inserted_Radius: radius,
//               Inserted_ID: insertResult.insertId,
//               Institute_Address: address,
//             }
//           ]);

//           res.status(200).json({
//             status: true,
//             radius,
//             address,
//             message: "✅ Radius inserted and address fetched successfully",
//           });
//         });
//       });
//     });
//   });
// });

// module.exports = router;
