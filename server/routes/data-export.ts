import { Router } from 'express';
import { reportingService } from '../services/genericService';
const router = Router();
router.post('/export', async (req, res) => {
  try {
    const result = await reportingService.executeOperation('data_export', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
