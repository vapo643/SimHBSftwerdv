import { Router } from 'express';
import { migrationService } from '../services/genericService';
const _router = Router();
router.post('/run', async (req, res) => {
  try {
    const _result = await migrationService.executeOperation('run_migration', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
