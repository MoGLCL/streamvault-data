// Continuous script to fetch data from JSONBin.io and save to accounts.json
const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.jsonbin.io/v3/b/6a4e5dd5da38895dfe40dfff/latest';
const MASTER_KEY = '$2a$10$YaCG.b4SMEWXxOATugwQZepjVZe6SWIe6T5EEqa6veNvtP7VRPZa6';
const INTERVAL_MS = 10000; // Fetches every 10 seconds

async function fetchDataAndSave() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Fetching data from JSONBin...`);
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'X-Master-Key': MASTER_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const record = data.record;
    
    // Save to accounts.json
    const filePath = path.join(__dirname, 'accounts.json');
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    
    const count = record && record.accounts ? record.accounts.length : 0;
    console.log(`[${new Date().toLocaleTimeString()}] Success! Saved ${count} accounts to ${filePath}`);

  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] Error:`, error.message);
  }
}

// Run once immediately
fetchDataAndSave();

// Run periodically
console.log(`Starting continuous fetch loop (Interval: ${INTERVAL_MS / 1000} seconds). Press Ctrl+C to stop.\n`);
setInterval(fetchDataAndSave, INTERVAL_MS);
