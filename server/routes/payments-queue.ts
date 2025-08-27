import { Router } from 'express';
import { paymentsService } from '../services/genericService';
const _router = Router();
router.post('/enqueue', async (req, res) => {
  try {
    const _result = await paymentsService.executeOperation('enqueue_payment', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
