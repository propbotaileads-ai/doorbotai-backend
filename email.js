const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendLeadEmailToBuyer({ buyerEmail, buyerName, agentName, botName, clickToTalkUrl }) {
  const subject = `${buyerName ? buyerName + ', ' : ''}Talk to ${agentName}'s AI Assistant`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        
        <tr><td style="background:#0A0A0A;padding:28px 40px;">
          <h1 style="color:#C9A84C;font-size:22px;margin:0;font-family:Georgia,serif;">${botName || agentName + ' AI'}</h1>
          <p style="color:#888;font-size:13px;margin:4px 0 0;">Powered by PropBot AI</p>
        </td></tr>

        <tr><td style="padding:36px 40px;">
          <h2 style="color:#111;font-size:20px;margin:0 0 16px;">Hi${buyerName ? ' ' + buyerName : ''}! 👋</h2>
          <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 16px;">
            Thanks for your interest in finding your perfect home! 
            <strong>${agentName}</strong> has set up an AI assistant to help you right away — 
            available 24/7, no waiting.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 28px;">
            Click below to have a quick conversation — the AI will understand your needs, 
            answer your questions, and book a time with ${agentName} if you'd like.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr><td style="background:#C9A84C;border-radius:4px;">
              <a href="${clickToTalkUrl}" 
                 style="display:block;padding:16px 36px;color:#0A0A0A;font-size:15px;font-weight:bold;text-decoration:none;letter-spacing:0.05em;">
                📞 Talk to ${botName || agentName + "'s AI"}
              </a>
            </td></tr>
          </table>

          <p style="color:#888;font-size:13px;text-align:center;margin:0;">
            Takes less than 2 minutes • Available right now
          </p>
        </td></tr>

        <tr><td style="background:#f9f9f9;padding:20px 40px;border-top:1px solid #eee;">
          <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">
            This message was sent on behalf of ${agentName} via PropBot AI.<br/>
            If you did not request this, please ignore.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"${agentName} AI" <${process.env.GMAIL_USER}>`,
      to: buyerEmail,
      subject,
      html,
    });
    console.log('Buyer email sent to:', buyerEmail);
    return true;
  } catch (err) {
    console.error('Email to buyer error:', err.message);
    return false;
  }
}

async function sendHotLeadAlertToAgent({ agentEmail, agentName, leadData }) {
  const { name, phone, email, budget, city, timeline, propertyType, appointmentDate } = leadData;

  const subject = `🔥 Hot Lead Booked! ${name} — ${budget} — ${city}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        
        <tr><td style="background:#0A0A0A;padding:28px 40px;">
          <h1 style="color:#C9A84C;font-size:22px;margin:0;font-family:Georgia,serif;">🔥 Hot Lead Alert!</h1>
          <p style="color:#888;font-size:13px;margin:4px 0 0;">PropBot AI — ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
        </td></tr>

        <tr><td style="padding:36px 40px;">
          <p style="color:#444;font-size:15px;margin:0 0 24px;">
            Hi <strong>${agentName}</strong>! Your AI just booked a new appointment. Here are the details:
          </p>

          <table width="100%" cellpadding="12" cellspacing="0" style="background:#f9f9f9;border-radius:6px;margin-bottom:24px;">
            <tr><td style="border-bottom:1px solid #eee;"><strong style="color:#888;font-size:12px;text-transform:uppercase;">Name</strong><br/><span style="color:#111;font-size:15px;">${name || 'N/A'}</span></td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong style="color:#888;font-size:12px;text-transform:uppercase;">Phone</strong><br/><span style="color:#C9A84C;font-size:15px;">${phone || 'N/A'}</span></td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong style="color:#888;font-size:12px;text-transform:uppercase;">Email</strong><br/><span style="color:#111;font-size:15px;">${email || 'N/A'}</span></td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong style="color:#888;font-size:12px;text-transform:uppercase;">Budget</strong><br/><span style="color:#111;font-size:15px;">${budget || 'N/A'}</span></td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong style="color:#888;font-size:12px;text-transform:uppercase;">City</strong><br/><span style="color:#111;font-size:15px;">${city || 'N/A'}</span></td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong style="color:#888;font-size:12px;text-transform:uppercase;">Timeline</strong><br/><span style="color:#111;font-size:15px;">${timeline || 'N/A'}</span></td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong style="color:#888;font-size:12px;text-transform:uppercase;">Looking For</strong><br/><span style="color:#111;font-size:15px;">${propertyType || 'N/A'}</span></td></tr>
            <tr><td><strong style="color:#888;font-size:12px;text-transform:uppercase;">Appointment</strong><br/><span style="color:#C9A84C;font-size:16px;font-weight:bold;">${appointmentDate || 'To be confirmed'}</span></td></tr>
          </table>

          <p style="color:#888;font-size:13px;text-align:center;margin:0;">
            Log in to your PropBot dashboard to see full lead details and conversation transcript.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"PropBot AI" <${process.env.GMAIL_USER}>`,
      to: agentEmail,
      subject,
      html,
    });
    console.log('Hot lead alert sent to agent:', agentEmail);
    return true;
  } catch (err) {
    console.error('Email to agent error:', err.message);
    return false;
  }
}

module.exports = { sendLeadEmailToBuyer, sendHotLeadAlertToAgent };
