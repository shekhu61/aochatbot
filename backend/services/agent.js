/**
 * AI Agent Service
 * Uses Claude claude-sonnet-4 to handle conversation logic,
 * lead qualification, and action decisions.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('./logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = (conv) => `You are Aria, a friendly and knowledgeable travel assistant for Adventures Overland (AO) — India's premier overland expedition company. You speak in a warm, helpful tone. Never be pushy or salesy.

## Your job
- Answer questions about the trip the lead enquired about
- Share itinerary details, pricing, inclusions/exclusions
- Qualify the lead (gauge interest level, travel dates, group size, budget)
- Decide when to share a brochure or connect them to a human agent
- Respond in the same language the user writes in (Hindi or English)

## Lead context
- Lead name: ${conv.leadName}
- Trip of interest: ${conv.tripName}
${conv.tripInfo ? `- Trip details: ${JSON.stringify(conv.tripInfo, null, 2)}` : '- Trip details: Not available, use general AO knowledge'}

## Response format
You MUST respond with a valid JSON object only. No preamble, no explanation outside JSON.

{
  "message": "Your reply to the user (plain text, WhatsApp-friendly, use *bold* for emphasis, emoji ok)",
  "action": "none" | "send_brochure" | "connect_agent" | "update_lead_status",
  "leadStatus": "NEW" | "WARM" | "COLD" | "JUNK",
  "leadStatusReason": "brief reason for classification",
  "agentNote": "internal note for the AO team about this lead (optional)"
}

## Lead qualification rules
- WARM: asking about dates, group size, booking process, payment — genuinely interested
- COLD: vague interest, "just checking", "maybe next year", no urgency
- JUNK: wrong number, spam, not interested, abusive
- NEW: first message, not yet qualified

## Action rules
- send_brochure: user asks for more details, itinerary, pricing breakdown, or says "share details"
- connect_agent: user wants to book, pay, or has complex questions beyond general info
- update_lead_status: always include a leadStatus in every response
- never push brochure or agent unsolicited in first message

## Tone
- Friendly, not corporate
- Use the lead's first name naturally
- Keep messages concise — WhatsApp, not email
- If user writes in Hindi, reply in Hindi`;

async function processMessage(conv, userMessage) {
  // Add user message to history
  conv.messages.push({ role: 'user', content: userMessage, ts: new Date() });

  // Build message history for Claude (last 20 messages for context)
  const history = conv.messages.slice(-20).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT(conv),
      messages: history
    });

    const raw = response.content[0].text.trim();

    let parsed;
    try {
      // Strip markdown code fences if present
      const clean = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      logger.error('Failed to parse AI JSON response', { raw });
      parsed = {
        message: raw,
        action: 'none',
        leadStatus: conv.leadStatus || 'NEW',
        leadStatusReason: 'parse error fallback'
      };
    }

    // Add assistant response to history
    conv.messages.push({ role: 'assistant', content: parsed.message, ts: new Date() });

    return parsed;
  } catch (err) {
    logger.error('Claude API error', { err: err.message });
    throw err;
  }
}

async function generateNudgeMessage(conv) {
  const nudgeNum = conv.nudgesSent + 1;
  const prompts = [
    `Generate a short, friendly WhatsApp nudge message for ${conv.leadName} who enquired about ${conv.tripName} but hasn't replied for a couple of hours. One sentence, warm tone, include a simple question to re-engage. Return only the message text.`,
    `Generate a second gentle follow-up for ${conv.leadName} who enquired about ${conv.tripName}. It's been a day. Keep it brief, mention we're here whenever they're ready. Return only the message text.`,
    `Generate a final soft follow-up for ${conv.leadName} about ${conv.tripName}. It's been 2 days. Wish them well and say the team is available anytime. Return only the message text.`
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompts[Math.min(nudgeNum - 1, 2)] }]
  });

  return response.content[0].text.trim();
}

module.exports = { processMessage, generateNudgeMessage };
