import { Router } from 'express';
import { propostasSyncService } from '../services/proposalService.js';
const router = Router();
router.post('/corrigir-sync', async (req, res) => {
  try {
    const result = await propostasSyncService.executeOperation('fix_sync', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
