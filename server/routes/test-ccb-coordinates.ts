import { Router } from 'express';
import { ccbTestService } from '../services/genericService';
const router = Router();
router.post('/test-coordinates', async (req, res) => {
  try {
    const result = await ccbTestService.executeOperation('test_coordinates', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
