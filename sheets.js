const { google } = require('googleapis');
const db = require('./database');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function addLeadToSheet(leadData) {
  const { name, phone, email, budget, timeline, city, propertyType, buyerSeller, status, source, agentId } = leadData;

  // Save to MongoDB first
  await db.saveLead({
    name, phone, email, budget, timeline,
    city, propertyType, buyerSeller,
    status: status || 'new',
    source: source || 'website',
    agentId,
    createdAt: new Date(),
  });

  // Save to Google Sheets
  const row = [
    name || '', phone || '', email || '',
    budget || '', timeline || '', city || '',
    propertyType || '', buyerSeller || '',
    status || 'new', '', source || '',
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
    agentId || ''
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:M',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });
    console.log('[DoorBot AI] Lead saved to Sheets:', name);
    return true;
  } catch (err) {
    console.error('Sheets error:', err.message);
    return false;
  }
}

async function updateLeadStatus(phone, status, appointmentDate) {
  // Update MongoDB
  await db.updateLeadByPhone(phone, { status, appointmentDate });

  // Update Google Sheets
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:M',
    });

    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] === phone) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          range: `Sheet1!I${i + 1}:J${i + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[status, appointmentDate || '']] },
        });
        return true;
      }
    }
  } catch (err) {
    console.error('Sheets update error:', err.message);
  }
  return false;
}

module.exports = { addLeadToSheet, updateLeadStatus };
