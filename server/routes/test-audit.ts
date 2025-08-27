import { Router } from 'express';
import { testAuditService } from '../services/testService.js';
const router = Router();
router.get('/audit', async (req, res) => {
  try {
    const result = await testAuditService.executeOperation('audit', req.query);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
