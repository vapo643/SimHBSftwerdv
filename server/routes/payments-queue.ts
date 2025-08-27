import { Router } from 'express';
import { paymentsService } from '../services/genericService';
const router = Router();
router.post('/enqueue', async (req, res) => {
  try {
    const result = await paymentsService.executeOperation('enqueue_payment', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
