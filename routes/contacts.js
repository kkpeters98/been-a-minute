const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Add a new contact
router.post('/', async (req, res) => {
  const { user_id, name, nickname, phone, group_id, cadence_days } = req.body;
  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert({ user_id, name, nickname, phone, group_id, cadence_days: cadence_days || 30 })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search contacts by name
router.get('/search', async (req, res) => {
  const { user_id, q } = req.query;
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, groups(name, color_hex)')
      .eq('user_id', user_id)
      .eq('is_archived', false)
      .ilike('name', `%${q || ''}%`)
      .order('name')
      .limit(20);
    if (error) throw error;
    // Flatten groups join so frontend gets group_name and color_hex at top level
    const contacts = data.map(c => ({
      ...c,
      group_name: c.groups?.name ?? null,
      color_hex: c.groups?.color_hex ?? null,
      groups: undefined,
    }));
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single contact
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, groups(name)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json({ ...data, group_name: data.groups?.name ?? null, groups: undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log a check-in
router.post('/:id/checkin', async (req, res) => {
  const { user_id, note, method } = req.body;
  const contact_id = req.params.id;
  try {
    const { data, error } = await supabase
      .from('checkins')
      .insert({ user_id, contact_id, note, method: method || 'manual' })
      .select()
      .single();
    if (error) throw error;
    await supabase
      .from('contacts')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', contact_id);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all groups
router.get('/groups/list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
