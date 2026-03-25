const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function addLeadToSheet(leadData) {
  const {
    name, phone, email, budget, timeline,
    city, propertyType, buyerSeller, status,
    appointmentDate, source, agentId
  } = leadData;

  const row = [
    name || '',
    phone || '',
    email || '',
    budget || '',
    timeline || '',
    city || '',
    propertyType || '',
    buyerSeller || '',
    status || 'new',
    appointmentDate || '',
    source || '',
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
    console.log('Lead added to Google Sheets:', name);
    return true;
  } catch (err) {
    console.error('Sheets error:', err.message);
    return false;
  }
}

async function updateLeadStatus(phone, status, appointmentDate) {
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
        console.log('Lead status updated:', phone, status);
        return true;
      }
    }
  } catch (err) {
    console.error('Sheets update error:', err.message);
  }
  return false;
}

module.exports = { addLeadToSheet, updateLeadStatus };
