/**
 * InvestTrack NAS Server
 * Refactored v2.0
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';

import assetsRouter from './routes/assets.js';
import strategiesRouter from './routes/strategies.js';
import statementsRouter from './routes/statements.js';
import dashboardRouter from './routes/dashboard.js';
import exportRouter from './routes/export.js';
import pricesRouter from './routes/prices.js';

import './scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Initialize DB ---
initDB();

// --- Mount Routes ---
app.use('/api/assets', assetsRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/statements', statementsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/export', exportRouter);
app.use('/api/prices', pricesRouter);

// --- Static Files ---
// Since this file is in /server/index.js, dist is in ../dist relative to here
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});