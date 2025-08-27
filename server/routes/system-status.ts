import { Router } from 'express';
import { adminService } from '../services/genericService';
const _router = Router();
router.get('/status', async (req, res) => {
  try {
    const _result = await adminService.executeOperation('system_status', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
