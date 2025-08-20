#!/usr/bin/env node

/**
 * ClickSign Token Debug Tool
 * Tests token validity following official documentation
 */

const https = require('https');

const token = process.env.CLICKSIGN_API_TOKEN;

if (!token) {
  console.error('❌ CLICKSIGN_API_TOKEN not found in environment');
  process.exit(1);
}

console.log('🔍 ClickSign Token Debug Report');
console.log('================================');
console.log(`Token: ${token.substring(0, 20)}...`);
console.log(`Token Length: ${token.length}`);
console.log(`Token Format: ${/^[a-f0-9-]+$/.test(token) ? 'Valid UUID format' : 'Invalid format'}`);
console.log('');

// Test 1: Simple GET request as per documentation
console.log('📋 Test 1: GET /api/v3/envelopes (Documentation Method)');
console.log('------------------------------------------------------');

const testUrl = `https://sandbox.clicksign.com/api/v3/envelopes?access_token=${token}`;

const options = {
  headers: {
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json'
  }
};

fetch(testUrl, options)
  .then(response => {
    console.log(`Status: ${response.status} ${response.statusText}`);
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      console.log('❌ Error Response:');
      console.log(JSON.stringify(data, null, 2));
      
      // Analyze the error
      const error = data.errors[0];
      if (error.code === 'unauthorized') {
        console.log('');
        console.log('🚨 DIAGNOSIS: Token Authorization Failed');
        console.log('');
        console.log('Possible causes:');
        console.log('1. Token is expired or invalid');
        console.log('2. User not associated with API (Step 3 from documentation)');
        console.log('3. Account does not have Envelope feature activated');
        console.log('4. Wrong environment (sandbox vs production)');
        console.log('');
        console.log('Solutions:');
        console.log('1. Generate new token at: https://sandbox.clicksign.com');
        console.log('2. Go to Settings > API > Associate user to API');
        console.log('3. Contact ajuda@clicksign.com if envelope not activated');
      }
    } else {
      console.log('✅ Success Response:');
      console.log(JSON.stringify(data, null, 2));
    }
  })
  .catch(error => {
    console.error('❌ Request Error:', error.message);
  });

// Test 2: Alternative authorization method
console.log('');
console.log('📋 Test 2: Authorization header method');
console.log('-------------------------------------');

fetch('https://sandbox.clicksign.com/api/v3/envelopes', {
  headers: {
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    'Authorization': token
  }
})
  .then(response => {
    console.log(`Alternative auth Status: ${response.status} ${response.statusText}`);
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      console.log('❌ Alternative method also failed');
    } else {
      console.log('✅ Alternative method worked!');
    }
  })
  .catch(error => {
    console.error('❌ Alternative method error:', error.message);
  });