

// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
// const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const router = express.Router();

require('dotenv').config(); // Load .env variables

const app = express();
const port = 3010;

// MySQL Database Configuration
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('❌ Error connecting to MySQL:', err);
  } else {
    console.log('✅ Connected to MySQL database');
  }
});

app.use(cors());
app.use(express.json()); // To parse JSON bodies for POST requests
app.use('/uploads', express.static('uploads'));
// Nodemailer email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // Set in your .env file
    pass: process.env.EMAIL_PASS,
  },
});

// WhatsApp Web.js client setup with session persistence
// const waClient = new Client({
//   authStrategy: new LocalAuth(), // Saves session in ./local-auth folder
//   puppeteer: { headless: true },
// });

// waClient.on('qr', (qr) => {
//   console.log('🔗 QR RECEIVED, scan this QR with your WhatsApp mobile app:');
//   qrcode.generate(qr, { small: true });
// });

// waClient.on('ready', () => {
//   console.log('✅ WhatsApp client is ready!');
// });

// waClient.on('auth_failure', () => {
//   console.error('❌ WhatsApp authentication failed!');
// });

// waClient.initialize();

// -----------------
// API: /api/evaluate
// Batch send emails & WhatsApp messages based on DB data
// -----------------
router.get('/evaluate', async (req, res) => {
  console.log('📩 Received request to evaluate and send mails');

  const query = `
    SELECT
      e.student_name,
      e.score,
      a.email,
      a.phone AS phonenum,
      a.student_photo  -- added this line
    FROM evaluations e
    LEFT JOIN admission_form a ON e.student_name = a.student_name;
  `;

  db.query(query, async (err, rows) => {
    if (err) {
      console.error('❌ Error executing query:', err.message);
      return res.status(500).json({
        error: 'Internal server error',
        details: err.message,
      });
    }

    if (!rows || rows.length === 0) {
      console.log('❌ No data found in evaluations or admission_form tables.');
      return res.status(404).json({ error: 'No data found' });
    }

    console.log('✅ Query result:', rows);

    res.json(rows);
  });
});




