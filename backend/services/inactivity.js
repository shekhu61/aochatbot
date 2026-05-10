/**
 * Inactivity service
 * Runs on cron to detect stalled conversations and send nudges
 */

const { getInactiveConversations, setConversation } = require('./store');
const { sendText } = require('./whatsapp');
const { generateNudgeMessage } = require('./agent');
const { logger } = require('./logger');

// Thresholds: nudge 1 = 2hrs, nudge 2 = 24hrs, nudge 3 = 48hrs
const NUDGE_THRESHOLDS_MS = [
  2 * 60 * 60 * 1000,   // 2 hours
  24 * 60 * 60 * 1000,  // 24 hours
  48 * 60 * 60 * 1000   // 48 hours
];

async function checkInactiveConversations() {
  for (let i = 0; i < NUDGE_THRESHOLDS_MS.length; i++) {
    const threshold = NUDGE_THRESHOLDS_MS[i];
    const inactive = getInactiveConversations(threshold).filter(c => c.nudgesSent === i);

    for (const conv of inactive) {
      try {
        const nudge = await generateNudgeMessage(conv);
        await sendText(conv.phone, nudge);

        conv.nudgesSent = i + 1;
        conv.messages.push({ role: 'assistant', content: nudge, ts: new Date(), isNudge: true });
        setConversation(conv.phone, conv);

        logger.info(`Nudge ${i + 1} sent to ${conv.phone} (${conv.leadName})`);
      } catch (err) {
        logger.error(`Nudge failed for ${conv.phone}`, { err: err.message });
      }
    }
  }
}

module.exports = { checkInactiveConversations };
