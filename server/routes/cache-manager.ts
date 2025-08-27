import { Router } from 'express';
import { cacheService } from '../services/genericService';
const _router = Router();
router.post('/clear', async (req, res) => {
  try {
    const _result = await cacheService.executeOperation('clear_cache', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
