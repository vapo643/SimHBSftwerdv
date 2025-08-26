import { Router } from 'express';
import { adminService } from '../services/genericService';
const router = Router();
router.post('/triggers', async (req, res) => {
  try {
    const result = await adminService.executeOperation('scheduler_triggers', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
