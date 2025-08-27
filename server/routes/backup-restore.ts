import { Router } from 'express';
import { backupService } from '../services/genericService';
const _router = Router();
router.post('/restore', async (req, res) => {
  try {
    const _result = await backupService.executeOperation('restore_backup', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
