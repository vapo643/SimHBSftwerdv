import { Router } from 'express';
import { analyticsService } from '../services/genericService';
const _router = Router();
router.get('/v2/analytics', async (req, res) => {
  try {
    const _result = await analyticsService.executeOperation('analytics', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
