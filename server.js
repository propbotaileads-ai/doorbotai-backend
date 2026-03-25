require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const { makeVoiceCall } = require('./bland');
const { addLeadToSheet, updateLeadStatus } = require('./sheets');
const { sendLeadEmailToBuyer, sendHotLeadAlertToAgent } = require('./email');
const { createAgent, getAgent, getAllAgents, updateAgent, deactivateAgent } = require('./agents');
const { bookAppointment } = require('./calendar');
const agentRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/api', agentRoutes);

// HEALTH CHECK
app.get('/', (req, res) => {
  res.json({
    status: 'DoorBot AI Backend is live! 🚀',
    tagline: 'We open the door, you close the deal.',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      onboard: 'POST /api/onboard',
      trainBot: 'PUT /api/train/:agentId',
      newLead: 'POST /api/lead/new',
      existingLeads: 'POST /api/existing-leads/:agentId',
      agentPage: 'GET /api/agent/:agentId',
      dashboard: 'GET /api/dashboard/:agentId',
    }
  });
});

// NEW LEAD — central webhook
app.post('/api/lead/new', async (req, res) => {
  try {
    const { agentId, name, phone, email, budget, timeline, city, propertyType, buyerSeller, source } = req.body;
    if (!agentId || !phone) return res.status(400).json({ error: 'agentId and phone required' });

    const agent = getAgent(agentId);
    if (!agent || !agent.active) return res.status(404).json({ error: 'Agent not found or inactive' });

    const leadData = { name, phone, email, budget, timeline, city, propertyType, buyerSeller, status: 'new', source: source || 'website', agentId };
    console.log(`[DoorBot AI] New lead for ${agent.agentName}:`, name, phone);

    await addLeadToSheet({ ...leadData, agentId });

    if (email) {
      const clickToTalkUrl = `${process.env.BASE_URL}/talk/${agentId}?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name || '')}`;
      await sendLeadEmailToBuyer({
        buyerEmail: email,
        buyerName: name,
        agentName: agent.agentName,
        botName: agent.botName,
        clickToTalkUrl,
      });
    }

    res.json({ success: true, message: 'Lead received!' });
  } catch (err) {
    console.error('Lead error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// CLICK TO TALK
app.get('/talk/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { phone, name } = req.query;
    const agent = getAgent(agentId);
    if (!agent) return res.status(404).send('Agent not found');

    const callResult = await makeVoiceCall({
      phone,
      agentConfig: agent,
      leadData: { name, source: 'email_click' },
    });

    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<title>Connecting to ${agent.botName}...</title>
<style>
body{font-family:Arial,sans-serif;background:#080808;color:#F0EDE8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;}
.box{max-width:400px;padding:40px 32px;}
h1{color:#C9A84C;font-size:28px;margin-bottom:16px;font-family:Georgia,serif;}
p{color:#888;font-size:16px;line-height:1.6;}
.pulse{width:60px;height:60px;border-radius:50%;background:#C9A84C;margin:24px auto;animation:pulse 1.5s infinite;}
.brand{font-size:12px;color:#444;margin-top:32px;letter-spacing:0.1em;}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.2);opacity:0.7;}}
</style></head>
<body><div class="box">
<div class="pulse"></div>
<h1>${agent.botName}</h1>
<p>${callResult.success ? 'Calling you now!<br/>Please answer your phone in the next 30 seconds.' : 'Sorry, could not connect. Please try again.'}</p>
<div class="brand">Powered by DoorBot AI</div>
</div></body></html>`);
  } catch (err) {
    res.status(500).send('Error connecting call');
  }
});

// FACEBOOK WEBHOOK
app.get('/webhook/facebook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === 'doorbotai_fb_verify') res.status(200).send(challenge);
  else res.sendStatus(403);
});

app.post('/webhook/facebook/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const body = req.body;
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            const lead = { agentId, name: change.value.name || 'Facebook Lead', phone: change.value.phone || '', email: change.value.email || '', source: 'facebook_ads' };
            if (lead.phone) {
              await addLeadToSheet({ ...lead, status: 'new' });
              const agent = getAgent(agentId);
              if (agent && lead.email) {
                const clickUrl = `${process.env.BASE_URL}/talk/${agentId}?phone=${encodeURIComponent(lead.phone)}&name=${encodeURIComponent(lead.name)}`;
                await sendLeadEmailToBuyer({ buyerEmail: lead.email, buyerName: lead.name, agentName: agent.agentName, botName: agent.botName, clickToTalkUrl: clickUrl });
              }
            }
          }
        }
      }
      res.sendStatus(200);
    } else res.sendStatus(404);
  } catch (err) { res.sendStatus(500); }
});

// BLAND.AI CALLBACK
app.post('/webhook/bland-callback', async (req, res) => {
  try {
    const { call_id, metadata, status, variables } = req.body;
    const agentId = metadata?.agentId;
    const leadPhone = metadata?.leadPhone;
    const leadName = metadata?.leadName;
    if (!agentId || !leadPhone) return res.sendStatus(200);

    const agent = getAgent(agentId);
    if (!agent) return res.sendStatus(200);

    const budget = variables?.budget || '';
    const city = variables?.city || '';
    const propertyType = variables?.property_type || '';
    const appointmentDate = variables?.appointment_date || '';
    const leadStatus = status === 'completed' ? 'hot' : 'warm';

    await updateLeadStatus(leadPhone, leadStatus, appointmentDate);

    if (appointmentDate) {
      await bookAppointment({ agentEmail: agent.email, leadName, leadPhone, budget, city, appointmentDate });
    }

    if (status === 'completed') {
      await sendHotLeadAlertToAgent({
        agentEmail: agent.notificationEmail || agent.email,
        agentName: agent.agentName,
        leadData: { name: leadName, phone: leadPhone, budget, city, propertyType, appointmentDate },
      });
    }
    res.sendStatus(200);
  } catch (err) { res.sendStatus(500); }
});

// LEMON SQUEEZY PAYMENT
app.post('/webhook/payment', async (req, res) => {
  try {
    const event = req.body;
    if (event.meta?.event_name === 'subscription_created') {
      const attrs = event.data?.attributes;
      const custom = attrs?.custom_data || {};
      createAgent({ agentName: custom.agentName || attrs?.user_name || 'New Agent', email: attrs?.user_email || '', plan: custom.plan || 'starter', active: true });
    }
    if (event.meta?.event_name === 'subscription_cancelled') {
      const agentId = event.data?.attributes?.custom_data?.agentId;
      if (agentId) deactivateAgent(agentId);
    }
    res.sendStatus(200);
  } catch (err) { res.sendStatus(500); }
});


// AGENT STATS from MongoDB
app.get('/api/stats/:agentId', async (req, res) => {
  try {
    const { getAgentStats } = require('./database');
    const stats = await getAgentStats(req.params.agentId);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL LEADS for agent from MongoDB
app.get('/api/leads/:agentId', async (req, res) => {
  try {
    const { findLeadsByAgent } = require('./database');
    const leads = await findLeadsByAgent(req.params.agentId);
    res.json({ success: true, leads, total: leads.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SCRAPER ROUTE
app.post('/api/scrape/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = getAgent(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { scrapeAllSources } = require('./scraper');
    scrapeAllSources(agentId, agent.city).then(async leads => {
      let processed = 0;
      for (const lead of leads.slice(0, 50)) {
        await addLeadToSheet({ ...lead, agentId });
        if (lead.email) {
          const url = `${process.env.BASE_URL}/talk/${agentId}?phone=${encodeURIComponent(lead.phone)}`;
          await sendLeadEmailToBuyer({ buyerEmail: lead.email, buyerName: lead.name, agentName: agent.agentName, botName: agent.botName, clickToTalkUrl: url });
        }
        processed++;
      }
      console.log('[DoorBot AI] Scraper done:', processed, 'leads');
    });
    res.json({ success: true, message: 'Scraper started!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// WIDGET
app.get('/widget.js', (req, res) => {
  const agentId = req.query.agent || '';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function() {
  var agentId = '${agentId}' || document.currentScript.getAttribute('data-agent');
  if (!agentId) return;
  var btn = document.createElement('div');
  btn.innerHTML = '💬 Talk to AI Assistant';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#C9A84C;color:#000;padding:14px 20px;border-radius:50px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;cursor:pointer;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
  btn.onclick = function() { window.open('${process.env.BASE_URL}/api/agent/' + agentId, '_blank', 'width=420,height=640'); };
  document.body.appendChild(btn);
})();`);
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   DoorBot AI Backend v2.0 — Live! 🚀    ║
║   We open the door, you close the deal  ║
║   Port: ${PORT}                             ║
╚══════════════════════════════════════════╝`);
});

module.exports = app;
