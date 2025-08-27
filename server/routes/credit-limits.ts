import { Router } from 'express';
import { simulatorService } from '../services/genericService';
const router = Router();
router.get('/limits', async (req, res) => {
  try {
    const result = await simulatorService.executeOperation('credit_limits', req.query);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
