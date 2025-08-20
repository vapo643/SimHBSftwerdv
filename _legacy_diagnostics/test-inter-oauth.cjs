// Test Inter OAuth2 directly
const https = require('https');
const querystring = require('querystring');

// Load environment variables
require('dotenv').config({ path: '.env.development' });

const testOAuth = async () => {
  console.log('Testing Inter OAuth2...');
  
  // Check credentials
  console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
  console.log('CLIENT_SECRET exists:', !!process.env.CLIENT_SECRET);
  console.log('CERTIFICATE exists:', !!process.env.CERTIFICATE);
  console.log('PRIVATE_KEY exists:', !!process.env.PRIVATE_KEY);
  
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    console.error('Missing credentials!');
    return;
  }
  
  // Prepare form data
  const formData = querystring.stringify({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'boleto-cobranca.read boleto-cobranca.write'
  });
  
  console.log('Form data length:', formData.length);
  
  // Format certificates
  let cert = process.env.CERTIFICATE || '';
  let key = process.env.PRIVATE_KEY || '';
  
  // Add line breaks if needed
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
  
  const options = {
    hostname: 'cdpj.partners.bancointer.com.br',
    port: 443,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formData),
      'Accept': 'application/json'
    },
    cert: cert,
    key: key,
    rejectUnauthorized: false
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
      }
    });
  });
  
  req.on('error', (e) => {
    console.error('Request error:', e);
  });
  
  req.write(formData);
  req.end();
};

testOAuth();