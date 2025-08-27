import { Router } from 'express';
import { proposalService } from '../services/proposalService.js';
const _router = Router();
router.get('/v2/proposals', async (req, res) => {
  try {
    const _result = await proposalService.executeOperation('list_v2', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
