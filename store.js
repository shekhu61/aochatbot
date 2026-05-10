/**
 * Simple in-memory store for conversations and leads.
 * In production: replace with PostgreSQL via pg or Prisma.
 *
 * Schema:
 * conversations[phone] = {
 *   phone, leadId, leadName, tripName, tripInfo,
 *   status: 'active'|'paused'|'closed',
 *   leadStatus: 'NEW'|'WARM'|'COLD'|'JUNK',
 *   messages: [{ role:'user'|'assistant', content, ts }],
 *   lastMessageAt: Date,
 *   nudgesSent: number,
 *   agentAssigned: null | { name, phone, email }
 * }
 *
 * trips[tripName] = { description, duration, price, highlights, brochureUrl, agentContact }
 */

const conversations = new Map();
const trips = new Map([
  ['Iceland Overland', {
    description: 'A 14-day self-drive expedition across Iceland\'s Ring Road, covering glaciers, geysers, and the Northern Lights.',
    duration: '14 days / 13 nights',
    price: '₹2,45,000 per person (twin sharing)',
    highlights: ['Jökulsárlón Glacier Lagoon', 'Golden Circle', 'Snæfellsnes Peninsula', 'Northern Lights hunt'],
    brochureUrl: process.env.BROCHURE_ICELAND || null,
    agentContact: { name: 'Priya Sharma', phone: '+919811000001', email: 'priya@adventuresoverland.com' }
  }],
  ['Road to London', {
    description: 'The legendary overland drive from India to London — crossing 30+ countries over 70 days.',
    duration: '70 days',
    price: '₹9,50,000 per person',
    highlights: ['Passes through Iran, Turkey, Eastern Europe', 'Season 8 — 2025', 'Fully supported convoy'],
    brochureUrl: process.env.BROCHURE_LONDON || null,
    agentContact: { name: 'Rohit Verma', phone: '+919811000002', email: 'rohit@adventuresoverland.com' }
  }],
  ['Cambodia Overland', {
    description: 'A 10-day overland journey through Cambodia\'s temples, jungles, and river deltas.',
    duration: '10 days / 9 nights',
    price: '₹1,85,000 per person (twin sharing)',
    highlights: ['Angkor Wat sunrise', 'Cardamom Mountains', 'Mekong Delta', 'Local village stays'],
    brochureUrl: process.env.BROCHURE_CAMBODIA || null,
    agentContact: { name: 'Ananya Singh', phone: '+919811000003', email: 'ananya@adventuresoverland.com' }
  }],
  ['Bhutan Overland', {
    description: 'An 8-day road trip through the Kingdom of Bhutan — monasteries, mountain passes, and pristine valleys.',
    duration: '8 days / 7 nights',
    price: '₹1,20,000 per person (twin sharing)',
    highlights: ['Tiger\'s Nest Monastery', 'Dochula Pass', 'Punakha Dzong', 'Haa Valley'],
    brochureUrl: process.env.BROCHURE_BHUTAN || null,
    agentContact: { name: 'Karan Mehta', phone: '+919811000004', email: 'karan@adventuresoverland.com' }
  }],
  ['Japan Overland', {
    description: 'A 12-day road trip across Japan from Tokyo to Hiroshima via the Japanese Alps.',
    duration: '12 days / 11 nights',
    price: '₹3,10,000 per person (twin sharing)',
    highlights: ['Mount Fuji viewpoints', 'Shirakawa-go', 'Kyoto temples', 'Hiroshima Peace Park'],
    brochureUrl: process.env.BROCHURE_JAPAN || null,
    agentContact: { name: 'Meera Joshi', phone: '+919811000005', email: 'meera@adventuresoverland.com' }
  }]
]);

// Stats tracker
const stats = {
  totalLeads: 0,
  warm: 0,
  cold: 0,
  junk: 0,
  messagesHandled: 0,
  brochuresSent: 0,
  agentHandoffs: 0
};

function getConversation(phone) {
  return conversations.get(phone) || null;
}

function setConversation(phone, data) {
  conversations.set(phone, data);
}

function createConversation(phone, leadData) {
  const conv = {
    phone,
    leadId: leadData.leadId,
    leadName: leadData.leadName,
    tripName: leadData.tripName,
    tripInfo: getTripInfo(leadData.tripName),
    status: 'active',
    leadStatus: 'NEW',
    messages: [],
    lastMessageAt: new Date(),
    nudgesSent: 0,
    agentAssigned: null,
    createdAt: new Date(),
    zohoUpdatedAt: null
  };
  conversations.set(phone, conv);
  stats.totalLeads++;
  return conv;
}

function getTripInfo(tripName) {
  // Fuzzy match
  for (const [key, val] of trips.entries()) {
    if (tripName && tripName.toLowerCase().includes(key.toLowerCase())) return { name: key, ...val };
    if (key.toLowerCase().includes((tripName || '').toLowerCase())) return { name: key, ...val };
  }
  return null;
}

function getAllConversations() {
  return Array.from(conversations.values()).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

function getInactiveConversations(thresholdMs) {
  const now = Date.now();
  return Array.from(conversations.values()).filter(c =>
    c.status === 'active' &&
    c.messages.length > 0 &&
    c.nudgesSent < 3 &&
    (now - new Date(c.lastMessageAt).getTime()) > thresholdMs
  );
}

function getAllTrips() {
  return Array.from(trips.entries()).map(([name, data]) => ({ name, ...data }));
}

function upsertTrip(name, data) {
  trips.set(name, { ...trips.get(name), ...data });
}

function getStats() {
  const convs = Array.from(conversations.values());
  return {
    totalLeads: convs.length,
    warm: convs.filter(c => c.leadStatus === 'WARM').length,
    cold: convs.filter(c => c.leadStatus === 'COLD').length,
    junk: convs.filter(c => c.leadStatus === 'JUNK').length,
    active: convs.filter(c => c.status === 'active').length,
    messagesHandled: stats.messagesHandled,
    brochuresSent: stats.brochuresSent,
    agentHandoffs: stats.agentHandoffs
  };
}

module.exports = {
  getConversation, setConversation, createConversation,
  getTripInfo, getAllConversations, getInactiveConversations,
  getAllTrips, upsertTrip, getStats, stats
};
