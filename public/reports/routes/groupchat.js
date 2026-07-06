


const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const http = require('http');
const { Server } = require('socket.io');
const userSockets = new Map();
const router = express.Router();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});
const PORT = 5000;

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA'
});

db.connect(err => {
  if (err) console.error('❌ DB error:', err);
  else console.log('✅ MySQL connected');
});

function isWithinChatHours() {
  const hour = new Date().getHours();
  return hour >= 9 && hour < 18;
}

// ✅ Fetch teachers
router.get('/teachers', (req, res) => {
  db.query('SELECT * FROM management_login_creation WHERE user_type = "teacher"', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// ✅ Fetch all messages
router.get('/messages', (req, res) => {
  db.query('SELECT * FROM teacher_messages ORDER BY timestamp ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// ✅ Save message
router.post('/send-message', async (req, res) => {
  const { sender, receiver, message } = req.body;

  if (!sender || !receiver || !message) {
    return res.status(400).json({ message: 'Sender, receiver, and message are required.' });
  }

  if (!isWithinChatHours()) {
    return res.status(400).json({ message: 'Chat is only available between 9 AM and 6 PM.' });
  }

  try {
    const receivers = Array.isArray(receiver) ? receiver : [receiver];
    const queries = receivers.map(user =>
      db.promise().query(
        'INSERT INTO teacher_messages (sender, receiver, message, timestamp) VALUES (?, ?, ?, NOW())',
        [sender, user, message]
      )
    );

    await Promise.all(queries);
    res.status(200).json({ message: 'Message sent.' });
  } catch (err) {
    console.error('❌ DB insert error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query(
    'SELECT * FROM management_login_creation WHERE username = ? AND password = ?',
    [username, password],
    (err, results) => {
      if (err) {
        console.error('❌ DB error during login:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length > 0) {
        const teacher = results[0]; // matched user
        res.json({ success: true, teacher });
      } else {
        res.json({ success: false, message: 'Invalid username or password' });
      }
    }
  );
});


// ✅ Socket logic
io.on('connection', socket => {
  console.log('⚡ Socket connected:', socket.id);

  socket.on('register-user', username => {
    userSockets.set(username, socket.id);
    console.log(`✅ ${username} registered with socket ${socket.id}`);
  });

  socket.on('send-message', msg => {
    const { sender, receiver, message } = msg;
    const timestamp = new Date();

    const formattedMsg = {
      sender,
      receiver,
      message,
      timestamp
    };

    // Send to all receivers
    const receivers = Array.isArray(receiver) ? receiver : [receiver];
    const sentTo = new Set();

    receivers.forEach(user => {
      const targetSocket = userSockets.get(user);
      if (targetSocket && !sentTo.has(user)) {
        io.to(targetSocket).emit('receive-message', formattedMsg);
        sentTo.add(user);
      }
    });

    // Also send back to sender ONLY ONCE
    const senderSocket = userSockets.get(sender);
    if (senderSocket && !sentTo.has(sender)) {
      io.to(senderSocket).emit('receive-message', formattedMsg);
    }
  });

  socket.on('disconnect', () => {
    for (let [username, id] of userSockets.entries()) {
      if (id === socket.id) {
        userSockets.delete(username);
        console.log(`🔌 ${username} disconnected`);
        break;
      }
    }
  });
});


module.exports = router;

