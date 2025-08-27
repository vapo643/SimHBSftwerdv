import { Router } from 'express';
import { integrationTestService } from '../services/genericService';
const router = Router();
router.post('/listen', async (req, res) => {
  try {
    const result = await integrationTestService.executeOperation('event_listener', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
