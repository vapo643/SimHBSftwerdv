import { Router } from 'express';
import { propostasStorageService } from '../services/proposalService.js';
const router = Router();
router.get('/storage/status', async (req, res) => {
  try {
    const result = await propostasStorageService.executeOperation('storage_status', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
