/**
 * WhatsApp Webhook Route
 * Handles verification challenge and incoming messages
 */

const { getConversation, setConversation } = require('../services/store');
const { processMessage } = require('../services/agent');
const { sendText, sendBrochure, sendAgentContact, markRead } = require('../services/whatsapp');
const { updateLeadStatus } = require('../services/zoho');
const { stats } = require('../services/store');
const { logger } = require('../services/logger');

/**
 * GET /webhook/whatsapp — Meta verification challenge
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
}

/**
 * POST /webhook/whatsapp — Incoming messages
 */
async function handleWebhook(req, res) {
  // Always acknowledge immediately
  res.sendStatus(200);

  try {
    const body = req.body;
    if (!body?.object) return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) return;

    const msg = value.messages[0];
    const phone = msg.from;
    const msgId = msg.id;
    const msgType = msg.type;

    // Mark as read
    await markRead(msgId);

    // Only handle text messages for now
    if (msgType !== 'text') {
      await sendText(phone, "Thanks for reaching out! Please send a text message and I'll be happy to help you 😊");
      return;
    }

    const userText = msg.text.body;
    logger.info(`Incoming from ${phone}: ${userText.substring(0, 80)}`);

    // Get conversation
    const conv = getConversation(phone);
    if (!conv) {
      // Unknown number — no lead context
      await sendText(phone,
        "Hi! 👋 I'm Aria from Adventures Overland. I don't seem to have your enquiry on file. " +
        "Please visit www.adventuresoverland.com or call us at +91-XXXXXXXXXX to get started!"
      );
      return;
    }

    // Update last message time
    conv.lastMessageAt = new Date();
    conv.nudgesSent = 0; // Reset nudge counter on reply

    // Process with AI agent
    const result = await processMessage(conv, userText);
    stats.messagesHandled++;

    // Send main reply
    await sendText(phone, result.message);

    // Handle actions
    if (result.action === 'send_brochure' && conv.tripInfo?.brochureUrl) {
      await sendBrochure(phone, conv.tripInfo.brochureUrl, conv.tripName);
      stats.brochuresSent++;
    } else if (result.action === 'send_brochure' && !conv.tripInfo?.brochureUrl) {
      await sendText(phone, "I'll have our team send you the detailed brochure on email shortly! What's your email address?");
    }

    if (result.action === 'connect_agent' && conv.tripInfo?.agentContact) {
      await sendAgentContact(phone, conv.tripInfo.agentContact, conv.tripName);
      stats.agentHandoffs++;
    }

    // Update lead status
    if (result.leadStatus && result.leadStatus !== conv.leadStatus) {
      conv.leadStatus = result.leadStatus;
      await updateLeadStatus(conv.leadId, result.leadStatus, result.leadStatusReason, result.agentNote);
      conv.zohoUpdatedAt = new Date();
    }

    // Save updated conversation
    setConversation(phone, conv);

  } catch (err) {
    logger.error('Webhook processing error', { err: err.message });
  }
}

module.exports = { verifyWebhook, handleWebhook };
