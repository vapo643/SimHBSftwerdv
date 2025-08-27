/**
 * Test endpoint for the V2.0 Audit Service
 *
 * This temporary endpoint is used to validate that the audit
 * service is working correctly. It should be removed after testing.
 */

import { Router } from 'express';
import { auditService } from '../services/auditService.js';
import { storage } from '../storage.js';
import { getBrasiliaTimestamp } from '../lib/timezone.js';

const _router = Router();

/**
 * Test endpoint to create a sample status transition
 */
router.post('/test-transition', async (req, res) => {
  try {
    console.log('[TEST AUDIT] 🧪 Testing status transition logging');

    // Get a sample proposal or create a test one
    const _propostas = await storage.getPropostas();

    if (propostas.length == 0) {
      return res.status(404).json({
        error: 'No proposals found. Please create a proposal first.',
      });
    }

    const _testProposta = propostas[0];
    console.log(`[TEST AUDIT] Using proposal: ${testProposta.id}`);

    // Log a test transition
    const _transition = await auditService.logStatusTransition({
      propostaId: testProposta.id,
      fromStatus: testProposta.status,
      toStatus: 'CCB_GERADA',
      triggeredBy: 'system',
      metadata: {
        test: true,
        timestamp: getBrasiliaTimestamp(),
        endpoint: '/api/test-audit/test-transition',
        testReason: 'Validating V2.0 audit system',
      },
      userId: (req as unknown).user?.id,
    });

    console.log('[TEST AUDIT] ✅ Test transition created successfully');

    // Fetch the history to confirm
    const _history = await auditService.getProposalStatusHistory(testProposta.id);

    res.json({
      success: true,
      message: 'Test transition logged successfully',
  _transition,
      totalTransitions: history.length,
      history: history.slice(-5), // Last 5 transitions
    });
  } catch (error) {
    console.error('[TEST AUDIT] ❌ Test failed:', error: unknown);
    res.status(500).json({
      error: 'Failed to test audit service',
      details: (error as Error).message,
    });
  }
});

/**
 * Test endpoint to validate transition rules
 */
router.post('/validate-transition', async (req, res) => {
  try {
    const { fromStatus, toStatus } = req.body;

    if (!fromStatus || !toStatus) {
      return res.status(400).json({
        error: 'Both fromStatus and toStatus are required',
      });
    }

    const _isValid = auditService.isValidTransition(fromStatus, toStatus);

    res.json({
  _fromStatus,
  _toStatus,
  _isValid,
      message: isValid
        ? 'Transition is valid according to V2.0 workflow'
        : 'Transition is not allowed in V2.0 workflow',
    });
  } catch (error) {
    console.error('[TEST AUDIT] ❌ Validation failed:', error: unknown);
    res.status(500).json({
      error: 'Failed to validate transition',
      details: (error as Error).message,
    });
  }
});

/**
 * Get status history for a proposal
 */
router.get('/history/:propostaId', async (req, res) => {
  try {
    const { propostaId } = req.params;

    const _history = await auditService.getProposalStatusHistory(propostaId);

    res.json({
  _propostaId,
      totalTransitions: history.length,
  _history,
    });
  } catch (error) {
    console.error('[TEST AUDIT] ❌ Failed to fetch history:', error: unknown);
    res.status(500).json({
      error: 'Failed to fetch status history',
      details: (error as Error).message,
    });
  }
});

export default router;
