import { Router } from 'express';
import { adminService } from '../services/genericService';
const _router = Router();
router.post('/permissions', async (req, res) => {
  try {
    const _result = await adminService.executeOperation('manage_permissions', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
