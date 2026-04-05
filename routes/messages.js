const express = require('express');
const router = express.Router();
const pool = require('../db');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/generate', async (req, res) => {
  const { contact_id, user_id } = req.body;

  try {
    const result = await pool.query(
      `SELECT contacts.*, users.display_name as user_name
       FROM contacts
       JOIN users ON contacts.user_id = users.id
       WHERE contacts.id = $1`,
      [contact_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });

    const contact = result.rows[0];
    const days = contact.last_contacted_at
      ? Math.floor((Date.now() - new Date(contact.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const timeContext = days === null
      ? "You haven't reached out to this person before."
      : days === 0 ? "You just spoke today."
      : days === 1 ? "You spoke yesterday."
      : `It's been ${days} days since you last spoke.`;

    const styleContext = contact.writing_style_sample
      ? `Here is an example of how this person typically texts: "${contact.writing_style_sample}". Match this style exactly.`
      : 'Keep it casual, warm and natural. Short and friendly.';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Generate a short, warm text message to send to ${contact.name}. ${timeContext} ${styleContext} The message should feel genuine and not salesy. Just a friendly reach out. Return ONLY the message text, nothing else.`
      }]
    });

    res.json({ message: message.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;