router.post('/hotlead', async (req, res) => {
  try {
    const query = `
      SELECT e.student_name, e.score, a.email, a.phone AS phonenum
      FROM evaluations e
      LEFT JOIN admission_form a ON e.student_name = a.student_name;
    `;

    const rows = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!Array.isArray(rows)) {
      console.error('Expected array from DB query but got:', rows);
      return res.status(500).json({ error: 'DB query failed' });
    }

    const students = rows.map(row => ({
      student_name: row.student_name,
      score: row.score,
      email: row.email,
      phone: row.phonenum,
    }));

    const studentsWithPercentage = students.map(student => ({
      ...student,
      percentage: (student.score / 190) * 100,
    }));

    const hotLeads = studentsWithPercentage.filter(student => student.percentage >= 80);

    if (hotLeads.length === 0) {
      return res.json({ message: 'No hot leads found.' });
    }

    const sendCommunication = async (student, message) => {
      const { email, phone } = student;
      const result = {};

      const promises = [];

      if (email) {
        promises.push(
          transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: '🔥 Amazing Work! You’re a Top Performer!',
            text: message,
          }).then(() => {
            result.email = 'Email sent successfully';
            console.log(`✅ Email sent to ${email}`);
          }).catch((error) => {
            result.email = `Email failed: ${error.message}`;
            console.error(`❌ Email error for ${email}:`, error.message);
          })
        );
      }

      if (phone) {
        const waNumber = phone.replace(/\D/g, '');
        const chatId = `${waNumber}@c.us`;

        promises.push(
          waClient.sendMessage(chatId, message).then(() => {
            result.whatsapp = 'WhatsApp message sent successfully';
            console.log(`✅ WhatsApp sent to ${waNumber}`);
          }).catch((error) => {
            result.whatsapp = `WhatsApp failed: ${error.message}`;
            console.error(`❌ WhatsApp error for ${phone}:`, error.message);
          })
        );
      }

      await Promise.all(promises);
      return result;
    };

    // 🧠 Parallelize all hot lead communications
    const resultsArray = await Promise.all(hotLeads.map(async (lead) => {
      const hotMsg = `🎉 Hello ${lead.student_name}!\n\n` +
        `🔥 You scored ${lead.score} in your evaluation, placing you among the top performers! Incredible work!\n\n` +
        `🚀 Keep challenging yourself, aiming higher, and reaching for excellence.\n\n` +
        `💡 We're proud of your achievements and excited about your journey ahead.\n\n` +
        `– Team Support 🌟\n📞 +91 98498 16717\n🌐 https://nova.tagsol.tech`;

      const commResult = await sendCommunication(lead, hotMsg);
      return { student: lead.student_name, ...commResult };
    }));

    const results = resultsArray.reduce((acc, cur) => {
      acc[cur.student] = { email: cur.email, whatsapp: cur.whatsapp };
      return acc;
    }, {});

    res.json({ sentTo: hotLeads.length, results });

  } catch (error) {
    console.error('Error in /api/hotlead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/warmlead', async (req, res) => {
  try {
    const query = `
      SELECT e.student_name, e.score, a.email, a.phone AS phonenum
      FROM evaluations e
      LEFT JOIN admission_form a ON e.student_name = a.student_name;
    `;

    const rows = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const students = rows.map(row => ({
      student_name: row.student_name,
      score: row.score,
      email: row.email,
      phone: row.phonenum,
    }));

    const studentsWithPercentage = students.map(student => ({
      ...student,
      percentage: (student.score / 200) * 100,
    }));

    const warmLeads = studentsWithPercentage.filter(student => student.percentage >= 50 && student.percentage < 80);

    if (warmLeads.length === 0) {
      return res.json({ message: 'No warm leads found.' });
    }

    const sendCommunication = async (student, message) => {
      const { email, phone } = student;
      const result = {};
      const promises = [];

      if (email) {
        promises.push(
          transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: '🎓 Your Evaluation Score!',
            text: message,
          }).then(() => {
            result.email = 'Email sent successfully';
            console.log(`✅ Email sent to ${email}`);
          }).catch((error) => {
            result.email = `Email failed: ${error.message}`;
            console.error(`❌ Email error for ${email}:`, error.message);
          })
        );
      }

      if (phone) {
        const waNumber = phone.replace(/\D/g, '');
        const chatId = `${waNumber}@c.us`;

        promises.push(
          waClient.sendMessage(chatId, message).then(() => {
            result.whatsapp = 'WhatsApp message sent successfully';
            console.log(`✅ WhatsApp sent to ${waNumber}`);
          }).catch((error) => {
            result.whatsapp = `WhatsApp failed: ${error.message}`;
            console.error(`❌ WhatsApp error for ${phone}:`, error.message);
          })
        );
      }

      await Promise.all(promises);
      return result;
    };

    const resultsArray = await Promise.all(warmLeads.map(async (lead) => {
      const { student_name, score } = lead;

      const message = `Hi ${student_name} 👋,\n\n` +
        (score ? `🎉 Congrats on scoring ${score}! Your hard work 💪 and dedication 📚 truly paid off.\n\n` : '') +
        `🚀 Aim higher, stay focused, and unlock your true potential! 🔓✨\nKeep shining 🌟 and never stop learning! 💡\n\n` +
        `– Team Support 🤝\n📞 Call us at +91 98498 16717 or email us at info_nova@tagsol.tech\n🌐 Visit our website: https://nova.tagsol.tech`;

      const commResult = await sendCommunication(lead, message);
      return { student: student_name, ...commResult };
    }));

    const results = resultsArray.reduce((acc, cur) => {
      acc[cur.student] = { email: cur.email, whatsapp: cur.whatsapp };
      return acc;
    }, {});

    res.json({ sentTo: warmLeads.length, results });

  } catch (error) {
    console.error('Error in /api/warmlead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sendAdToStudent', async (req, res) => {
  try {
    const { student_name, score, email, phonenum } = req.body;

    if (!student_name || (!email && !phonenum)) {
      return res.status(400).json({ error: 'Missing required student info.' });
    }

    const message = `Hi ${student_name} 👋,\n\n` +
      (score ? `🎉 Congrats on scoring ${score}! Your hard work 💪 and dedication 📚 truly paid off.\n\n` : '') +
      `🚀 Aim higher, stay focused, and unlock your true potential! 🔓✨\nKeep shining 🌟 and never stop learning! 💡\n\n` +
      `– Team Support 🤝\n📞 Call us at +91 98498 16717 or email us at info_nova@tagsol.tech\n🌐 Visit our website: https://nova.tagsol.tech`;

    const result = {};

    // Send Email if available
    if (email) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: '🎓 Your Evaluation Score!',
          text: message,
        });
        result.email = '✅ Email sent successfully';
        console.log(`✅ Email sent to ${email}`);
      } catch (err) {
        result.email = `❌ Email failed: ${err.message}`;
        console.error(`Email error:`, err.message);
      }
    }

    // Send WhatsApp if available
    if (phonenum) {
      try {
        const waNumber = phonenum.replace(/\D/g, '');
        const chatId = `${waNumber}@c.us`;

        await waClient.sendMessage(chatId, message);
        result.whatsapp = '✅ WhatsApp message sent successfully';
        console.log(`✅ WhatsApp sent to ${waNumber}`);
      } catch (err) {
        result.whatsapp = `❌ WhatsApp failed: ${err.message}`;
        console.error(`WhatsApp error:`, err.message);
      }
    }

    return res.json({ success: true, student: student_name, result });

  } catch (error) {
    console.error('Error in /api/sendAdToStudent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/coldlead - Send emails and WhatsApp messages to cold leads
router.post('/coldlead', async (req, res) => {
  try {
    const query = `
      SELECT e.student_name, e.score, a.email, a.phone AS phonenum
      FROM evaluations e
      LEFT JOIN admission_form a ON e.student_name = a.student_name;
    `;

    const [rows] = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve([results]);
      });
    });

    const students = rows.map(row => ({
      student_name: row.student_name,
      score: row.score,
      email: row.email,
      phone: row.phonenum,
    }));

    // Assuming max score is 200 like warm leads
    const studentsWithPercentage = students.map(student => ({
      ...student,
      percentage: (student.score / 200) * 100,
    }));

    const coldLeads = studentsWithPercentage.filter(student => student.percentage < 50);

    if (coldLeads.length === 0) {
      return res.json({ message: 'No cold leads found.' });
    }

    const results = {};

    for (const lead of coldLeads) {
      const { student_name, email, phone, score } = lead;

      const coldMsg = `Hi ${student_name},\n\n` +
        `We understand that your score of ${score || 'N/A'} may not be what you hoped for. But don't worry – every great achiever was once a beginner.\n\n` +
        `🎯 Let’s work together to turn things around. We’re here to guide you every step of the way!\n\n` +
        `📞 Call us: +91 98498 16717\n✉️ Email: info_nova@tagsol.tech\n🌐 Website: https://nova.tagsol.tech\n\n` +
        `– Team Support 🤝`;

      // Send Email
      if (email) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'We’re Here to Help You Succeed!',
            text: coldMsg,
          });
          results[email] = 'Email sent successfully';
          console.log(`✅ Email sent to ${email}`);
        } catch (error) {
          results[email] = `Email failed: ${error.message}`;
          console.error(`❌ Email error for ${email}:`, error.message);
        }
      }

      // Send WhatsApp
      if (phone) {
        try {
          let waNumber = phone.replace(/\D/g, '');
          const chatId = `${waNumber}@c.us`;
          await waClient.sendMessage(chatId, coldMsg);
          results[phone] = 'WhatsApp message sent successfully';
          console.log(`✅ WhatsApp sent to ${waNumber}`);
        } catch (error) {
          results[phone] = `WhatsApp failed: ${error.message}`;
          console.error(`❌ WhatsApp error for ${phone}:`, error.message);
        }
      }
    }

    res.json({ sentTo: coldLeads.length, results });

  } catch (error) {
    console.error('Error in /api/coldlead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Socket.IO Setup (existing)
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

module.exports = router;
