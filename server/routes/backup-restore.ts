import { Router } from 'express';
import { backupService } from '../services/genericService';
const router = Router();
router.post('/restore', async (req, res) => {
  try {
    const result = await backupService.executeOperation('restore_backup', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
