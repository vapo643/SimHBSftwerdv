import { Router } from 'express';
import { notificationService } from '../services/genericService';
const _router = Router();
router.post('/sms', async (req, res) => {
  try {
    const _result = await notificationService.executeOperation('send_sms', req.body);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
