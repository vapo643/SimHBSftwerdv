/**
 * Job Status Routes - REFACTORED
 * Controller for job status operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { testQueueService } from '../services/testService.js';

const router = Router();

/**
 * GET /api/job-status/:id
 * Get job status
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await testQueueService.executeOperation('get_job_status', {
      jobId: req.params.id,
    });
    res.json(_result);
  }
catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Job status check failed',
    });
  }
});

/**
 * GET /api/job-status
 * List all jobs
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await testQueueService.executeOperation('list_jobs', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Job listing failed',
    });
  }
});

export default router;
