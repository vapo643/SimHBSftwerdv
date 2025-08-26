import { Router } from 'express';
import { auditService } from '../services/genericService';
const router = Router();
router.get('/alerts', async (req, res) => {
  try {
    const result = await auditService.executeOperation('performance_alerts', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
