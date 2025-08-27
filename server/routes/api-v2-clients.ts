import { Router } from 'express';
import { clientService } from '../services/genericService';
const router = Router();
router.get('/v2/clients', async (req, res) => {
  try {
    const result = await clientService.executeOperation('list_v2', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
