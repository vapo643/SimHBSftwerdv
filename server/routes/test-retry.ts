/**
 * TEMPORARY TEST ENDPOINT FOR RETRY VALIDATION
 * This file should be removed after testing Phase 1.4
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { queues } from '../lib/queues';
import { defaultJobOptions } from '../worker';

const router = Router();

/**
 * Test endpoint to simulate job failure and validate retry mechanism
 * POST /api/test/retry-simulation
 */
router.post('/retry-simulation', async (req: Request, res: Response) => {
  try {
    console.log('[TEST RETRY] 🧪 Adding test job to simulate retry behavior...');
    console.log('[TEST RETRY] 📋 Configuration:');
    console.log('[TEST RETRY]   - Max attempts: 5');
    console.log('[TEST RETRY]   - Backoff type: Exponential');
    console.log('[TEST RETRY]   - Delays: 10s → 20s → 40s → 80s → 160s');
    
    // Add a test job that will always fail
    const job = await queues.pdfProcessing.add(
      'TEST_RETRY',
      {
        type: 'TEST_RETRY',
        alwaysFail: true,
        testDescription: 'This job is designed to fail to test retry mechanism',
        timestamp: new Date().toISOString()
      },
      defaultJobOptions
    );
    
    console.log(`[TEST RETRY] ✅ Test job ${job.id} added to pdf-processing queue`);
    console.log(`[TEST RETRY] 📊 Monitor logs in worker process to see retry attempts`);
    
    return res.json({
      success: true,
      message: 'Test job added to queue - check worker logs for retry behavior',
      jobId: job.id,
      queue: 'pdf-processing',
      expectedBehavior: {
        totalAttempts: 5,
        delays: ['10s', '20s', '40s', '80s', '160s'],
        totalTime: '310s (~5 minutes)',
        finalStatus: 'failed (after 5 attempts)',
        logsToExpect: [
          'Job failed - Attempt 1/5',
          'Job failed - Attempt 2/5 (retry after 10s)',
          'Job failed - Attempt 3/5 (retry after 20s)',
          'Job failed - Attempt 4/5 (retry after 40s)',
          'Job failed - Attempt 5/5 (retry after 80s)',
          'Job permanently failed after 5 attempts'
        ]
      },
      instructions: 'Check the worker console output to validate retry behavior'
    });
  } catch (error: any) {
    console.error('[TEST RETRY] ❌ Error creating test job:', error);
    return res.status(500).json({ 
      error: 'Failed to create test job',
      message: error.message 
    });
  }
});

/**
 * Alternative test for boleto-sync queue
 * POST /api/test/retry-boleto
 */
router.post('/retry-boleto', async (req: Request, res: Response) => {
  try {
    console.log('[TEST RETRY BOLETO] 🧪 Adding test job to boleto-sync queue...');
    
    // Add a test job that will always fail
    const job = await queues.boletoSync.add(
      'TEST_RETRY_BOLETO',
      {
        type: 'TEST_RETRY_BOLETO',
        alwaysFail: true,
        testDescription: 'Testing retry mechanism for boleto-sync queue',
        timestamp: new Date().toISOString()
      },
      defaultJobOptions
    );
    
    console.log(`[TEST RETRY BOLETO] ✅ Test job ${job.id} added to boleto-sync queue`);
    
    return res.json({
      success: true,
      message: 'Test job added to boleto-sync queue',
      jobId: job.id,
      queue: 'boleto-sync',
      instructions: 'Monitor worker logs to see retry attempts with exponential backoff'
    });
  } catch (error: any) {
    console.error('[TEST RETRY BOLETO] ❌ Error:', error);
    return res.status(500).json({ 
      error: 'Failed to create test job',
      message: error.message 
    });
  }
});

export default router;