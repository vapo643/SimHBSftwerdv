import { Router } from 'express';
import { adminService } from '../services/genericService';
const router = Router();
router.get('/settings', async (req, res) => {
  try {
    const result = await adminService.executeOperation('get_settings', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
