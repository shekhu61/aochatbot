/**
 * Zoho CRM API service
 * Handles lead status updates and note creation
 */

const axios = require('axios');
const { logger } = require('./logger');

const ZOHO_BASE = 'https://www.zohoapis.in/crm/v2';
let accessToken = null;
let tokenExpiry = 0;

/**
 * Get a fresh Zoho access token using the refresh token flow
 */
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken;

  try {
    const res = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      }
    });
    accessToken = res.data.access_token;
    tokenExpiry = Date.now() + (res.data.expires_in * 1000);
    logger.info('Zoho access token refreshed');
    return accessToken;
  } catch (err) {
    logger.error('Zoho token refresh failed', { err: err.response?.data || err.message });
    throw err;
  }
}

/**
 * Update lead status and add a custom field for AI classification
 */
async function updateLeadStatus(leadId, status, reason, agentNote) {
  if (!leadId) return;
  try {
    const token = await getAccessToken();
    await axios.put(`${ZOHO_BASE}/Leads/${leadId}`, {
      data: [{
        id: leadId,
        Lead_Status: status,
        Description: agentNote ? `[AI Agent] ${agentNote}` : undefined
      }]
    }, {
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' }
    });
    logger.info(`Zoho lead ${leadId} updated to ${status}`);

    // Add a note
    if (agentNote) {
      await addNote(leadId, agentNote, reason);
    }
  } catch (err) {
    logger.error(`Zoho lead update failed for ${leadId}`, { err: err.response?.data || err.message });
  }
}

/**
 * Add a note to a lead
 */
async function addNote(leadId, content, title = 'AI Agent Note') {
  try {
    const token = await getAccessToken();
    await axios.post(`${ZOHO_BASE}/Notes`, {
      data: [{
        Note_Title: title,
        Note_Content: content,
        Parent_Id: leadId,
        se_module: 'Leads'
      }]
    }, {
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    logger.warn(`Zoho note creation failed for lead ${leadId}`);
  }
}

/**
 * Fetch a lead by ID (to get trip name etc)
 */
async function getLead(leadId) {
  try {
    const token = await getAccessToken();
    const res = await axios.get(`${ZOHO_BASE}/Leads/${leadId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    return res.data.data?.[0] || null;
  } catch (err) {
    logger.error(`Zoho getLead failed for ${leadId}`, { err: err.response?.data || err.message });
    return null;
  }
}

module.exports = { updateLeadStatus, addNote, getLead };
