import { Router } from 'express';
import { analyticsService } from '../services/genericService';
const router = Router();
router.get('/v2/analytics', async (req, res) => {
  try {
    const result = await analyticsService.executeOperation('analytics', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
