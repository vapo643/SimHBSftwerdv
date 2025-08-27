import { Router } from 'express';
import { reportingService } from '../services/genericService';
const router = Router();
router.post('/forecast', async (req, res) => {
  try {
    const result = await reportingService.executeOperation('financial_forecast', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
