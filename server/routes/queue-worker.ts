import { Router } from 'express';
import { paymentsService } from '../services/genericService';
const router = Router();
router.post('/worker', async (req, res) => {
  try {
    const result = await paymentsService.executeOperation('queue_worker', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
