import { Router } from 'express';
import { validationService } from '../services/genericService';
const router = Router();
router.get('/rules', async (req, res) => {
  try {
    const result = await validationService.executeOperation('get_rules', req.query);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
