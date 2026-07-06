const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const port = 4000;
const path = require('path');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const nodemailer = require('nodemailer');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

app.use(express.json());
app.use(cors());
const multer = require('multer');
const server = http.createServer(app);
const io1 = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});
app.use(express.urlencoded({ extended: true }));

// Function to create a school-specific connection
async function getDatabaseConnection(schoolCode) {
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode
  });
}

const router = express.Router();
const userSockets = new Map();

// Debug: Log current time and check if within chat hours
function isWithinChatHours() {
  const hour = new Date().getHours();
  const withinHours = hour >= 9 && hour < 18;
  console.log(`🕒 isWithinChatHours: Current hour=${hour}, withinHours=${withinHours}`);
  return withinHours;
}

// Debug: Log username and schoolCode when fetching chat status
async function getChatStatusFromDB(username, schoolCode) {
  console.log(`🔍 getChatStatusFromDB: username=${username}, schoolCode=${schoolCode}`);
  const userData = userSockets.get(username);
  if (!userData) {
    console.error(`❌ getChatStatusFromDB: userData not found for username=${username}`);
    return false;
  }
  try {
    const db = await getDatabaseConnection(schoolCode);
    const [results] = await db.query(
      "SELECT chat_enabled FROM management_login_creation WHERE username = ?",
      [username]
    );
    db.end();
    console.log(`✅ getChatStatusFromDB: results for username=${username}:`, results);
    return results.length > 0 && results[0].chat_enabled === 1;
  } catch (err) {
    console.error(`❌ DB Error in getChatStatusFromDB for schoolCode=${schoolCode}:`, err);
    return false;
  }
}

