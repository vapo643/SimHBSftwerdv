import { Router } from 'express';
import { migrationService } from '../services/genericService';
const _router = Router();
router.get('/status', async (req, res) => {
  try {
    const _result = await migrationService.executeOperation('migration_status', req.query);
    res.json(_result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
