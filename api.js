/**
 * Dashboard API Routes
 * Provides data and controls for the React dashboard
 */

const express = require('express');
const router = express.Router();
const {
  getAllConversations, getConversation, setConversation,
  getAllTrips, upsertTrip, getStats
} = require('../services/store');
const { sendText } = require('../services/whatsapp');
const { updateLeadStatus } = require('../services/zoho');
const { logger } = require('../services/logger');

// GET /api/stats — Dashboard summary stats
router.get('/stats', (req, res) => {
  res.json(getStats());
});

// GET /api/conversations — All conversations (sorted by recent)
router.get('/conversations', (req, res) => {
  const convs = getAllConversations().map(c => ({
    phone: c.phone,
    leadName: c.leadName,
    tripName: c.tripName,
    leadStatus: c.leadStatus,
    status: c.status,
    lastMessageAt: c.lastMessageAt,
    nudgesSent: c.nudgesSent,
    messageCount: c.messages.length,
    lastMessage: c.messages[c.messages.length - 1]?.content?.substring(0, 100) || '',
    createdAt: c.createdAt
  }));
  res.json(convs);
});

// GET /api/conversations/:phone — Full conversation
router.get('/conversations/:phone', (req, res) => {
  const conv = getConversation(req.params.phone);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json(conv);
});

// PATCH /api/conversations/:phone/status — Manually update lead status
router.patch('/conversations/:phone/status', async (req, res) => {
  const { status } = req.body;
  const conv = getConversation(req.params.phone);
  if (!conv) return res.status(404).json({ error: 'Not found' });

  conv.leadStatus = status;
  setConversation(req.params.phone, conv);

  await updateLeadStatus(conv.leadId, status, 'Manual override from dashboard', `Status manually set to ${status}`);
  res.json({ success: true });
});

// POST /api/conversations/:phone/message — Send manual message from dashboard
router.post('/conversations/:phone/message', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const conv = getConversation(req.params.phone);
  if (!conv) return res.status(404).json({ error: 'Not found' });

  try {
    await sendText(req.params.phone, text);
    conv.messages.push({ role: 'assistant', content: text, ts: new Date(), isManual: true });
    conv.lastMessageAt = new Date();
    setConversation(req.params.phone, conv);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/conversations/:phone/close — Close a conversation
router.patch('/conversations/:phone/close', (req, res) => {
  const conv = getConversation(req.params.phone);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  conv.status = 'closed';
  setConversation(req.params.phone, conv);
  res.json({ success: true });
});

// GET /api/trips — All trips in knowledge base
router.get('/trips', (req, res) => {
  res.json(getAllTrips());
});

// PUT /api/trips/:name — Update trip info
router.put('/trips/:name', (req, res) => {
  upsertTrip(req.params.name, req.body);
  res.json({ success: true });
});

// POST /api/trips — Add a new trip
router.post('/trips', (req, res) => {
  const { name, ...data } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  upsertTrip(name, data);
  res.json({ success: true });
});

// POST /api/test/lead — Simulate a lead (for testing)
router.post('/test/lead', async (req, res) => {
  const { phone, leadName, tripName, leadId } = req.body;
  const { createConversation } = require('../services/store');
  const { sendLeadTemplate } = require('../services/whatsapp');

  createConversation(phone, { leadId: leadId || 'TEST-001', leadName, tripName });
  try {
    await sendLeadTemplate(phone, leadName.split(' ')[0], tripName);
    res.json({ success: true, message: `Lead created and WA template sent to ${phone}` });
  } catch (err) {
    res.json({ success: true, message: `Lead created. WA send failed: ${err.message}` });
  }
});

module.exports = { router };
