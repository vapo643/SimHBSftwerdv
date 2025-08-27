import { Router } from 'express';
import { configService } from '../services/genericService';
const router = Router();
router.get('/flags', async (req, res) => {
  try {
    const result = await configService.executeOperation('feature_flags', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
