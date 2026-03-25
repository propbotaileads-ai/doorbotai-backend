const { v4: uuidv4 } = require('uuid');
const db = require('./database');

// In-memory fallback
const agentsCache = {};

async function createAgent(agentData) {
  const agentId = agentData.agentId || uuidv4().split('-')[0];
  
  const agent = {
    agentId,
    agentName: agentData.agentName || 'Your Agent',
    botName: agentData.botName || (agentData.agentName + ' AI'),
    email: agentData.email || '',
    phone: agentData.phone || '',
    city: agentData.city || '',
    propertyTypes: agentData.propertyTypes || 'residential',
    priceRange: agentData.priceRange || 'all ranges',
    tone: agentData.tone || 'Friendly & Approachable',
    calendlyLink: agentData.calendlyLink || '',
    googleSheetId: agentData.googleSheetId || process.env.GOOGLE_SHEETS_ID,
    notificationEmail: agentData.notificationEmail || agentData.email,
    language: agentData.language || 'English',
    about: agentData.about || '',
    faqs: agentData.faqs || '',
    plan: agentData.plan || 'starter',
    active: true,
    createdAt: new Date().toISOString(),
    leads: [],
  };

  // Save to MongoDB
  await db.saveAgent(agent);
  // Also keep in memory cache
  agentsCache[agentId] = agent;
  
  console.log('[DoorBot AI] Agent created:', agentId, agent.agentName);
  return agent;
}

async function getAgent(agentId) {
  // Try cache first
  if (agentsCache[agentId]) return agentsCache[agentId];
  
  // Try MongoDB
  const agent = await db.findAgent(agentId);
  if (agent) {
    agentsCache[agentId] = agent;
    return agent;
  }
  
  return null;
}

async function updateAgent(agentId, updates) {
  const agent = await getAgent(agentId);
  if (!agent) return null;
  
  const updated = { ...agent, ...updates, updatedAt: new Date().toISOString() };
  agentsCache[agentId] = updated;
  await db.saveAgent(updated);
  return updated;
}

async function getAllAgents() {
  return await db.findAllAgents();
}

async function deactivateAgent(agentId) {
  await updateAgent(agentId, { active: false });
  return true;
}

module.exports = { createAgent, getAgent, getAllAgents, updateAgent, deactivateAgent };
