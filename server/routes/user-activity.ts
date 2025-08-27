import { Router } from 'express';
import { clientService } from '../services/genericService';
const _router = Router();
router.get('/activity', async (req, res) => {
  try {
    const _result = await clientService.executeOperation('user_activity', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
