import { Router } from 'express';
import { clicksignService } from '../services/genericService';
const router = Router();
router.post('/integrate', async (req, res) => {
  try {
    const result = await clicksignService.executeOperation('integrate', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
