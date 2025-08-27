import { Router } from 'express';
import { simulatorService } from '../services/genericService';
const router = Router();
router.post('/advanced-simulate', async (req, res) => {
  try {
    const result = await simulatorService.executeOperation('advanced_simulate', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
