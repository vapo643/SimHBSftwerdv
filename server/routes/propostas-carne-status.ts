import { Router } from 'express';
import { propostasStatusService } from '../services/proposalService.js';
const router = Router();
router.get('/:id/status', async (req, res) => {
  try {
    const result = await propostasStatusService.executeOperation('carne_status', {
      id: req.params.id,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
