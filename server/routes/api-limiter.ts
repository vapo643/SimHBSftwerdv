import { Router } from 'express';
import { securityService } from '../services/genericService';
const _router = Router();
router.get('/limits', async (req, res) => {
  try {
    const _result = await securityService.executeOperation('api_limiter', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
