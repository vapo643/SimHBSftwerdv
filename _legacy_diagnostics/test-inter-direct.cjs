// Test Inter OAuth2 directly with minimal setup
const https = require('https');
const fs = require('fs');
const path = require('path');

// Direct test with credentials
const CLIENT_ID = '05fc3816-9a8f-4a2d-8b28-277cd3617cc2';
const CLIENT_SECRET = 'bbb82b01-2ca0-407f-a21c-0e1dff659d42';

// Load certificates from environment
require('dotenv').config({ path: '.env.development' });
const CERT = process.env.CERTIFICATE || '';
const KEY = process.env.PRIVATE_KEY || '';

console.log('Testing Inter OAuth2 with minimal setup...');
console.log('CLIENT_ID:', CLIENT_ID);
console.log('CLIENT_SECRET:', CLIENT_SECRET);

// Prepare form data
const params = new URLSearchParams();
params.append('client_id', CLIENT_ID);
params.append('client_secret', CLIENT_SECRET);
params.append('grant_type', 'client_credentials');
params.append('scope', 'boleto-cobranca.read boleto-cobranca.write');

const formData = params.toString();
console.log('Form data:', formData);

// Format certificates if needed
let cert = CERT;
let key = KEY;

if (cert.includes('-----BEGIN CERTIFICATE-----') && !cert.includes('\n')) {
  const certMatch = cert.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
  if (certMatch && certMatch[1]) {
    const base64Content = certMatch[1].trim();
    const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
    cert = `-----BEGIN CERTIFICATE-----\n${formattedContent}\n-----END CERTIFICATE-----`;
  }
}

if (key.includes('-----BEGIN') && key.includes('KEY-----') && !key.includes('\n')) {
  const keyMatch = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
  if (keyMatch && keyMatch[2]) {
    const keyType = keyMatch[1];
    const base64Content = keyMatch[2].trim();
    const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
    key = `-----BEGIN ${keyType}-----\n${formattedContent}\n-----END ${keyType}-----`;
  }
}

console.log('Certificate present:', !!cert);
console.log('Private key present:', !!key);

// Try with Basic Auth instead
const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

const options = {
  hostname: 'cdpj.partners.bancointer.com.br',
  port: 443,
  path: '/oauth/v2/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formData),
    'Accept': 'application/json',
    'Authorization': `Basic ${auth}`
  },
  cert: cert,
  key: key,
  rejectUnauthorized: false // Temporarily disable cert verification for testing
};

console.log('Making request to:', options.hostname + options.path);

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', data);
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log('Success! Token:', json.access_token?.substring(0, 20) + '...');
      } catch (e) {
        console.error('Failed to parse JSON:', e);
      }
    } else {
      console.log('Error: Status', res.statusCode);
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(formData);
req.end();