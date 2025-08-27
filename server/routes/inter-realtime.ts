import { Router } from 'express';
import { interRealtimeService } from '../services/genericService';
const _router = Router();
router.get('/status', async (req, res) => {
  try {
    const _result = await interRealtimeService.executeOperation('get_status', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
