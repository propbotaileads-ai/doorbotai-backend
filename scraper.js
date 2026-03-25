const axios = require('axios');

// ============================================================
// CRAIGSLIST SCRAPER — Public housing wanted posts
// ============================================================
async function scrapeCraigslist(city, agentId) {
  const cityMap = {
    'miami': 'miami', 'new york': 'newyork', 'los angeles': 'losangeles',
    'chicago': 'chicago', 'toronto': 'toronto', 'vancouver': 'vancouver',
    'houston': 'houston', 'phoenix': 'phoenix', 'dallas': 'dallas',
    'atlanta': 'atlanta', 'seattle': 'seattle', 'denver': 'denver',
  };

  const citySlug = cityMap[city.toLowerCase()] || city.toLowerCase().replace(/\s/g, '');
  const url = `https://craigslist.org/${citySlug}/search/rea?query=looking+for+home&sort=date`;

  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });

    const leads = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;

    const emails = res.data.match(emailRegex) || [];
    const phones = res.data.match(phoneRegex) || [];

    emails.forEach((email, i) => {
      leads.push({
        email,
        phone: phones[i] || '',
        source: 'craigslist',
        city,
        agentId,
        status: 'new',
      });
    });

    console.log(`Craigslist ${city}: found ${leads.length} leads`);
    return leads;
  } catch (err) {
    console.error('Craigslist scraper error:', err.message);
    return [];
  }
}

// ============================================================
// GOOGLE MAPS SCRAPER — Find buyers searching for homes
// Uses SerpAPI free tier (100 searches/month free)
// ============================================================
async function scrapeGoogleMaps(city, agentId) {
  if (!process.env.SERPAPI_KEY) {
    console.log('SERPAPI_KEY not set — skipping Google Maps');
    return [];
  }

  try {
    const query = `homes for sale ${city} contact agent`;
    const res = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_maps',
        q: query,
        api_key: process.env.SERPAPI_KEY,
      },
      timeout: 10000,
    });

    const leads = [];
    const results = res.data.local_results || [];

    results.forEach(r => {
      if (r.phone) {
        leads.push({
          name: r.title || '',
          phone: r.phone || '',
          email: '',
          source: 'google_maps',
          city,
          agentId,
          status: 'new',
        });
      }
    });

    console.log(`Google Maps ${city}: found ${leads.length} leads`);
    return leads;
  } catch (err) {
    console.error('Google Maps error:', err.message);
    return [];
  }
}

// ============================================================
// REALTOR.COM PUBLIC DIRECTORY — Agent contacts
// ============================================================
async function scrapeRealtorDirectory(city, agentId) {
  try {
    const citySlug = city.toLowerCase().replace(/,?\s+/g, '_');
    const url = `https://www.realtor.com/realestateagents/${citySlug}`;

    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 10000,
    });

    const leads = [];
    const phoneRegex = /(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;
    const phones = res.data.match(phoneRegex) || [];
    const nameRegex = /"name":"([^"]+)"/g;
    let match;
    let i = 0;

    while ((match = nameRegex.exec(res.data)) !== null) {
      if (phones[i]) {
        leads.push({
          name: match[1],
          phone: phones[i],
          source: 'realtor_directory',
          city,
          agentId,
          status: 'new',
        });
        i++;
      }
    }

    console.log(`Realtor.com ${city}: found ${leads.length} contacts`);
    return leads.slice(0, 20);
  } catch (err) {
    console.error('Realtor scraper error:', err.message);
    return [];
  }
}

// ============================================================
// MASTER SCRAPER — Run all sources for an agent
// ============================================================
async function scrapeAllSources(agentId, city) {
  console.log(`Starting scrape for agent ${agentId} in ${city}...`);

  const [craigslistLeads, googleLeads, realtorLeads] = await Promise.allSettled([
    scrapeCraigslist(city, agentId),
    scrapeGoogleMaps(city, agentId),
    scrapeRealtorDirectory(city, agentId),
  ]);

  const allLeads = [
    ...(craigslistLeads.value || []),
    ...(googleLeads.value || []),
    ...(realtorLeads.value || []),
  ];

  // Remove duplicates by phone
  const seen = new Set();
  const uniqueLeads = allLeads.filter(lead => {
    if (!lead.phone || seen.has(lead.phone)) return false;
    seen.add(lead.phone);
    return true;
  });

  console.log(`Total unique leads found: ${uniqueLeads.length}`);
  return uniqueLeads;
}

module.exports = { scrapeAllSources, scrapeCraigslist, scrapeGoogleMaps, scrapeRealtorDirectory };
