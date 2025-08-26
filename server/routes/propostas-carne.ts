import { Router } from 'express';
import { propostasCarneService } from '../services/proposalService.js';
const router = Router();
router.get('/', async (req, res) => {
  try {
    const result = await propostasCarneService.executeOperation('list_carne', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
