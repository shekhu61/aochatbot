/**
 * AO WhatsApp AI Agent — Backend Server
 * Stack: Node.js + Express | Meta Cloud API | Claude AI | Zoho CRM
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { handleWebhook, verifyWebhook } = require('./routes/webhook');
const { router: apiRouter } = require('./routes/api');
const { checkInactiveConversations } = require('./services/inactivity');
const { logger } = require('./services/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.DASHBOARD_URL || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// WhatsApp webhook verification (GET) + message handler (POST)
app.get('/webhook/whatsapp', verifyWebhook);
app.post('/webhook/whatsapp', handleWebhook);

// Zoho webhook — new lead notification
app.post('/webhook/zoho', require('./routes/zohoWebhook'));

// Dashboard API
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Inactivity cron: check every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  logger.info('Running inactivity check...');
  await checkInactiveConversations();
});

app.listen(PORT, () => {
  logger.info(`AO Agent server running on port ${PORT}`);
});

module.exports = app;
