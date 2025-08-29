/**
 * Bull-Board Admin Dashboard Routes
 * Provides web UI for monitoring and managing BullMQ queues
 * 
 * Security: Requires ADMINISTRADOR role access
 * Features: Queue monitoring, job status, worker metrics
 */

import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { requireAdmin } from '../../lib/role-guards';
import { paymentsQueue, webhooksQueue, reportsQueue } from '../../lib/queues';

const router = express.Router();

// Create Bull-Board dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullMQAdapter(paymentsQueue),
    new BullMQAdapter(webhooksQueue), 
    new BullMQAdapter(reportsQueue),
  ],
  serverAdapter: serverAdapter,
});

// Mount the Bull-Board UI with authentication
router.use('/admin/queues', requireAdmin, serverAdapter.getRouter());

// Health endpoint for queue monitoring
router.get('/admin/queues/health', requireAdmin, async (req, res) => {
  try {
    const queueHealths = await Promise.all([
      {
        name: 'payments',
        status: await paymentsQueue.getJobCounts(),
      },
      {
        name: 'webhooks', 
        status: await webhooksQueue.getJobCounts(),
      },
      {
        name: 'reports',
        status: await reportsQueue.getJobCounts(),
      },
    ]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queues: queueHealths,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch queue health',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;