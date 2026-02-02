import { Router } from 'express';
import { ExportService } from '../services/exportService.js';

const router = Router();

router.get('/backup', async (req, res) => {
    try {
        const backupData = await ExportService.exportForBackup();
        const filename = `invest_track_backup_${new Date().toISOString().split('T')[0]}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Export failed', message: err.message });
    }
});

router.post('/restore', async (req, res) => {
    try {
        if (!req.body || !req.body._meta) {
            return res.status(400).json({ error: 'Invalid backup format' });
        }
        const result = await ExportService.importBackup(req.body);
        res.json({ success: true, imported: result });
    } catch (err) {
        console.error('Restore error:', err);
        res.status(500).json({ error: 'Restore failed', message: err.message });
    }
});

export default router;
