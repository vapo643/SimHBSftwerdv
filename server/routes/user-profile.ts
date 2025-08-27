import { Router } from 'express';
import { clientService } from '../services/genericService';
const router = Router();
router.get('/profile', async (req, res) => {
  try {
    const result = await clientService.executeOperation('user_profile', req.query);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
