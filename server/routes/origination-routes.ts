import { Router } from 'express';
import { originationService } from '../services/genericService';
const router = Router();
router.post('/originate', async (req, res) => {
  try {
    const result = await originationService.executeOperation('originate', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
