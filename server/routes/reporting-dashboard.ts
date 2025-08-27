import { Router } from 'express';
import { reportingService } from '../services/genericService';
const router = Router();
router.get('/dashboard', async (req, res) => {
  try {
    const result = await reportingService.executeOperation('dashboard', req.query);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
