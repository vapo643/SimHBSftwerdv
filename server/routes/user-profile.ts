import { Router } from 'express';
import { clientService } from '../services/genericService';
const _router = Router();
router.get('/profile', async (req, res) => {
  try {
    const _result = await clientService.executeOperation('user_profile', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
