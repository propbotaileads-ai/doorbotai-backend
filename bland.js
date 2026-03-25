const axios = require('axios');

async function makeVoiceCall({ phone, agentConfig, leadData }) {
  const {
    agentName,
    botName,
    city,
    propertyTypes,
    priceRange,
    tone,
    calendlyLink,
    agentId
  } = agentConfig;

  const { name, source } = leadData;

  const toneMap = {
    'Friendly & Approachable': 'warm, friendly, and conversational',
    'Professional & Formal': 'professional and formal',
    'Luxury & Exclusive': 'sophisticated, premium, and exclusive',
    'Direct & No-nonsense': 'direct, concise, and efficient',
  };

  const toneDesc = toneMap[tone] || 'warm and professional';

  const task = `You are ${botName || agentName + "'s AI Assistant"}, a real estate AI assistant for ${agentName} — a real estate agent specializing in ${propertyTypes || 'residential properties'} in ${city || 'the local area'} with a price range of ${priceRange || 'various budgets'}.

Your tone should be ${toneDesc}.

Your goal in this call:
1. Greet the lead warmly — if you know their name (${name || 'the caller'}), use it
2. Confirm they are looking for a property
3. Ask qualifying questions one at a time:
   - Are you looking to buy or sell?
   - What type of property? (house, condo, townhome)
   - What is your budget range?
   - Which city or neighborhood?
   - What is your timeline? (1 month, 3 months, 6 months)
   - What is the best time to meet with ${agentName}?
4. If they want to book an appointment, direct them to: ${calendlyLink || 'our website'}
5. Always be helpful — if they say not interested, ask if you can send them listings via email
6. End the call by confirming next steps

Important rules:
- Never be pushy or aggressive
- If they ask a question you cannot answer, say "${agentName} will personally address that when you meet"
- Keep the conversation natural and human-like
- Maximum call duration: 8 minutes

Lead source: ${source || 'website'}`;

  const payload = {
    phone_number: phone,
    task,
    voice: 'maya',
    language: 'en',
    max_duration: 8,
    answered_by_enabled: true,
    wait_for_greeting: true,
    record: true,
    amd: true,
    interruption_threshold: 100,
    temperature: 0.7,
    webhook: `${process.env.BASE_URL}/webhook/bland-callback`,
    metadata: {
      agentId,
      leadPhone: phone,
      leadName: name || '',
    },
  };

  try {
    const res = await axios.post('https://api.bland.ai/v1/calls', payload, {
      headers: {
        authorization: process.env.BLAND_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    console.log('Bland.ai call initiated:', res.data.call_id);
    return { success: true, callId: res.data.call_id };
  } catch (err) {
    console.error('Bland.ai error:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

async function getCallTranscript(callId) {
  try {
    const res = await axios.get(`https://api.bland.ai/v1/calls/${callId}`, {
      headers: { authorization: process.env.BLAND_API_KEY },
    });
    return res.data;
  } catch (err) {
    console.error('Transcript error:', err.message);
    return null;
  }
}

module.exports = { makeVoiceCall, getCallTranscript };
