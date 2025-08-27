import { Router } from 'express';
import { documentService } from '../services/genericService';
const router = Router();
router.post('/render', async (req, res) => {
  try {
    const result = await documentService.executeOperation('template_engine', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
