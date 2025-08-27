import { Router } from 'express';
import { documentService } from '../services/genericService';
const _router = Router();
router.get('/templates', async (req, res) => {
  try {
    const _result = await documentService.executeOperation('template_manager', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
