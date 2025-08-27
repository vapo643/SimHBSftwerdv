import { Router } from 'express';
import { propostasStatusService } from '../services/proposalService.js';
const _router = Router();
router.get('/:id/status', async (req, res) => {
  try {
    const _result = await propostasStatusService.executeOperation('carne_status', {
      id: req.params.id,
    });
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
