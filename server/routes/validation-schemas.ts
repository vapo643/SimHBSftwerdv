import { Router } from 'express';
import { validationService } from '../services/genericService';
const router = Router();
router.get('/schemas', async (req, res) => {
  try {
    const result = await validationService.executeOperation('get_schemas', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
