require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const { makeVoiceCall } = require('./services/bland');
const { addLeadToSheet, updateLeadStatus } = require('./services/sheets');
const { sendLeadEmailToBuyer, sendHotLeadAlertToAgent } = require('./services/email');
const { createAgent, getAgent, getAllAgents, updateAgent, deactivateAgent } = require('./services/agents');
const { bookAppointment } = require('./services/calendar');
const agentRoutes = require('./services/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Mount agent routes
app.use('/api', agentRoutes);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status: 'PropBot AI Backend is live! 🚀',
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

// ============================================================
// NEW LEAD — central webhook for all sources
// ============================================================
app.post('/api/lead/new', async (req, res) => {
  try {
    const { agentId, name, phone, email, budget, timeline, city, propertyType, buyerSeller, source } = req.body;

    if (!agentId || !phone) return res.status(400).json({ error: 'agentId and phone required' });

    const agent = getAgent(agentId);
    if (!agent || !agent.active) return res.status(404).json({ error: 'Agent not found or inactive' });

    const leadData = { name, phone, email, budget, timeline, city, propertyType, buyerSeller, status: 'new', source: source || 'website', agentId };

    console.log(`New lead for ${agent.agentName}:`, name, phone);

    // 1. Add to Google Sheets
    await addLeadToSheet({ ...leadData, agentId });

    // 2. Send email to buyer with Click to Talk
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

// ============================================================
// CLICK TO TALK — buyer clicked email button
// ============================================================
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

    res.send(`
      <!DOCTYPE html><html>
      <head><meta charset="UTF-8"/><title>Connecting...</title>
      <style>
        body{font-family:Arial,sans-serif;background:#0A0A0A;color:#F0EDE8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;}
        .box{max-width:400px;padding:40px 32px;}
        h1{color:#C9A84C;font-size:28px;margin-bottom:16px;}
        p{color:#888;font-size:16px;line-height:1.6;}
        .pulse{width:60px;height:60px;border-radius:50%;background:#C9A84C;margin:24px auto;animation:pulse 1.5s infinite;}
        @keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.2);opacity:0.7;}}
      </style></head>
      <body><div class="box">
        <div class="pulse"></div>
        <h1>${agent.botName || agent.agentName + ' AI'}</h1>
        <p>${callResult.success ? 'Calling you now! Answer your phone in 30 seconds.' : 'Sorry, try again shortly.'}</p>
      </div></body></html>
    `);
  } catch (err) {
    res.status(500).send('Error connecting call');
  }
});

// ============================================================
// FACEBOOK LEAD ADS WEBHOOK
// ============================================================
app.get('/webhook/facebook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === 'propbot_fb_verify') {
    res.status(200).send(challenge);
  } else res.sendStatus(403);
});

app.post('/webhook/facebook/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const body = req.body;
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            const lead = {
              agentId,
              name: change.value.name || 'Facebook Lead',
              phone: change.value.phone || '',
              email: change.value.email || '',
              source: 'facebook_ads',
            };
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
  } catch (err) {
    res.sendStatus(500);
  }
});

// ============================================================
// BLAND.AI CALLBACK — after call ends
// ============================================================
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
      await bookAppointment({
        agentEmail: agent.email,
        leadName, leadPhone, budget, city,
        appointmentDate,
      });
    }

    if (status === 'completed') {
      await sendHotLeadAlertToAgent({
        agentEmail: agent.notificationEmail || agent.email,
        agentName: agent.agentName,
        leadData: { name: leadName, phone: leadPhone, budget, city, propertyType, appointmentDate },
      });
    }

    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

// ============================================================
// LEMON SQUEEZY — auto onboard after payment
// ============================================================
app.post('/webhook/payment', async (req, res) => {
  try {
    const event = req.body;
    if (event.meta?.event_name === 'subscription_created') {
      const attrs = event.data?.attributes;
      const custom = attrs?.custom_data || {};
      createAgent({
        agentName: custom.agentName || attrs?.user_name || 'New Agent',
        email: attrs?.user_email || '',
        plan: custom.plan || 'starter',
        active: true,
      });
    }
    if (event.meta?.event_name === 'subscription_cancelled') {
      const agentId = event.data?.attributes?.custom_data?.agentId;
      if (agentId) deactivateAgent(agentId);
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

// ============================================================
// EMBED WIDGET
// ============================================================
app.get('/widget.js', (req, res) => {
  const agentId = req.query.agent || '';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function() {
  var agentId = '${agentId}' || document.currentScript.getAttribute('data-agent');
  if (!agentId) return;
  var btn = document.createElement('div');
  btn.innerHTML = '💬 Chat with AI Assistant';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#C9A84C;color:#000;padding:14px 20px;border-radius:50px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;cursor:pointer;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
  btn.onclick = function() { window.open('${process.env.BASE_URL}/api/agent/' + agentId, '_blank', 'width=420,height=640'); };
  document.body.appendChild(btn);
})();
  `);
});

// ============================================================

// SCRAPER ROUTE
app.post('/api/scrape/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = getAgent(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { scrapeAllSources } = require('./services/scraper');
    scrapeAllSources(agentId, agent.city).then(async leads => {
      let processed = 0;
      for (const lead of leads.slice(0, 50)) {
        await addLeadToSheet({ ...lead, agentId });
        if (lead.email) {
          const url = process.env.BASE_URL + '/talk/' + agentId + '?phone=' + encodeURIComponent(lead.phone);
          await sendLeadEmailToBuyer({ buyerEmail: lead.email, buyerName: lead.name, agentName: agent.agentName, botName: agent.botName, clickToTalkUrl: url });
        }
        processed++;
      }
      console.log('Scraper done:', processed, 'leads processed');
    });
    res.json({ success: true, message: 'Scraper started!', total: 'checking...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// START
// ============================================================
app.listen(PORT, () => {
  console.log(`PropBot AI Backend v2.0 — Live on port ${PORT} 🚀`);
});

module.exports = app;
// Will be appended via patch below
