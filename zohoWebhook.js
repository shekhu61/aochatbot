/**
 * Zoho Webhook — receives new lead notifications
 * Set this URL in Zoho CRM > Setup > Automation > Webhooks
 * POST to: https://your-server.com/webhook/zoho
 */

const { createConversation, getConversation } = require('../services/store');
const { sendLeadTemplate } = require('../services/whatsapp');
const { logger } = require('../services/logger');

module.exports = async (req, res) => {
  res.sendStatus(200);

  try {
    const data = req.body;
    logger.info('Zoho lead webhook received', { data: JSON.stringify(data).substring(0, 200) });

    // Zoho sends: { leadId, firstName, lastName, phone, mobile, tripName (custom field), email }
    const leadId = data.leadId || data.id || data.Lead_ID;
    const firstName = data.firstName || data.First_Name || '';
    const lastName = data.lastName || data.Last_Name || '';
    const leadName = `${firstName} ${lastName}`.trim() || 'there';

    // Phone: prefer mobile, clean to E.164
    let phone = (data.mobile || data.Mobile || data.phone || data.Phone || '').toString().replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '91' + phone.slice(1);
    if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;

    // Trip name from custom field — adjust field name to match your Zoho setup
    const tripName = data.tripName || data.Trip_Name || data.CF_Trip_Name || 'your selected trip';

    if (!phone || phone.length < 10) {
      logger.warn('Zoho webhook: no valid phone number', { data });
      return;
    }

    // Don't create duplicate conversations
    if (getConversation(phone)) {
      logger.info(`Conversation already exists for ${phone}, skipping`);
      return;
    }

    // Create conversation with context
    createConversation(phone, { leadId, leadName, tripName });

    // Send initial WhatsApp template message
    await sendLeadTemplate(phone, firstName || leadName, tripName);
    logger.info(`Lead ${leadName} (${tripName}) initiated on WhatsApp: ${phone}`);

  } catch (err) {
    logger.error('Zoho webhook error', { err: err.message });
  }
};
