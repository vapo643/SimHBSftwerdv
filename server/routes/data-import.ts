import { Router } from 'express';
import { reportingService } from '../services/genericService';
const _router = Router();
router.post('/import', async (req, res) => {
  try {
    const _result = await reportingService.executeOperation('data_import', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
