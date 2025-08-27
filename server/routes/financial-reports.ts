import { Router } from 'express';
import { reportingService } from '../services/genericService';
const router = Router();
router.get('/financial', async (req, res) => {
  try {
    const result = await reportingService.executeOperation('financial_reports', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
