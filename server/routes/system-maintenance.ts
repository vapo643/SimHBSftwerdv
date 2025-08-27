import { Router } from 'express';
import { adminService } from '../services/genericService';
const router = Router();
router.post('/maintenance', async (req, res) => {
  try {
    const result = await adminService.executeOperation('system_maintenance', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
