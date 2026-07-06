const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// 🔍 Debug Middleware to show request body
router.use((req, res, next) => {
  console.log('🔍 Incoming Request:', {
    method: req.method,
    url: req.originalUrl,
    contentType: req.get('Content-Type'),
    body: req.body
  });
  next();
});

router.post('/schoollogodynamic', async (req, res) => {
  const requestStart = Date.now();
  console.log('🚀 Starting logo fetch request');
  
  try {
    // 1. Input extraction and validation
    const secretecode = req.body?.secretecode;
    console.log('📥 Received secretecode:', secretecode || '(empty)');

    if (!secretecode) {
      console.error('❌ Validation Error: Missing secretecode');
      return res.status(400).json({ 
        error: 'School code is required',
        receivedBody: req.body
      });
    }

    // 2. School name processing
    let schoolName = secretecode.trim().replace(/_/g, ' ');
    console.log('🔄 Initial school name:', schoolName);

    // Special case handling for SREE_GEETHANJALI_EM
    if (secretecode === 'SREE_GEETHANJALI_EM') {
      schoolName = 'SREE GEETHANJALI E.M SCHOOL'; // Exact match for database
      console.log('✨ Applied exact name transformation:', schoolName);
    }
    console.log(`🏫 Final search name: "${schoolName}"`);

    // 3. Database operations
    const dbConfig = {
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: 'NOVA',
      connectTimeout: 10000
    };

    console.log('🔌 Establishing database connection...');
    const connection = await mysql.createConnection(dbConfig);
    
    // 4. Query with exact matching
    const query = 'SELECT logo FROM Seller WHERE institute_name = ?';
    console.log(`🔍 Executing query: "${query}" for "${schoolName}"`);
    
    const [rows] = await connection.query(query, [schoolName]);
    await connection.end();
    console.log(`📊 Found ${rows.length} matching records`);

    // 5. Result handling
    if (rows.length === 0) {
      console.error('❌ No matching institute found');
      return res.status(404).json({ 
        error: 'Institute not found',
        searchedName: schoolName
      });
    }

    if (!rows[0].logo) {
      console.error('⚠️ Logo exists but content is empty');
      return res.status(404).json({ 
        error: 'Logo not found',
        institute: schoolName
      });
    }

    // 6. Success response
    const logoPath = `data:image/jpeg;base64,${rows[0].logo.toString('base64')}`;
    console.log(`✅ Successfully processed in ${Date.now() - requestStart}ms`);
    
    return res.json({ 
      logoPath,
      institute: schoolName,
      requestDuration: `${Date.now() - requestStart}ms`
    });

  } catch (error) {
    console.error('🔥 Critical Error:', {
      message: error.message,
      stack: error.stack.split('\n')[0], // First line of stack trace
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;