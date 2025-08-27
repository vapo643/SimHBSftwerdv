import { Router } from 'express';
import { reportingService } from '../services/genericService';
const _router = Router();
router.get('/metrics', async (req, res) => {
  try {
    const _result = await reportingService.executeOperation('metrics', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
