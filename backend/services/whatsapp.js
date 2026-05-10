/**
 * WhatsApp Meta Cloud API service
 * Handles sending text messages, template messages, and media (PDFs)
 */

const axios = require('axios');
const { logger } = require('./logger');

const WA_BASE = 'https://graph.facebook.com/v19.0';
const PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const TOKEN = process.env.WA_ACCESS_TOKEN;

const headers = () => ({
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
});

/**
 * Send a plain text message
 */
async function sendText(to, text) {
  try {
    const res = await axios.post(`${WA_BASE}/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text }
    }, { headers: headers() });
    logger.info(`Message sent to ${to}`, { msgId: res.data.messages?.[0]?.id });
    return res.data;
  } catch (err) {
    logger.error(`Failed to send message to ${to}`, { err: err.response?.data || err.message });
    throw err;
  }
}

/**
 * Send the initial Zoho lead notification using a WhatsApp template
 * Template name: ao_lead_notification (must be pre-approved in Meta)
 * Parameters: {{1}} = lead name, {{2}} = trip name
 */
async function sendLeadTemplate(to, leadName, tripName) {
  try {
    const res = await axios.post(`${WA_BASE}/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'ao_lead_notification',
        language: { code: 'en' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: leadName },
            { type: 'text', text: tripName }
          ]
        }]
      }
    }, { headers: headers() });
    logger.info(`Template sent to ${to} for ${tripName}`);
    return res.data;
  } catch (err) {
    logger.error(`Template send failed to ${to}`, { err: err.response?.data || err.message });
    throw err;
  }
}

/**
 * Send a PDF brochure as a document message
 */
async function sendBrochure(to, pdfUrl, tripName) {
  try {
    const res = await axios.post(`${WA_BASE}/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        link: pdfUrl,
        caption: `${tripName} — Adventures Overland Brochure`,
        filename: `${tripName.replace(/\s+/g, '_')}_Brochure.pdf`
      }
    }, { headers: headers() });
    logger.info(`Brochure sent to ${to} for ${tripName}`);
    return res.data;
  } catch (err) {
    logger.error(`Brochure send failed to ${to}`, { err: err.response?.data || err.message });
    throw err;
  }
}

/**
 * Send an agent contact card (vCard via text for simplicity)
 */
async function sendAgentContact(to, agent, tripName) {
  const msg = `🧑‍💼 *Your Adventures Overland Travel Specialist*\n\n` +
    `*${agent.name}*\n` +
    `📞 ${agent.phone}\n` +
    `📧 ${agent.email}\n\n` +
    `They'll help you complete your booking for *${tripName}*. Feel free to reach out directly!`;
  return sendText(to, msg);
}

/**
 * Mark a message as read
 */
async function markRead(messageId) {
  try {
    await axios.post(`${WA_BASE}/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    }, { headers: headers() });
  } catch (err) {
    // Non-critical, log and continue
    logger.warn(`markRead failed for ${messageId}`);
  }
}

module.exports = { sendText, sendLeadTemplate, sendBrochure, sendAgentContact, markRead };
