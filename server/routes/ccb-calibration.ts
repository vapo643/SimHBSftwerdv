import { Router } from 'express';
import { ccbTestService } from '../services/genericService';
const router = Router();
router.post('/calibrate', async (req, res) => {
  try {
    const result = await ccbTestService.executeOperation('calibrate', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
