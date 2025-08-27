import { Router } from 'express';
import { paymentsService } from '../services/genericService';
const router = Router();
router.get('/queues', async (req, res) => {
  try {
    const result = await paymentsService.executeOperation('queue_management', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
