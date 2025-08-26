import { Router } from 'express';
import { cacheService } from '../services/genericService';
const router = Router();
router.get('/stats', async (req, res) => {
  try {
    const result = await cacheService.executeOperation('cache_stats', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
