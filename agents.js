const agents = {};

function createAgent(agentData) {
  const { v4: uuidv4 } = require('uuid');
  const agentId = agentData.agentId || uuidv4().split('-')[0];

  agents[agentId] = {
    agentId,
    agentName: agentData.agentName || 'Your Agent',
    botName: agentData.botName || agentData.agentName + ' AI',
    email: agentData.email || '',
    phone: agentData.phone || '',
    city: agentData.city || '',
    propertyTypes: agentData.propertyTypes || 'residential',
    priceRange: agentData.priceRange || 'all ranges',
    tone: agentData.tone || 'Friendly & Approachable',
    calendlyLink: agentData.calendlyLink || '',
    googleSheetId: agentData.googleSheetId || process.env.GOOGLE_SHEETS_ID,
    plan: agentData.plan || 'starter',
    active: true,
    createdAt: new Date().toISOString(),
    leads: [],
  };

  console.log('Agent created:', agentId, agentData.agentName);
  return agents[agentId];
}

function getAgent(agentId) {
  return agents[agentId] || null;
}

function getAllAgents() {
  return Object.values(agents);
}

function updateAgent(agentId, updates) {
  if (agents[agentId]) {
    agents[agentId] = { ...agents[agentId], ...updates };
    return agents[agentId];
  }
  return null;
}

function deactivateAgent(agentId) {
  if (agents[agentId]) {
    agents[agentId].active = false;
    return true;
  }
  return false;
}

module.exports = { createAgent, getAgent, getAllAgents, updateAgent, deactivateAgent };
