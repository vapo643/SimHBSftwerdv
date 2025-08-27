import { Router } from 'express';
import { auditService } from '../services/genericService';
const _router = Router();
router.get('/trail/:id', async (req, res) => {
  try {
    const _result = await auditService.executeOperation('get_trail', { id: req.params.id });
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
