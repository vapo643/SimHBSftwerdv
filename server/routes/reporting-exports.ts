import { Router } from 'express';
import { reportingService } from '../services/genericService';
const _router = Router();
router.post('/export', async (req, res) => {
  try {
    const _result = await reportingService.executeOperation('export', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
