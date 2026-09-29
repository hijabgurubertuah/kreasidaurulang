import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.APP_PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Health check endpoint for Cloud Run and load balancers
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets from the Vite build output
if (fs.existsSync(DIST_DIR)) {
  app.use(
    express.static(DIST_DIR, {
      maxAge: '1h',
      index: 'index.html',
    })
  );

  // SPA fallback: any non-static request gets served index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Build not found. Please run npm run build.');
    }
  });
} else {
  console.warn('Warning: dist directory does not exist yet. Please build before running in production.');
  app.get('*', (_req, res) => {
    res.status(503).send('Application is building, please refresh in a few seconds.');
  });
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Production server running on http://0.0.0.0:${PORT}`);
});
