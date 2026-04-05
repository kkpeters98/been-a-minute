const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = require('./db');
const contactsRouter = require('./routes/contacts');
const messagesRouter = require('./routes/messages');

app.use('/contacts', contactsRouter);
app.use('/messages', messagesRouter);
app.post('/test', (req, res) => res.json({ ok: true }));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Been a Minute API running on port ${PORT}`);
});