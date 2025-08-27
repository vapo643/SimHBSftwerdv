import { Router } from 'express';
import { adminService } from '../services/genericService';
const _router = Router();
router.post('/triggers', async (req, res) => {
  try {
    const _result = await adminService.executeOperation('scheduler_triggers', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
