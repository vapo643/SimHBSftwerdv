import { Router } from 'express';
import { notificationService } from '../services/genericService';
const router = Router();
router.post('/sms', async (req, res) => {
  try {
    const result = await notificationService.executeOperation('send_sms', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
