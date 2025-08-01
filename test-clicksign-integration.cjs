require('dotenv').config();

// Test ClickSign V3 API connection and CCB sending
async function testClickSignIntegration() {
  console.log('🧪 Testing ClickSign V3 Integration...');
  console.log('=====================================\n');

  const apiToken = process.env.CLICKSIGN_API_TOKEN;
  const apiUrl = 'https://sandbox.clicksign.com/api/v3';

  if (!apiToken) {
    console.error('❌ CLICKSIGN_API_TOKEN not found in environment variables');
    return;
  }

  console.log('✅ API Token found:', apiToken.substring(0, 10) + '...');
  console.log('📡 API URL:', apiUrl);

  // Test 1: Check connection
  console.log('\n📋 Test 1: Testing API Connection...');
  try {
    const response = await fetch(`${apiUrl}/envelopes?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ API connection successful!');
    } else {
      console.log('❌ API connection failed:', data);
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message);
  }

  // Test 2: Create a test envelope
  console.log('\n📋 Test 2: Creating Test Envelope...');
  try {
    const envelopeData = {
      envelope: {
        name: 'Test CCB Document',
        locale: 'pt-BR',
        auto_close: true,
        deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        sequence_enabled: false,
        block_after_refusal: true
      }
    };

    const response = await fetch(`${apiUrl}/envelopes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(envelopeData)
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok && data.data) {
      console.log('✅ Envelope created successfully!');
      console.log('Envelope ID:', data.data.id);
      return data.data.id;
    } else {
      console.log('❌ Failed to create envelope:', data);
    }
  } catch (error) {
    console.error('❌ Error creating envelope:', error.message);
  }

  // Test 3: Create test signer
  console.log('\n📋 Test 3: Creating Test Signer...');
  try {
    const signerData = {
      signer: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '11999999999',
        documentation: '00000000000' // Test CPF
      }
    };

    const response = await fetch(`${apiUrl}/signers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(signerData)
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok && data.data) {
      console.log('✅ Signer created successfully!');
      console.log('Signer ID:', data.data.id);
      console.log('Request Signature Key:', data.data.request_signature_key);
      
      // Generate sign URL
      const signUrl = `${apiUrl.replace('/api/v3', '')}/sign/${data.data.request_signature_key}`;
      console.log('Sign URL:', signUrl);
    } else {
      console.log('❌ Failed to create signer:', data);
    }
  } catch (error) {
    console.error('❌ Error creating signer:', error.message);
  }

  console.log('\n=====================================');
  console.log('🧪 Test completed!');
}

// Run the test
testClickSignIntegration();