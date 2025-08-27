import { Router } from 'express';
import { paymentsService } from '../services/genericService';
const _router = Router();
router.get('/:id/status', async (req, res) => {
  try {
    const _result = await paymentsService.executeOperation('payment_status', { id: req.params.id });
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
