import { Router } from 'express';
import { securityTestService } from '../services/genericService';
const _router = Router();
router.get('/timing-analysis', async (req, res) => {
  try {
    const _result = await securityTestService.executeOperation('timing_analysis', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
