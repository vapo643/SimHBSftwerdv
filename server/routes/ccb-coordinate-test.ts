import { Router } from 'express';
import { ccbTestService } from '../services/genericService';
const _router = Router();
router.post('/coordinate-test', async (req, res) => {
  try {
    const _result = await ccbTestService.executeOperation('coordinate_test', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
