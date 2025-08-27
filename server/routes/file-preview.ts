import { Router } from 'express';
import { documentService } from '../services/genericService';
const _router = Router();
router.get('/preview/:id', async (req, res) => {
  try {
    const _result = await documentService.executeOperation('file_preview', { id: req.params.id });
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
