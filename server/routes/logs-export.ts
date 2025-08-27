import { Router } from 'express';
import { auditService } from '../services/genericService';
const router = Router();
router.post('/export', async (req, res) => {
  try {
    const result = await auditService.executeOperation('export_logs', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
