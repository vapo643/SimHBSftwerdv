import { Router } from 'express';
import { testRetryService } from '../services/testService.js';
const _router = Router();
router.post('/retry', async (req, res) => {
  try {
    const _result = await testRetryService.executeOperation('retry', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
