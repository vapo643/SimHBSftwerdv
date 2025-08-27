import { Router } from 'express';
import { paymentsService } from '../services/genericService';
const router = Router();
router.post('/process', async (req, res) => {
  try {
    const result = await paymentsService.executeOperation('process_payment', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
