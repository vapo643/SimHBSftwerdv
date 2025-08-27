import { Router } from 'express';
import { cacheService } from '../services/genericService';
const router = Router();
router.post('/clear', async (req, res) => {
  try {
    const result = await cacheService.executeOperation('clear_cache', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
