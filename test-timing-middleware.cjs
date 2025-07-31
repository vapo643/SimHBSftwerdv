#!/usr/bin/env node

/**
 * Test timing middleware on dedicated test endpoints (no auth required)
 */

const http = require('http');

async function testTimingMiddleware() {
  console.log('🧪 TIMING MIDDLEWARE TEST (No Authentication)');
  console.log('=============================================');
  
  const testEndpoints = [
    { url: 'http://localhost:5000/api/test/timing-valid', description: 'Valid endpoint (with 5ms artificial delay)' },
    { url: 'http://localhost:5000/api/test/timing-invalid', description: 'Invalid endpoint (immediate response)' }
  ];
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    console.log(`Testing: ${endpoint.description}`);
    
    const times = [];
    
    // Run 20 requests to get good timing data
    for (let i = 0; i < 20; i++) {
      try {
        const startTime = process.hrtime.bigint();
        
        const response = await new Promise((resolve, reject) => {
          const req = http.request(endpoint.url, { method: 'GET' }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              const endTime = process.hrtime.bigint();
              const responseTime = Number(endTime - startTime) / 1_000_000;
              resolve({ responseTime, statusCode: res.statusCode });
            });
          });
          
          req.on('error', reject);
          req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
          req.end();
        });
        
        times.push(response.responseTime);
        
        if (i % 5 === 0) process.stdout.write('█');
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`\nError on request ${i}:`, error.message);
      }
    }
    
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const stdDev = Math.sqrt(times.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / times.length);
      
      results.push({
        endpoint: endpoint.description,
        avg,
        min,
        max,
        stdDev,
        count: times.length
      });
      
      console.log(`\n  Completed: ${times.length}/20 requests`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Range: ${min.toFixed(2)}ms - ${max.toFixed(2)}ms`);
      console.log(`  Std Dev: ${stdDev.toFixed(2)}ms`);
      console.log('');
    }
  }
  
  if (results.length === 2) {
    const [validResult, invalidResult] = results;
    const timingDifference = Math.abs(validResult.avg - invalidResult.avg);
    
    console.log('📊 TIMING MIDDLEWARE ANALYSIS');
    console.log('============================');
    console.log(`Valid endpoint average: ${validResult.avg.toFixed(2)}ms`);
    console.log(`Invalid endpoint average: ${invalidResult.avg.toFixed(2)}ms`);
    console.log(`Timing difference: ${timingDifference.toFixed(2)}ms`);
    console.log('');
    
    // Check if timing normalization is working
    const expectedRange = [18, 32]; // 25ms ± 7ms tolerance
    const validInRange = validResult.avg >= expectedRange[0] && validResult.avg <= expectedRange[1];
    const invalidInRange = invalidResult.avg >= expectedRange[0] && invalidResult.avg <= expectedRange[1];
    const timingSecure = timingDifference < 5;
    
    console.log('🔒 MIDDLEWARE EVALUATION');
    console.log('========================');
    
    if (validInRange && invalidInRange && timingSecure) {
      console.log('✅ TIMING MIDDLEWARE: WORKING CORRECTLY');
      console.log('   - Both endpoints normalized to expected range');
      console.log(`   - Timing difference (${timingDifference.toFixed(2)}ms) is secure`);
      console.log('   - Timing attack prevention: ACTIVE');
    } else {
      console.log('❌ TIMING MIDDLEWARE: NEEDS INVESTIGATION');
      if (!validInRange || !invalidInRange) {
        console.log('   - Response times not in expected range (18-32ms)');
      }
      if (!timingSecure) {
        console.log(`   - Timing difference (${timingDifference.toFixed(2)}ms) too large`);
      }
      console.log('   - Check middleware configuration and execution');
    }
    
    console.log('');
    console.log('🎯 EXPECTED BEHAVIOR');
    console.log('==================');
    console.log('- Both endpoints should respond in 18-32ms range');
    console.log('- Timing difference should be < 5ms');
    console.log('- Middleware logs should show timing normalization active');
  }
}

testTimingMiddleware().catch(console.error);