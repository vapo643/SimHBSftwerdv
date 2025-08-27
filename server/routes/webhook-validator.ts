import { Router } from 'express';
import { validationService } from '../services/genericService';
const router = Router();
router.post('/validate', async (req, res) => {
  try {
    const result = await validationService.executeOperation('webhook_validator', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
