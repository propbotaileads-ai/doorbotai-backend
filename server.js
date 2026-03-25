require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const { makeVoiceCall, getCallTranscript } = require('./services/bland');
const { addLeadToSheet, updateLeadStatus } = require('./services/sheets');
const { sendLeadEmailToBuyer, sendHotLeadAlertToAgent } = require('./services/email');
const { createAgent, getAgent, getAllAgents, updateAgent, deactivateAgent } = require('./services/agents');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status: 'PropBot AI Backend is live!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// AGENT ROUTES
// ============================================================

// Create new agent (called after Lemon Squeezy payment)
app.post('/api/agent/create', async (req, res) => {
  try {
    const agent = createAgent(req.body);
    res.json({ success: true, agent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get agent config (for dashboard)
app.get('/api/agent/:agentId', (req, res) => {
  const agent = getAgent(req.params.agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({ success: true, agent });
});

// Update agent config (bot training)
app.put('/api/agent/:agentId', (req, res) => {
  const updated = updateAgent(req.params.agentId, req.body);
  if (!updated) return res.status(404).json({ error: 'Agent not found' });
  res.json({ success: true, agent: updated });
});

// ============================================================
// LEAD ROUTES — MAIN FLOW
// ============================================================

// NEW LEAD — from website form, Facebook, Zillow, or CSV upload
// This is the central webhook — all sources send leads here
app.post('/api/lead/new', async (req, res) => {
  try {
    const {
      agentId,
      name,
      phone,
      email,
      budget,
      timeline,
      city,
      propertyType,
      buyerSeller,
      source,
    } = req.body;

    if (!agentId || !phone) {
      return res.status(400).json({ error: 'agentId and phone are required' });
    }

    const agent = getAgent(agentId);
    if (!agent || !agent.active) {
      return res.status(404).json({ error: 'Agent not found or inactive' });
    }

    const leadData = {
      name, phone, email, budget, timeline,
      city, propertyType, buyerSeller,
      status: 'new', source: source || 'website',
      agentId,
    };

    console.log(`New lead received for agent ${agent.agentName}:`, name, phone);

    // Step 1: Add to Google Sheets immediately
    await addLeadToSheet({ ...leadData, agentId });

    // Step 2: Send email to buyer with "Click to Talk" button
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

    res.json({ success: true, message: 'Lead received, email sent to buyer' });

  } catch (err) {
    console.error('Lead error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// CLICK TO TALK — buyer clicked the email button, initiate Bland.ai call
app.get('/talk/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { phone, name } = req.query;

    const agent = getAgent(agentId);
    if (!agent) {
      return res.status(404).send('Agent not found');
    }

    // Initiate voice call via Bland.ai
    const callResult = await makeVoiceCall({
      phone,
      agentConfig: agent,
      leadData: { name, source: 'email_click' },
    });

    if (callResult.success) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Connecting you to ${agent.botName}...</title>
          <style>
            body { font-family: Arial, sans-serif; background: #0A0A0A; color: #F0EDE8; 
                   display: flex; align-items: center; justify-content: center; 
                   min-height: 100vh; margin: 0; text-align: center; }
            .box { max-width: 400px; padding: 40px 32px; }
            h1 { color: #C9A84C; font-size: 28px; margin-bottom: 16px; }
            p { color: #888; font-size: 16px; line-height: 1.6; }
            .pulse { width: 60px; height: 60px; border-radius: 50%; background: #C9A84C;
                     margin: 24px auto; animation: pulse 1.5s infinite; }
            @keyframes pulse { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.2);opacity:0.7;} }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="pulse"></div>
            <h1>${agent.botName}</h1>
            <p>Connecting you now...<br/>Please answer your phone in the next 30 seconds!</p>
            <p style="margin-top:24px;font-size:14px;">Powered by PropBot AI</p>
          </div>
        </body>
        </html>
      `);
    } else {
      res.send(`
        <html><body style="font-family:Arial;text-align:center;padding:40px;">
          <h2>Sorry, we couldn't connect right now.</h2>
          <p>Please try again or contact ${agent.agentName} directly.</p>
        </body></html>
      `);
    }
  } catch (err) {
    console.error('Talk route error:', err.message);
    res.status(500).send('Error connecting call');
  }
});

// FACEBOOK LEAD ADS WEBHOOK
app.get('/webhook/facebook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === 'propbot_fb_verify') {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook/facebook/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const body = req.body;

    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id;
            console.log('Facebook lead received:', leadgenId, 'for agent:', agentId);

            // In production: fetch lead details from Facebook Graph API
            // For now, trigger with available data
            const mockLead = {
              agentId,
              name: 'Facebook Lead',
              phone: change.value.phone || '',
              email: change.value.email || '',
              source: 'facebook_ads',
            };

            if (mockLead.phone || mockLead.email) {
              await fetch(`${process.env.BASE_URL}/api/lead/new`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mockLead),
              });
            }
          }
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('Facebook webhook error:', err.message);
    res.sendStatus(500);
  }
});

// BLAND.AI CALLBACK — called after voice call ends
app.post('/webhook/bland-callback', async (req, res) => {
  try {
    const { call_id, metadata, status, variables } = req.body;

    console.log('Bland.ai callback received:', call_id, status);

    const agentId = metadata?.agentId;
    const leadPhone = metadata?.leadPhone;
    const leadName = metadata?.leadName;

    if (!agentId || !leadPhone) {
      return res.sendStatus(200);
    }

    const agent = getAgent(agentId);
    if (!agent) return res.sendStatus(200);

    // Extract data from call variables (what AI collected)
    const budget = variables?.budget || '';
    const timeline = variables?.timeline || '';
    const city = variables?.city || variables?.neighborhood || '';
    const propertyType = variables?.property_type || '';
    const appointmentDate = variables?.appointment_date || '';
    const callStatus = status === 'completed' ? 'hot' : 'warm';

    // Update lead status in Google Sheets
    await updateLeadStatus(leadPhone, callStatus, appointmentDate);

    // Send hot lead alert to agent
    if (status === 'completed') {
      await sendHotLeadAlertToAgent({
        agentEmail: agent.email,
        agentName: agent.agentName,
        leadData: {
          name: leadName,
          phone: leadPhone,
          budget,
          timeline,
          city,
          propertyType,
          appointmentDate,
        },
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Bland callback error:', err.message);
    res.sendStatus(500);
  }
});

// CSV UPLOAD — old leads reactivation
app.post('/api/leads/bulk', async (req, res) => {
  try {
    const { agentId, leads } = req.body;

    if (!agentId || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'agentId and leads array required' });
    }

    const agent = getAgent(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    let processed = 0;
    const results = [];

    for (const lead of leads) {
      if (!lead.phone) continue;

      // Add to sheets
      await addLeadToSheet({
        ...lead,
        agentId,
        source: 'csv_upload',
        status: 'new',
      });

      // Send email if available
      if (lead.email) {
        const clickToTalkUrl = `${process.env.BASE_URL}/talk/${agentId}?phone=${encodeURIComponent(lead.phone)}&name=${encodeURIComponent(lead.name || '')}`;
        await sendLeadEmailToBuyer({
          buyerEmail: lead.email,
          buyerName: lead.name,
          agentName: agent.agentName,
          botName: agent.botName,
          clickToTalkUrl,
        });
      }

      processed++;
      results.push({ phone: lead.phone, status: 'processed' });

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }

    res.json({ success: true, processed, results });
  } catch (err) {
    console.error('Bulk leads error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// LEMON SQUEEZY WEBHOOK — auto onboard after payment
app.post('/webhook/payment', async (req, res) => {
  try {
    const event = req.body;

    if (event.meta?.event_name === 'subscription_created') {
      const attrs = event.data?.attributes;
      const customData = attrs?.custom_data || {};

      const newAgent = createAgent({
        agentName: customData.agentName || attrs?.user_name || 'New Agent',
        email: attrs?.user_email || '',
        plan: customData.plan || 'starter',
        active: true,
      });

      console.log('New agent auto-onboarded via payment:', newAgent.agentId);

      // Send welcome email to agent
      // (Add welcome email template here)
    }

    if (event.meta?.event_name === 'subscription_cancelled') {
      const agentId = event.data?.attributes?.custom_data?.agentId;
      if (agentId) {
        deactivateAgent(agentId);
        console.log('Agent deactivated:', agentId);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Payment webhook error:', err.message);
    res.sendStatus(500);
  }
});

// EMBED WIDGET — served to agent websites
app.get('/widget.js', (req, res) => {
  const agentId = req.query.agent || '';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function() {
  var agentId = '${agentId}' || document.currentScript.getAttribute('data-agent');
  if (!agentId) return;

  var btn = document.createElement('div');
  btn.id = 'propbot-widget';
  btn.innerHTML = '💬 Chat with AI Assistant';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#C9A84C;color:#000;padding:14px 20px;border-radius:50px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;cursor:pointer;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.2);';

  btn.onclick = function() {
    var w = window.open('${process.env.BASE_URL}/chat/' + agentId, '_blank', 'width=400,height=600');
  };

  document.body.appendChild(btn);
})();
  `);
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   PropBot AI Backend — Live! 🚀       ║
║   Port: ${PORT}                          ║
║   Ready to capture leads!             ║
╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
