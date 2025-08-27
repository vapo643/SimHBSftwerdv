import { Router } from 'express';
import { simulatorService } from '../services/genericService';
const _router = Router();
router.post('/approval', async (req, res) => {
  try {
    const _result = await simulatorService.executeOperation('credit_approval', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
