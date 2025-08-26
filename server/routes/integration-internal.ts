import { Router } from 'express';
import { integrationTestService } from '../services/genericService';
const router = Router();
router.post('/internal', async (req, res) => {
  try {
    const result = await integrationTestService.executeOperation('internal_integration', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
