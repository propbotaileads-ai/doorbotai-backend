const express = require('express');
const router = express.Router();
const { createAgent, getAgent, updateAgent, getAllAgents, deactivateAgent } = require('./agents');
const { addLeadToSheet } = require('./sheets');
const { sendHotLeadAlertToAgent } = require('./email');
const { bookAppointment } = require('./calendar');

// ============================================================
// ONBOARDING — Agent signup aur bot training
// ============================================================

// Step 1: Agent create (after payment)
router.post('/onboard', async (req, res) => {
  try {
    const {
      agentName, botName, email, phone,
      city, propertyTypes, priceRange,
      tone, calendlyLink, googleSheetId,
      notificationEmail, language, plan
    } = req.body;

    if (!agentName || !email) {
      return res.status(400).json({ error: 'agentName and email required' });
    }

    const agent = await createAgent({
      agentName,
      botName: botName || agentName + ' AI',
      email,
      phone: phone || '',
      city: city || '',
      propertyTypes: propertyTypes || 'residential',
      priceRange: priceRange || 'all ranges',
      tone: tone || 'Friendly & Approachable',
      calendlyLink: calendlyLink || '',
      googleSheetId: googleSheetId || process.env.GOOGLE_SHEETS_ID,
      notificationEmail: notificationEmail || email,
      language: language || 'English',
      plan: plan || 'starter',
      active: true,
    });

    res.json({
      success: true,
      agentId: agent.agentId,
      embedCode: `<script src="${process.env.BASE_URL}/widget.js" data-agent="${agent.agentId}" defer></script>`,
      landingPage: `${process.env.BASE_URL}/agent/${agent.agentId}`,
      dashboardUrl: `${process.env.BASE_URL}/dashboard/${agent.agentId}`,
      message: 'Bot is live! Copy your embed code.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Update bot training
router.put('/train/:agentId', async (req, res) => {
  try {
    const agent = await updateAgent(req.params.agentId, req.body);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({
      success: true,
      message: 'Bot updated and live instantly!',
      agent,
      embedCode: `<script src="${process.env.BASE_URL}/widget.js" data-agent="${agent.agentId}" defer></script>`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get agent dashboard data
router.get('/dashboard/:agentId', async (req, res) => {
  try {
    const agent = await getAgent(req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    res.json({
      success: true,
      agent: {
        ...agent,
        embedCode: `<script src="${process.env.BASE_URL}/widget.js" data-agent="${agent.agentId}" defer></script>`,
        landingPage: `${process.env.BASE_URL}/agent/${agent.agentId}`,
        facebookWebhook: `${process.env.BASE_URL}/webhook/facebook/${agent.agentId}`,
        googleAdsPage: `${process.env.BASE_URL}/agent/${agent.agentId}`,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DEDICATED LANDING PAGE — Google Ads + Facebook
// ============================================================
router.get('/agent/:agentId', async (req, res) => {
  try {
    const agent = await getAgent(req.params.agentId);
    if (!agent) return res.status(404).send('Agent not found');

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Find Your Dream Home — ${agent.agentName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#080808;color:#F0EDE8;font-family:'DM Sans',sans-serif;font-weight:300;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px;}
    .card{background:#101010;border:1px solid rgba(201,168,76,0.2);max-width:480px;width:100%;padding:48px 40px;}
    .logo{font-family:'Cormorant Garamond',serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#C9A84C;margin-bottom:32px;}
    h1{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:300;line-height:1.2;margin-bottom:12px;}
    h1 em{font-style:normal;color:#C9A84C;}
    .sub{color:#777770;font-size:14px;margin-bottom:32px;line-height:1.7;}
    .form-group{margin-bottom:16px;}
    label{display:block;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#777770;margin-bottom:6px;}
    input,select{width:100%;background:#181818;border:1px solid rgba(201,168,76,0.2);color:#F0EDE8;padding:12px 16px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color 0.2s;}
    input:focus,select:focus{border-color:#C9A84C;}
    input::placeholder{color:#444;}
    .btn{width:100%;background:#C9A84C;color:#080808;border:none;padding:16px;font-size:14px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;font-family:'DM Sans',sans-serif;cursor:pointer;margin-top:8px;transition:background 0.2s;}
    .btn:hover{background:#E8C97A;}
    .trust{display:flex;align-items:center;gap:8px;margin-top:20px;font-size:12px;color:#555;}
    .trust::before{content:'';width:6px;height:6px;border-radius:50%;background:#4CAF7D;flex-shrink:0;}
    .success{display:none;text-align:center;padding:20px 0;}
    .success h2{font-family:'Cormorant Garamond',serif;font-size:28px;color:#C9A84C;margin-bottom:12px;}
    .success p{color:#777770;font-size:14px;line-height:1.7;}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">${agent.botName || agent.agentName + ' AI'}</div>
    <div id="form-section">
      <h1>Find Your <em>Dream Home</em> in ${agent.city || 'Your City'}</h1>
      <p class="sub">Tell us what you're looking for — our AI will match you with the perfect property and set up a call with ${agent.agentName}.</p>
      <form id="lead-form">
        <div class="form-group"><label>Your Name</label><input type="text" id="name" placeholder="John Smith" required/></div>
        <div class="form-group"><label>Phone Number</label><input type="tel" id="phone" placeholder="+1 (305) 555-0100" required/></div>
        <div class="form-group"><label>Email</label><input type="email" id="email" placeholder="john@email.com"/></div>
        <div class="form-group">
          <label>Budget Range</label>
          <select id="budget">
            <option>Under $300K</option>
            <option>$300K – $500K</option>
            <option selected>$500K – $800K</option>
            <option>$800K – $1.2M</option>
            <option>$1.2M+</option>
          </select>
        </div>
        <div class="form-group">
          <label>Looking to</label>
          <select id="type">
            <option>Buy a home</option>
            <option>Sell my home</option>
            <option>Both buy and sell</option>
            <option>Investment property</option>
          </select>
        </div>
        <button type="submit" class="btn">Connect with ${agent.agentName}'s AI →</button>
        <p class="trust">AI responds in under 60 seconds — any time of day</p>
      </form>
    </div>
    <div class="success" id="success-section">
      <h2>You're all set!</h2>
      <p>Check your phone — ${agent.botName || agent.agentName + "'s AI"} will call you in the next 60 seconds!</p>
      <p style="margin-top:12px;">Make sure to answer — it's calling from a US number.</p>
    </div>
  </div>
  <script>
    document.getElementById('lead-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.querySelector('.btn');
      btn.textContent = 'Connecting...';
      btn.disabled = true;

      const data = {
        agentId: '${agent.agentId}',
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        budget: document.getElementById('budget').value,
        buyerSeller: document.getElementById('type').value,
        source: 'landing_page',
      };

      try {
        const res = await fetch('${process.env.BASE_URL}/api/lead/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (result.success) {
          document.getElementById('form-section').style.display = 'none';
          document.getElementById('success-section').style.display = 'block';
        }
      } catch(err) {
        btn.textContent = 'Try Again';
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`);
  } catch (err) {
    res.status(500).send('Error loading page');
  }
});

// ============================================================
// EXISTING LEADS — CSV upload + auto call
// ============================================================
router.post('/existing-leads/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { leads } = req.body;

    const agent = await getAgent(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    let processed = 0;
    let called = 0;

    for (const lead of leads) {
      if (!lead.phone) continue;

      await addLeadToSheet({
        ...lead,
        agentId,
        source: 'existing_leads',
        status: 'reactivating',
      });

      if (lead.phone) {
        const { makeVoiceCall } = require('./bland');
        const callResult = await makeVoiceCall({
          phone: lead.phone,
          agentConfig: agent,
          leadData: { name: lead.name, source: 'existing_leads' },
        });
        if (callResult.success) called++;
      }

      processed++;
      await new Promise(r => setTimeout(r, 1000));
    }

    res.json({
      success: true,
      message: `${processed} leads processed, ${called} calls initiated`,
      processed, called
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// APPOINTMENT BOOKING — from Bland.ai callback
// ============================================================
router.post('/book-appointment', async (req, res) => {
  try {
    const { agentId, leadName, leadPhone, leadEmail, budget, city, appointmentDate } = req.body;

    const agent = await getAgent(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Book in Google Calendar
    const calResult = await bookAppointment({
      agentEmail: agent.email,
      leadName, leadPhone, budget, city,
      appointmentDate,
      calendarId: 'primary',
    });

    // Send hot lead alert
    await sendHotLeadAlertToAgent({
      agentEmail: agent.notificationEmail || agent.email,
      agentName: agent.agentName,
      leadData: { name: leadName, phone: leadPhone, email: leadEmail, budget, city, appointmentDate },
    });

    res.json({ success: true, calendar: calResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
