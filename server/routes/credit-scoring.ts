import { Router } from 'express';
import { simulatorService } from '../services/genericService';
const router = Router();
router.post('/score', async (req, res) => {
  try {
    const result = await simulatorService.executeOperation('credit_scoring', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
