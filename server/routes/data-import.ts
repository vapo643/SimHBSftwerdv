import { Router } from 'express';
import { reportingService } from '../services/genericService';
const router = Router();
router.post('/import', async (req, res) => {
  try {
    const result = await reportingService.executeOperation('data_import', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
