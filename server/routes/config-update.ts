import { Router } from 'express';
import { configService } from '../services/genericService';
const router = Router();
router.post('/update', async (req, res) => {
  try {
    const result = await configService.executeOperation('update_config', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