module.exports = (io) => {
  // Socket.IO connection
  io.on('connection', (socket) => {
    console.log('⚡ Socket connected:', socket.id);
    socket.on('register-user', (username, schoolCode) => {
      console.log(`👤 Registering user: ${username}, schoolCode: ${schoolCode}`);
      userSockets.set(username, { socketId: socket.id, schoolCode });
      console.log(`👤 ${username} registered with socket ID: ${socket.id}, schoolCode: ${schoolCode}`);
    });

    socket.on('send-message', async (msg) => {
      const { sender, receiver, message, timestamp } = msg;
      const receivers = Array.isArray(receiver) ? receiver : [receiver];
      const schoolCode = userSockets.get(sender)?.schoolCode;
      console.log(`📩 send-message: sender=${sender}, schoolCode=${schoolCode}`);
      if (!schoolCode) {
        console.error(`❌ send-message: School code not found for sender: ${sender}`);
        return;
      }
      const senderEnabled = await getChatStatusFromDB(sender, schoolCode);
      if (!senderEnabled) {
        console.log(`❌ ${sender} chat disabled - cannot send`);
        return;
      }
      const deliveredUsers = [];
      for (const user of receivers) {
        const target = userSockets.get(user);
        if (!target) continue;
        const receiverEnabled = await getChatStatusFromDB(user, schoolCode);
        if (target && receiverEnabled) {
          io.to(target.socketId).emit('receive-message', {
            sender,
            receiver: user,
            message,
            timestamp: timestamp || new Date()
          });
          deliveredUsers.push(user);
        } else {
          console.log(`❌ ${user} chat disabled or not connected - not delivered`);
        }
      }
      const senderSocket = userSockets.get(sender);
      if (senderSocket) {
        io.to(senderSocket.socketId).emit('receive-message', {
          sender,
          receiver: deliveredUsers,
          message,
          timestamp: timestamp || new Date()
        });
      }
    });

    socket.on('disconnect', () => {
      for (let [user, data] of userSockets.entries()) {
        if (data.socketId === socket.id) {
          userSockets.delete(user);
          console.log(`👋 ${user} disconnected`);
          break;
        }
      }
    });
  });

  // Middleware to extract schoolCode from query parameters
  router.use((req, res, next) => {
    const schoolCode = req.query.schoolCode;
    console.log(`🔍 Middleware: schoolCode received: ${schoolCode}`);
    if (!schoolCode) {
      console.error('❌ Middleware: schoolCode is missing in query params');
      return res.status(400).json({ error: 'School code is required' });
    }
    req.schoolCode = schoolCode;
    next();
  });

  // REST Endpoints
  router.get('/teachersdataretreiveal', async (req, res) => {
    console.log(`🔍 /teachersdataretreiveal: schoolCode=${req.schoolCode}`);
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT * FROM management_login_creation WHERE user_type="teacher"'
      );
      db.end();
      res.json(results);
    } catch (err) {
      console.error(`❌ DB Error in /teachersdataretreiveal for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/messagesdataretreiveal', async (req, res) => {
    console.log(`🔍 /messagesdataretreiveal: schoolCode=${req.schoolCode}`);
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT * FROM teacher_messages ORDER BY timestamp ASC'
      );
      db.end();
      res.json(results);
    } catch (err) {
      console.error(`❌ DB Error in /messagesdataretreiveal for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/send-messagesretreiveal', async (req, res) => {
    console.log(`🔍 /send-messagesretreiveal: schoolCode=${req.schoolCode}`);
    const { sender, receiver, message } = req.body;
    if (!sender || !receiver || !message) {
      return res.status(400).json({ message: 'All fields required' });
    }
    if (!isWithinChatHours()) {
      return res.status(400).json({ message: 'Chat allowed 9 AM - 6 PM' });
    }
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const receivers = Array.isArray(receiver) ? receiver : [receiver];
      await Promise.all(
        receivers.map((user) =>
          db.query(
            'INSERT INTO teacher_messages (sender, receiver, message, timestamp) VALUES (?, ?, ?, NOW())',
            [sender, user, message]
          )
        )
      );
      db.end();
      res.status(200).json({ message: 'Message sent' });
    } catch (err) {
      console.error(`❌ DB Error in /send-messagesretreiveal for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ message: 'DB insert error' });
    }
  });

  router.post('/loginpageretreiveal', async (req, res) => {
    console.log(`🔍 /loginpageretreiveal: schoolCode=${req.schoolCode}`);
    const { username, password } = req.body;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT * FROM management_login_creation WHERE username=? AND password=?',
        [username, password]
      );
      db.end();
      if (results.length > 0) {
        res.json({ success: true, teacher: results[0] });
      } else {
        res.json({ success: false, message: 'Invalid credentials' });
      }
    } catch (err) {
      console.error(`❌ DB Error in /loginpageretreiveal for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ success: false, message: 'DB error' });
    }
  });

  router.post('/current-userretreiveal', async (req, res) => {
    console.log(`🔍 /current-userretreiveal: schoolCode=${req.schoolCode}`);
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT name FROM management_login_creation WHERE username = ?',
        [username]
      );
      db.end();
      if (results.length > 0) {
        res.json({ success: true, name: results[0].name });
      } else {
        res.json({ success: false, message: 'User not found' });
      }
    } catch (err) {
      console.error(`❌ DB Error in /current-userretreiveal for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.post('/sender-nameretreiveal', async (req, res) => {
    console.log(`🔍 /sender-nameretreiveal: schoolCode=${req.schoolCode}`);
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT name FROM management_login_creation WHERE username = ?',
        [username]
      );
      db.end();
      if (results.length > 0) {
        res.json({ success: true, name: results[0].name });
      } else {
        res.json({ success: false, message: 'Sender not found' });
      }
    } catch (err) {
      console.error(`❌ DB Error in /sender-nameretreiveal for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.get('/studentsdataretreiveal', async (req, res) => {
    console.log(`🔍 /studentsdataretreiveal: schoolCode=${req.schoolCode}`);
    const teacherUsername = req.query.teacher;
    let query = 'SELECT * FROM management_login_creation WHERE user_type="student"';
    if (teacherUsername) {
      query = `
        SELECT s.*
        FROM management_login_creation s
        JOIN teacher_classes tc ON s.class_name = tc.class_name
        WHERE s.user_type = "student" AND tc.teacher_username = ?
      `;
    }
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(query, teacherUsername ? [teacherUsername] : []);
      db.end();
      res.json(results);
    } catch (err) {
      console.error(`❌ DB Error in /studentsdataretreiveal for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/teacher-classes-groups', async (req, res) => {
    console.log(`🔍 /teacher-classes: schoolCode=${req.schoolCode}`);
    const teacher = req.query.teacher;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5, teaches_to_6, teaches_to_7, teaches_to_8, teaches_to_9, teaches_to_10, teaches_to_11, teaches_to_12 FROM management_login_creation WHERE username = ? AND user_type="teacher"',
        [teacher]
      );
      db.end();
      if (results.length === 0) return res.json([]);
      const teacherData = results[0];
      const assignedClasses = Object.values(teacherData).filter(c => c !== null);
      res.json(assignedClasses);
    } catch (err) {
      console.error(`❌ DB Error in /teacher-classes for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/students-by-class', async (req, res) => {
    console.log(`🔍 /students-by-class: schoolCode=${req.schoolCode}`);
    const className = req.query.className;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT * FROM management_login_creation WHERE user_type="student" AND class_name = ?',
        [className]
      );
      db.end();
      res.json(results);
    } catch (err) {
      console.error(`❌ DB Error in /students-by-class for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/sections-by-class', async (req, res) => {
    console.log(`🔍 /sections-by-class: schoolCode=${req.schoolCode}`);
    const { className } = req.query;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT DISTINCT section FROM management_login_creation WHERE class_name = ? AND user_type="student"',
        [className]
      );
      db.end();
      res.json(results.map(r => r.section));
    } catch (err) {
      console.error(`❌ DB Error in /sections-by-class for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/students-by-class-section', async (req, res) => {
    console.log(`🔍 /students-by-class-section: schoolCode=${req.schoolCode}`);
    const { className, section } = req.query;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT * FROM management_login_creation WHERE user_type="student" AND class_name = ? AND section = ?',
        [className, section]
      );
      db.end();
      res.json(results);
    } catch (err) {
      console.error(`❌ DB Error in /students-by-class-section for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/create-group', async (req, res) => {
    console.log(`🔍 /create-group: schoolCode=${req.schoolCode}`);
    const { teacher, class_name, section, group_name, students } = req.body;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT tokens FROM management_login_creation WHERE username=?',
        [teacher]
      );
      let groups = [];
      if (results[0]?.tokens) {
        try {
          groups = JSON.parse(results[0].tokens);
        } catch {
          groups = [];
        }
      }
      const newGroup = {
        group_name,
        class: class_name,
        section,
        students: [...students, teacher],
        teacher
      };
      groups.push(newGroup);
      await db.query(
        'UPDATE management_login_creation SET tokens=? WHERE username=?',
        [JSON.stringify(groups), teacher]
      );
      const updateStudent = async (index) => {
        if (index >= students.length) {
          db.end();
          return res.json({ success: true, message: "Group created successfully!" });
        }
        const student = students[index];
        const [stuRes] = await db.query(
          'SELECT tokens FROM management_login_creation WHERE username=?',
          [student]
        );
        let stuGroups = [];
        if (stuRes[0]?.tokens) {
          try {
            stuGroups = JSON.parse(stuRes[0].tokens);
          } catch {
            stuGroups = [];
          }
        }
        stuGroups.push(newGroup);
        await db.query(
          'UPDATE management_login_creation SET tokens=? WHERE username=?',
          [JSON.stringify(stuGroups), student]
        );
        updateStudent(index + 1);
      };
      updateStudent(0);
    } catch (err) {
      console.error(`❌ DB Error in /create-group for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/user-groups-messages', async (req, res) => {
    console.log(`🔍 /user-groups: schoolCode=${req.schoolCode}`);
    const { username } = req.query;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT tokens FROM management_login_creation WHERE username = ? AND user_type="teacher"',
        [username]
      );
      db.end();
      if (results.length === 0 || !results[0].tokens) {
        return res.json([]);
      }
      let groups = [];
      try {
        groups = JSON.parse(results[0].tokens);
      } catch (e) {
        console.error(`❌ Error parsing groups data in /user-groups for schoolCode=${req.schoolCode}:`, e);
        return res.status(500).json({ error: "Error parsing groups data" });
      }
      res.json(groups);
    } catch (err) {
      console.error(`❌ DB Error in /user-groups for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/student-groups', async (req, res) => {
    console.log(`🔍 /student-groups: schoolCode=${req.schoolCode}`);
    const { student_username } = req.query;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT tokens FROM management_login_creation WHERE username=? AND user_type="student"',
        [student_username]
      );
      db.end();
      let groups = [];
      if (results[0]?.tokens) {
        try {
          groups = JSON.parse(results[0].tokens);
        } catch {
          groups = [];
        }
      }
      const onlyGroups = (groups || []).filter(g => g && g.group_name && Array.isArray(g.students));
      res.json(onlyGroups);
    } catch (err) {
      console.error(`❌ DB Error in /student-groups for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/update-group-name", async (req, res) => {
    console.log(`🔍 /update-group-name: schoolCode=${req.schoolCode}`);
    const { teacher, old_name, new_name } = req.body;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [result] = await db.query(
        `UPDATE management_login_creation
         SET tokens = JSON_SET(
           tokens,
           REPLACE(
             JSON_UNQUOTE(JSON_SEARCH(tokens, 'one', ?)),
             '.group_name',
             '.group_name'
           ),
           ?
         )
         WHERE username = ?
           AND JSON_SEARCH(tokens, 'one', ?) IS NOT NULL`,
        [old_name, new_name, teacher, old_name]
      );
      db.end();
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }
      res.json({ success: true, message: "Group name updated" });
    } catch (err) {
      console.error(`❌ DB Error in /update-group-name for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/update-group-members", async (req, res) => {
    console.log(`🔍 /update-group-members: schoolCode=${req.schoolCode}`);
    const { teacher, group_name, new_students } = req.body;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [result] = await db.query(
        `UPDATE management_login_creation
         SET tokens = JSON_SET(
           tokens,
           REPLACE(
             JSON_UNQUOTE(JSON_SEARCH(tokens, 'one', ?)),
             '.group_name',
             '.students'
           ),
           CAST(? AS JSON)
         )
         WHERE username = ?
           AND JSON_SEARCH(tokens, 'one', ?) IS NOT NULL`,
        [group_name, JSON.stringify(new_students), teacher, group_name]
      );
      db.end();
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }
      res.json({ success: true, message: "Group members updated" });
    } catch (err) {
      console.error(`❌ DB Error in /update-group-members for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/delete-group", async (req, res) => {
    console.log(`🔍 /delete-group: schoolCode=${req.schoolCode}`);
    const { teacher, group_name } = req.body;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        'SELECT tokens FROM management_login_creation WHERE username=?',
        [teacher]
      );
      let groups = [];
      if (results[0]?.tokens) {
        try {
          groups = JSON.parse(results[0].tokens);
        } catch {
          groups = [];
        }
      }
      const groupToDelete = groups.find(g => g.group_name === group_name);
      if (!groupToDelete) {
        db.end();
        return res.status(404).json({ error: "Group not found" });
      }
      groups = groups.filter(g => g.group_name !== group_name);
      await db.query(
        'UPDATE management_login_creation SET tokens=? WHERE username=?',
        [JSON.stringify(groups), teacher]
      );
      const students = groupToDelete.students || [];
      const deleteFromStudents = async (i) => {
        if (i >= students.length) {
          db.end();
          return res.json({ success: true, message: "Group deleted from teacher + students" });
        }
        const student = students[i];
        const [stuRes] = await db.query(
          'SELECT tokens FROM management_login_creation WHERE username=?',
          [student]
        );
        if (stuRes[0]?.tokens) {
          let stuGroups = [];
          try {
            stuGroups = JSON.parse(stuRes[0].tokens);
          } catch {
            stuGroups = [];
          }
          stuGroups = stuGroups.filter(g => g.group_name !== group_name);
          await db.query(
            'UPDATE management_login_creation SET tokens=? WHERE username=?',
            [JSON.stringify(stuGroups), student]
          );
        }
        deleteFromStudents(i + 1);
      };
      deleteFromStudents(0);
    } catch (err) {
      console.error(`❌ DB Error in /delete-group for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/toggle-chat", async (req, res) => {
    console.log(`🔍 /toggle-chat: schoolCode=${req.schoolCode}`);
    const { username, enabled } = req.body;
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      await db.query(
        "UPDATE management_login_creation SET chat_enabled=? WHERE username=?",
        [enabled ? 1 : 0, username]
      );
      db.end();
      res.json({ success: true });
    } catch (err) {
      console.error(`❌ DB Error in /toggle-chat for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: "DB Error updating chat status" });
    }
  });

  router.get("/chat-status", async (req, res) => {
    console.log(`🔍 /chat-status: schoolCode=${req.schoolCode}`);
    try {
      const db = await getDatabaseConnection(req.schoolCode);
      const [results] = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = 'management_login_creation'
         AND COLUMN_NAME = 'chat_enabled'
         AND TABLE_SCHEMA = DATABASE();`
      );
      const columnExists = results[0].cnt > 0;
      const addColumn = async () => {
        const [data] = await db.query(
          "SELECT username, chat_enabled FROM management_login_creation"
        );
        db.end();
        const chatStatus = {};
        data.forEach(row => {
          chatStatus[row.username] = row.chat_enabled === 1;
        });
        res.json(chatStatus);
      };
      if (!columnExists) {
        await db.query(
          "ALTER TABLE management_login_creation ADD COLUMN chat_enabled TINYINT(1) DEFAULT 1"
        );
      }
      addColumn();
    } catch (err) {
      console.error(`❌ DB Error in /chat-status for schoolCode=${req.schoolCode}:`, err);
      res.status(500).json({ error: "Error checking column existence" });
    }
  });

  return router;
};
