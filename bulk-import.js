const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const API_URL = 'http://localhost:3000/api'; // Change this to your API URL
const INPUT_FILE = 'music-data.json';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function getTitleFromUrl(url) {
  try {
    if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
      const data = await makeRequest(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      return data.title || null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching title:', error);
    return null;
  }
}

async function processData(data) {
  const items = [];
  let processed = 0;
  const total = data.length;
  
  for (const item of data) {
    processed++;
    console.log(`Processing item ${processed}/${total}`);
    
    // Skip if already has all required fields
    if (item.url && item.title && item.sharedBy && item.sharedAt) {
      items.push(item);
      continue;
    }

    // If missing title, try to fetch it
    if (!item.title) {
      const title = await getTitleFromUrl(item.url);
      if (title) {
        item.title = title;
      } else {
        console.log(`Could not fetch title for: ${item.url}`);
        continue; // Skip this item if we can't get a title
      }
    }

    // Ensure sharedAt is a valid date
    if (item.sharedAt) {
      const date = new Date(item.sharedAt);
      if (isNaN(date.getTime())) {
        console.log(`Invalid date for: ${item.url}`);
        continue; // Skip this item if the date is invalid
      }
      item.sharedAt = date;
    }

    // Only add if we have all required fields
    if (item.url && item.title && item.sharedBy && item.sharedAt) {
      items.push(item);
    }
  }

  return items;
}

function makePostRequest(url, data) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

async function importData() {
  try {
    // Read and parse the input file
    console.log('Reading input file...');
    const rawData = fs.readFileSync(path.join(__dirname, INPUT_FILE), 'utf8');
    const data = JSON.parse(rawData);
    console.log(`Found ${data.length} items in input file`);

    // Process the data
    console.log('Processing data...');
    const items = await processData(data);
    console.log(`Processed ${items.length} valid items`);

    if (items.length === 0) {
      console.log('No valid items to import');
      return;
    }

    // Import the data
    console.log('Importing data...');
    const result = await makePostRequest(`${API_URL}/music/bulk`, { items });
    console.log('Import results:', result);
  } catch (error) {
    console.error('Error importing data:', error);
    if (error.code === 'ENOENT') {
      console.error(`Could not find file: ${INPUT_FILE}`);
      console.error('Please make sure the file exists and has the correct name');
    }
  }
}

importData();
