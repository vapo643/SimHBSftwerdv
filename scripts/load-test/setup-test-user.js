/**
 * Test User Setup Script
 * Creates test user for load testing
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

const TEST_USER = {
  email: 'loadtest@simpix.com',
  password: 'LoadTest123!',
  name: 'Load Test User'
};

async function setupTestUser() {
  try {
    console.log('🔧 Setting up test user for load testing...');
    
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_USER)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Test user created successfully:', data);
      return true;
    } else {
      const error = await response.text();
      console.log('⚠️ User registration response:', response.status, error);
      
      // If user already exists, try to login to verify
      if (response.status === 400 && error.includes('já cadastrado')) {
        console.log('ℹ️ User already exists, verifying login...');
        
        const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: TEST_USER.email,
            password: TEST_USER.password
          })
        });
        
        if (loginResponse.ok) {
          console.log('✅ Test user login verified');
          return true;
        } else {
          console.log('❌ Test user login failed - credentials may have changed');
          return false;
        }
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error setting up test user:', error.message);
    return false;
  }
}

export { setupTestUser, TEST_USER };