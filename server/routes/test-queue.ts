import { Router } from 'express';
import { testQueueService } from '../services/testService.js';
const _router = Router();
router.post('/enqueue', async (req, res) => {
  try {
    const _result = await testQueueService.executeOperation('enqueue', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
