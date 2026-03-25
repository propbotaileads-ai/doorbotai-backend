const { MongoClient } = require('mongodb');

let db = null;
let client = null;

async function connectDB() {
  if (db) return db;
  
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('doorbotai');
    console.log('[DoorBot AI] MongoDB connected!');
    
    // Create indexes
    await db.collection('agents').createIndex({ agentId: 1 }, { unique: true });
    await db.collection('leads').createIndex({ agentId: 1 });
    await db.collection('leads').createIndex({ phone: 1 });
    
    return db;
  } catch (err) {
    console.error('[DoorBot AI] MongoDB error:', err.message);
    return null;
  }
}

// AGENT OPERATIONS
async function saveAgent(agentData) {
  const database = await connectDB();
  if (!database) return agentData;
  
  await database.collection('agents').updateOne(
    { agentId: agentData.agentId },
    { $set: { ...agentData, updatedAt: new Date() } },
    { upsert: true }
  );
  return agentData;
}

async function findAgent(agentId) {
  const database = await connectDB();
  if (!database) return null;
  return await database.collection('agents').findOne({ agentId });
}

async function findAllAgents() {
  const database = await connectDB();
  if (!database) return [];
  return await database.collection('agents').find({ active: true }).toArray();
}

// LEAD OPERATIONS
async function saveLead(leadData) {
  const database = await connectDB();
  if (!database) return leadData;
  
  const lead = {
    ...leadData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await database.collection('leads').insertOne(lead);
  return lead;
}

async function findLeadsByAgent(agentId) {
  const database = await connectDB();
  if (!database) return [];
  return await database.collection('leads')
    .find({ agentId })
    .sort({ createdAt: -1 })
    .toArray();
}

async function updateLeadByPhone(phone, updates) {
  const database = await connectDB();
  if (!database) return false;
  
  await database.collection('leads').updateOne(
    { phone },
    { $set: { ...updates, updatedAt: new Date() } }
  );
  return true;
}

// ANALYTICS
async function getAgentStats(agentId) {
  const database = await connectDB();
  if (!database) return {};
  
  const leads = await database.collection('leads').find({ agentId }).toArray();
  const total = leads.length;
  const hot = leads.filter(l => l.status === 'hot').length;
  const warm = leads.filter(l => l.status === 'warm').length;
  const booked = leads.filter(l => l.appointmentDate).length;
  
  return {
    totalLeads: total,
    hotLeads: hot,
    warmLeads: warm,
    appointmentsBooked: booked,
    conversionRate: total > 0 ? Math.round((booked / total) * 100) + '%' : '0%',
  };
}

module.exports = {
  connectDB,
  saveAgent,
  findAgent,
  findAllAgents,
  saveLead,
  findLeadsByAgent,
  updateLeadByPhone,
  getAgentStats,
};
