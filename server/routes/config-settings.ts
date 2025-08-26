import { Router } from 'express';
import { configService } from '../services/genericService';
const router = Router();
router.get('/', async (req, res) => {
  try {
    const result = await configService.executeOperation('get_config', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
