import { Router } from 'express';
import { ccbTestService } from '../services/genericService';
const _router = Router();
router.post('/calibrate', async (req, res) => {
  try {
    const _result = await ccbTestService.executeOperation('calibrate', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
