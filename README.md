# PropBot AI — Backend

Real estate AI voice bot backend — leads pakdo, qualify karo, book karo!

## Quick Deploy — Render pe (Free)

### Step 1 — GitHub pe upload karo
1. GitHub pe new repo banao: `propbot-backend`
2. Ye sab files upload karo
3. Commit karo

### Step 2 — Render pe deploy karo
1. [render.com](https://render.com) pe signup karo
2. "New Web Service" click karo
3. GitHub repo connect karo
4. Environment variables daalo (neeche list hai)
5. Deploy!

### Step 3 — Environment Variables (Render mein daalo)

```
BLAND_API_KEY          = bland.ai se API key
GMAIL_USER             = propbotai.leads@gmail.com
GMAIL_APP_PASSWORD     = Gmail App Password (16 chars)
GOOGLE_SHEETS_ID       = Sheet URL se ID
GOOGLE_SERVICE_ACCOUNT_EMAIL = Google Cloud se
GOOGLE_PRIVATE_KEY     = Google Cloud se
BASE_URL               = https://your-app.onrender.com
LEMONSQUEEZY_WEBHOOK_SECRET = Lemon Squeezy se
```

## API Endpoints

### Lead aaya — kisi bhi source se
```
POST /api/lead/new
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

### Naya agent create karo
```
POST /api/agent/create
{
  "agentName": "James Miller",
  "botName": "James AI",
  "email": "james@realty.com",
  "city": "Miami, FL",
  "propertyTypes": "Single Family, Condos",
  "priceRange": "$500K-$1M",
  "tone": "Friendly & Approachable",
  "calendlyLink": "https://calendly.com/james-miller"
}
```

### Agent config update karo (bot training)
```
PUT /api/agent/:agentId
{ ...updated fields }
```

### Bulk leads upload karo (CSV se)
```
POST /api/leads/bulk
{
  "agentId": "abc123",
  "leads": [
    { "name": "John", "phone": "+1...", "email": "john@..." },
    ...
  ]
}
```

## Webhooks

- `GET/POST /webhook/facebook/:agentId` — Facebook Lead Ads
- `POST /webhook/bland-callback` — Bland.ai call complete
- `POST /webhook/payment` — Lemon Squeezy subscription

## Widget Embed Code (Agent ki website pe)
```html
<script src="https://your-app.onrender.com/widget.js" 
        data-agent="AGENT_ID" defer></script>
```
