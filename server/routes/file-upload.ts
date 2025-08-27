import { Router } from 'express';
import { documentService } from '../services/genericService';
const router = Router();
router.post('/upload', async (req, res) => {
  try {
    const result = await documentService.executeOperation('file_upload', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
