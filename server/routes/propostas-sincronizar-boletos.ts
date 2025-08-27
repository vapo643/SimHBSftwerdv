import { Router } from 'express';
import { propostasSyncService } from '../services/proposalService.js';
const _router = Router();
router.post('/sync-boletos', async (req, res) => {
  try {
    const _result = await propostasSyncService.executeOperation('sync_boletos', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
