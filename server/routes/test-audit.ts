import { Router } from 'express';
import { testAuditService } from '../services/testService.js';
const _router = Router();
router.get('/audit', async (req, res) => {
  try {
    const _result = await testAuditService.executeOperation('audit', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
