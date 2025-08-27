import { Router } from 'express';
import { migrationService } from '../services/genericService';
const router = Router();
router.post('/run', async (req, res) => {
  try {
    const result = await migrationService.executeOperation('run_migration', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
