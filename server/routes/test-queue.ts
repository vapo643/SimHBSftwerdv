import { Router } from 'express';
import { testQueueService } from '../services/testService.js';
const router = Router();
router.post('/enqueue', async (req, res) => {
  try {
    const result = await testQueueService.executeOperation('enqueue', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
