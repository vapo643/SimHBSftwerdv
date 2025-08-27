import { Router } from 'express';
import { configService } from '../services/genericService';
const _router = Router();
router.get('/flags', async (req, res) => {
  try {
    const _result = await configService.executeOperation('feature_flags', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
