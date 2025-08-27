import { Router } from 'express';
import { documentService } from '../services/genericService';
const router = Router();
router.get('/download/:id', async (req, res) => {
  try {
    const result = await documentService.executeOperation('file_download', { id: req.params.id });
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
