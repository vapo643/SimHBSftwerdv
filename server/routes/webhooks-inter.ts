import { Router } from 'express';
import webhookService from '../services/webhookService.js';
const router = Router();
router.post('/inter', async (req, res) => {
  try {
    const result = { success: true, data: req.body }; // FIXED: Webhook processing placeholder
    res.json({ success: true });
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
