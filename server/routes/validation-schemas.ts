import { Router } from 'express';
import { validationService } from '../services/genericService';
const _router = Router();
router.get('/schemas', async (req, res) => {
  try {
    const _result = await validationService.executeOperation('get_schemas', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
