import { Router } from 'express';
import { validationService } from '../services/genericService';
const _router = Router();
router.get('/rules', async (req, res) => {
  try {
    const _result = await validationService.executeOperation('get_rules', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
