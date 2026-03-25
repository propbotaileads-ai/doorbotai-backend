# PropBot AI — Real Estate Lead Voice Bot

> *"We find leads, call them, qualify them, and book appointments — your agent just shows up."*

---

## What is PropBot AI?

PropBot AI is a fully automated real estate lead generation and qualification system. It finds buyer/seller leads from multiple sources, calls them via AI voice, qualifies them, books appointments, and notifies the agent — all automatically, 24/7.

**No manual work. No missed leads. No excuses.**

---

## How It Works

```
Lead comes in (website / Facebook / Google Ads / existing list)
        ↓
Instant email sent to lead — "Talk to [Agent Name] AI"
        ↓
Lead clicks → Bland.ai voice call connects
        ↓
AI qualifies: budget, timeline, city, property type
        ↓
Appointment booked via Calendly
        ↓
Google Sheets updated + Google Calendar blocked
        ↓
Agent gets email: "Hot lead booked! Sarah — $650K — Tuesday 2pm"
```

---

## Features

| Feature | Status |
|---------|--------|
| Voice AI (Bland.ai) | ✅ |
| Multi-source leads | ✅ |
| Google Sheets sync | ✅ |
| Google Calendar booking | ✅ |
| Agent email alerts | ✅ |
| Custom bot name & training | ✅ |
| Dedicated landing page | ✅ |
| Facebook Lead Ads webhook | ✅ |
| Existing leads reactivation | ✅ |
| Lead scraper (Craigslist + Realtor) | ✅ |
| Agent dashboard | ✅ |
| Payment via Lemon Squeezy | ✅ |

---

## Lead Sources

1. **Website form/chat widget** — 1 line embed code
2. **Facebook Lead Ads** — dashboard se 1 click connect
3. **Google Ads** — dedicated landing page per agent
4. **Existing leads** — CSV upload, bot reactivates them
5. **Craigslist + Realtor.com** — auto scraping

---

## Pricing

| Plan | Setup | Monthly |
|------|-------|---------|
| Starter | $100 | $149/mo |
| Professional | $100 | $299/mo |
| Done For You | $100 | $599/mo |

---

## Tech Stack

| Service | Purpose | Cost |
|---------|---------|------|
| Node.js + Express | Backend server | Free |
| Bland.ai | Voice AI calls | $0.09/min |
| Google Sheets API | Lead database | Free |
| Google Calendar API | Appointment booking | Free |
| Gmail SMTP | Email notifications | Free |
| Render | Hosting | Free tier |
| Lemon Squeezy | Payments | 5% + $0.50 |

---

## Project Structure

```
propbot-backend/
├── server.js                 ← Main Express server
├── dashboard.html            ← Agent dashboard UI
├── package.json
├── render.yaml               ← Render deploy config
└── services/
    ├── bland.js              ← Voice calling (Bland.ai)
    ├── email.js              ← Email notifications
    ├── sheets.js             ← Google Sheets sync
    ├── calendar.js           ← Google Calendar booking
    ├── agents.js             ← Agent database
    ├── routes.js             ← Onboarding + landing pages
    └── scraper.js            ← Lead scraper
```

---

## Deploy on Render (Free)

### Step 1 — GitHub
```
1. Create new repo: propbot-backend
2. Upload all files (keep services/ folder structure)
3. Commit
```

### Step 2 — Render
```
1. render.com → New Web Service
2. Connect GitHub repo
3. Settings:
   - Runtime: Node
   - Build: npm install
   - Start: node server.js
   - Plan: Free
```

### Step 3 — Environment Variables
Add these in Render → Environment tab:

```env
BLAND_API_KEY=your_bland_api_key
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your_16_digit_app_password
GOOGLE_SHEETS_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
BASE_URL=https://your-app.onrender.com
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret
```

### Step 4 — Deploy!
Render auto-deploys on every GitHub commit.

---

## API Endpoints

