import { Router } from 'express';
import { integrationTestService } from '../services/genericService';
const _router = Router();
router.post('/manage', async (req, res) => {
  try {
    const _result = await integrationTestService.executeOperation('webhook_manager', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
