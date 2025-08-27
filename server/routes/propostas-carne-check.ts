import { Router } from 'express';
import { propostasCarneService } from '../services/proposalService.js';
const _router = Router();
router.post('/check', async (req, res) => {
  try {
    const _result = await propostasCarneService.executeOperation('check_carne', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