### Create Agent (after payment)
```http
POST /api/onboard
Content-Type: application/json

{
  "agentName": "James Miller",
  "botName": "James AI",
  "email": "james@realty.com",
  "city": "Miami, FL",
  "propertyTypes": "Single Family, Condos",
  "priceRange": "$500K - $1M",
  "tone": "Friendly & Approachable",
  "calendlyLink": "https://calendly.com/james",
  "plan": "professional"
}
```

### New Lead (from any source)
```http
POST /api/lead/new
Content-Type: application/json

{
  "agentId": "abc123",
  "name": "Sarah Johnson",
  "phone": "+13054417823",
  "email": "sarah@gmail.com",
  "budget": "$600K-$800K",
  "city": "Miami",
  "source": "website"
}
```

### Update Bot Training
```http
PUT /api/train/:agentId
Content-Type: application/json

{
  "botName": "James AI",
  "city": "Miami, Fort Lauderdale",
  "tone": "Luxury & Exclusive"
}
```

### Upload Existing Leads
```http
POST /api/existing-leads/:agentId
Content-Type: application/json

{
  "leads": [
    { "name": "John", "phone": "+1...", "email": "john@..." },
    ...
  ]
}
```

### Run Lead Scraper
```http
POST /api/scrape/:agentId
```

---

## Webhooks

| Webhook | URL |
|---------|-----|
| Facebook Lead Ads | `POST /webhook/facebook/:agentId` |
| Bland.ai call complete | `POST /webhook/bland-callback` |
| Lemon Squeezy payment | `POST /webhook/payment` |
| Facebook verification | `GET /webhook/facebook` |

---

## Agent Dashboard

Open `dashboard.html` in browser with agent ID:

```
dashboard.html?agent=YOUR_AGENT_ID
```

**Dashboard features:**
- Overview — leads, appointments, stats
- All Leads — table with hot/warm/cold badges
- Appointments — upcoming bookings
- Lead Sources — connect Facebook, Google Ads, upload CSV
- Train Bot — customize name, city, tone, FAQs
- Embed & Connect — get embed code + landing page URL
- Analytics — conversion rates, peak hours, source breakdown

---

## Embed Code (for agent website)

```html
<script src="https://your-app.onrender.com/widget.js" 
        data-agent="AGENT_ID" defer></script>
```

Works on WordPress, Wix, Squarespace, Webflow — anywhere.

---

## Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project: `PropBot`
3. Enable APIs:
   - Google Sheets API
   - Google Calendar API
4. Create Service Account → Download JSON key
5. Share your Google Sheet with service account email (Editor access)

---

## Agent Onboarding (10 min)

```
Agent signs up → pays $100 setup + $299/month
        ↓
Dashboard opens → 5 questions:
  - Name + Bot name
  - City + Property types
  - Price range + Tone
  - Calendly link
  - Notification email
        ↓
Bot trained instantly!
        ↓
Choose lead source:
  1. Copy embed code → paste on website
  2. Connect Facebook ads
  3. Use Google Ads landing page
  4. Upload existing leads CSV
        ↓
BOT IS LIVE ✅
```

---

## Competition

| Product | Price | Voice | No Contract | 10min Setup | Multi-source |
|---------|-------|-------|------------|-------------|--------------|
| Ylopo | $300-1000/mo + $250 setup | ✅ | ❌ | ❌ | ❌ |
| RealtyChatbot | $149 + $995 setup | ❌ | ✅ | ❌ | ❌ |
| **PropBot AI** | **$149-599/mo + $100 setup** | **✅** | **✅** | **✅** | **✅** |

---

## Target Market

- Solo real estate agents (USA + Canada)
- Small brokerages (2-10 agents)
- New agents who want to look professional
- Agents running Facebook/Google ads

**Revenue target:** 100 clients × $299/mo = $29,900/mo

---

Built with ❤️ by PropBot AI
