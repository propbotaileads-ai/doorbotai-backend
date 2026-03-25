const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

async function bookAppointment({ agentEmail, leadName, leadPhone, appointmentDate, city, budget, calendarId }) {
  try {
    const startTime = new Date(appointmentDate);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const event = {
      summary: `🔥 PropBot Lead — ${leadName}`,
      description: `Lead Details:\nName: ${leadName}\nPhone: ${leadPhone}\nBudget: ${budget}\nCity: ${city}\n\nBooked via PropBot AI`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/New_York',
      },
      attendees: [{ email: agentEmail }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const res = await calendar.events.insert({
      calendarId: calendarId || 'primary',
      resource: event,
      sendUpdates: 'all',
    });

    console.log('Calendar event created:', res.data.htmlLink);
    return { success: true, eventLink: res.data.htmlLink, eventId: res.data.id };
  } catch (err) {
    console.error('Calendar error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { bookAppointment };
