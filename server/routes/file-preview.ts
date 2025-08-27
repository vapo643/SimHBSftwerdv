import { Router } from 'express';
import { documentService } from '../services/genericService';
const router = Router();
router.get('/preview/:id', async (req, res) => {
  try {
    const result = await documentService.executeOperation('file_preview', { id: req.params.id });
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
