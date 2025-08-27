import { Router } from 'express';
import { interRealtimeService } from '../services/genericService';
const router = Router();
router.get('/status', async (req, res) => {
  try {
    const result = await interRealtimeService.executeOperation('get_status', req.query);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
