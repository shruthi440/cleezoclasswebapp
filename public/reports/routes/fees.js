const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

/* =========================
   CREATE ROOT CONNECTION
========================= */

const createRootConnection = async () => {

  const connection = await mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000'
  });

  return connection;
};


/* =========================
   CREATE SCHOOL CONNECTION
========================= */

const createSchoolConnection = async (database) => {

  const connection = await mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: database
  });

  console.log(`✅ Connected to DB: ${database}`);

  return connection;
};


/* =========================
   ADD COLUMN API
========================= */



module.exports = router;