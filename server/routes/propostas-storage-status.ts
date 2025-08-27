import { Router } from 'express';
import { propostasStorageService } from '../services/proposalService.js';
const router = Router();
router.get('/storage/status', async (req, res) => {
  try {
    const result = await propostasStorageService.executeOperation('storage_status', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
