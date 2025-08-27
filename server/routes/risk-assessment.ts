import { Router } from 'express';
import { simulatorService } from '../services/genericService';
const router = Router();
router.post('/assess', async (req, res) => {
  try {
    const result = await simulatorService.executeOperation('risk_assessment', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
