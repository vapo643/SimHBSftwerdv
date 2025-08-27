import { Router } from 'express';
import { clientService } from '../services/genericService';
const router = Router();
router.get('/activity', async (req, res) => {
  try {
    const result = await clientService.executeOperation('user_activity', req.query);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
