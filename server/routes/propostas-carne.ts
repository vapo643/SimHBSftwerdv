import { Router } from 'express';
import { propostasCarneService } from '../services/proposalService.js';
const _router = Router();
router.get('/', async (req, res) => {
  try {
    const _result = await propostasCarneService.executeOperation('list_carne', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
