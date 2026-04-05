const express = require('express');
const router = express.Router();
const pool = require('../db');

// Add a new contact
router.post('/', async (req, res) => {
  const { user_id, name, nickname, phone, group_id, cadence_days } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO contacts (user_id, name, nickname, phone, group_id, cadence_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user_id, name, nickname, phone, group_id, cadence_days || 30]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search contacts by name
router.get('/search', async (req, res) => {
  const { user_id, q } = req.query;
  try {
    const result = await pool.query(
      `SELECT contacts.*, groups.name as group_name, groups.color_hex
       FROM contacts
       LEFT JOIN groups ON contacts.group_id = groups.id
       WHERE contacts.user_id = $1
       AND contacts.is_archived = false
       AND contacts.name ILIKE $2
       ORDER BY contacts.name ASC
       LIMIT 20`,
      [user_id, `%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single contact
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT contacts.*, groups.name as group_name
       FROM contacts
       LEFT JOIN groups ON contacts.group_id = groups.id
       WHERE contacts.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log a check-in
router.post('/:id/checkin', async (req, res) => {
  const { user_id, note, method } = req.body;
  const contact_id = req.params.id;
  try {
    const checkin = await pool.query(
      `INSERT INTO checkins (user_id, contact_id, note, method)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, contact_id, note, method || 'manual']
    );
    await pool.query(
      `UPDATE contacts SET last_contacted_at = NOW() WHERE id = $1`,
      [contact_id]
    );
    res.status(201).json(checkin.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;