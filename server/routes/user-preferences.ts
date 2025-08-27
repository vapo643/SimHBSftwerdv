import { Router } from 'express';
import { clientService } from '../services/genericService';
const _router = Router();
router.post('/preferences', async (req, res) => {
  try {
    const _result = await clientService.executeOperation('user_preferences', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
