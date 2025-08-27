import { Router } from 'express';
import { cacheService } from '../services/genericService';
const _router = Router();
router.get('/stats', async (req, res) => {
  try {
    const _result = await cacheService.executeOperation('cache_stats', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
