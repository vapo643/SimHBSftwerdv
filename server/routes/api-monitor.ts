import { Router } from 'express';
import { auditService } from '../services/genericService';
const router = Router();
router.get('/monitor', async (req, res) => {
  try {
    const result = await auditService.executeOperation('api_monitor', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
