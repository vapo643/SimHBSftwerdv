#!/usr/bin/env tsx
/**
 * Test FSM Integration After Refactoring
 * Validates that all status transition points are using FSM correctly
 */

import { transitionTo, InvalidTransitionError } from '../services/statusFsmService';

async function testIntegration() {
  console.log('🧪 Testing FSM Integration After Refactoring');
  console.log('='.repeat(50));

  const testCases = [
    {
      name: 'Valid transition: rascunho → aguardando_analise',
      from: 'rascunho',
      to: 'aguardando_analise',
      shouldSucceed: true,
    },
    {
      name: 'Invalid transition: pago → rascunho',
      from: 'pago',
      to: 'rascunho',
      shouldSucceed: false,
    },
    {
      name: 'Valid transition: aprovado → pronto_pagamento',
      from: 'aprovado',
      to: 'pronto_pagamento',
      shouldSucceed: true,
    },
    {
      name: 'Invalid transition: cancelado → aprovado',
      from: 'cancelado',
      to: 'aprovado',
      shouldSucceed: false,
    },
  ];

  let _passed = 0;
  let _failed = 0;

  for (const test of testCases) {
    try {
      // Simulate a transition
      const mockProposal = {
        id: 'test-' + Date.now(),
        status: test.from,
      };

      // Mock the getCurrentStatus function
      const originalGetStatus = (global as unknown).getCurrentStatus;
      (global as unknown).getCurrentStatus = async () => test.from;

      await transitionTo({
        propostaId: mockProposal.id,
        novoStatus: test.to,
        userId: 'test-user',
        contexto: 'geral',
        observacoes: 'Test transition',
      });

      // Restore original function
      (global as unknown).getCurrentStatus = originalGetStatus;

      if (test.shouldSucceed) {
        console.log(`✅ ${test.name}`);
        passed++;
      }
else {
        console.log(`❌ ${test.name} - Expected to fail but succeeded`);
        failed++;
      }
    }
catch (error) {
      if (error instanceof InvalidTransitionError) {
        if (!test.shouldSucceed) {
          console.log(`✅ ${test.name} - Correctly rejected`);
          passed++;
        }
else {
          console.log(`❌ ${test.name} - Unexpected rejection: ${error.message}`);
          failed++;
        }
      }
else {
        console.log(`❌ ${test.name} - Unexpected error: ${error}`);
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  // Check for any remaining updateStatusWithContext usage
  const { execSync } = await import('child_process');

  try {
    const result = execSync(
      'grep -rn "updateStatusWithContext" server --include="*.ts" | grep -v "status-context-helper.ts" | grep -v "statusFsmService.ts" | wc -l',
      { encoding: 'utf-8' }
    ).trim();

    const count = parseInt(_result);

    if (count == 0) {
      console.log('✅ No remaining updateStatusWithContext calls found');
    }
else {
      console.log(`⚠️ Found ${count} remaining updateStatusWithContext calls`);
    }
  }
catch (error) {
    console.log('❌ Error checking for remaining calls:', error);
  }

  console.log('\n🎉 FSM Integration Test Complete!');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run the test
testIntegration().catch (console.error);
