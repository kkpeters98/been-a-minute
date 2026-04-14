const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/generate', async (req, res) => {
  const { contact_id } = req.body;

  try {
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*, users(display_name)')
      .eq('id', contact_id)
      .single();
    if (error) throw error;

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
