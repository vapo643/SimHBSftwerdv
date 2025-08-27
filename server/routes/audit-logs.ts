import { Router } from 'express';
import { auditService } from '../services/genericService';
const router = Router();
router.get('/', async (req, res) => {
  try {
    const result = await auditService.executeOperation('get_logs', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
