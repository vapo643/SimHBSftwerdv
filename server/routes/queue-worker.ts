import { Router } from 'express';
import { paymentsService } from '../services/genericService';
const _router = Router();
router.post('/worker', async (req, res) => {
  try {
    const _result = await paymentsService.executeOperation('queue_worker', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
