import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbDriver, initDatabase } from '../database/db.js';
import { seedDatabase } from '../database/seed.js';
import academicRoutes from './routes/academicRoutes.js';
import adminOwnerRoutes from './routes/adminOwnerRoutes.js';
import authRoutes from './routes/authRoutes.js';
import communicationRoutes from './routes/communicationRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import youtubeRoutes from './routes/youtubeRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function startServer() {
  await initDatabase();
  await seedDatabase();

  const app = express();
  const PORT = Number(process.env.APP_PORT || 3000);

  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  // Health & DB driver verification
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, academy: 'Ezana Academy', dbDriver: getDbDriver() });
  });

  // Downloadable sample study materials
  app.get('/api/resources/sample/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename || 'study-guide.txt');
    const content = [
      `EZANA ACADEMY — STUDY REFERENCE`,
      `Document: ${safeName}`,
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      ``,
      `1. Learning Objectives`,
      `- Master foundational concepts and review module checkpoints.`,
      `- Complete weekly practical exercises prior to live class clinics.`,
      ``,
      `2. Key Takeaways & Study Checklist`,
      `[ ] Review video tutorial summaries and personal lesson notes.`,
      `[ ] Attempt knowledge check quiz questions.`,
      `[ ] Submit assignment deliverables before the scheduled due date.`,
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(content);
  });

  // Contact inquiry public endpoint
  app.post('/api/contact', async (req, res) => {
    const { name, email, subject = 'Admissions Inquiry', message } = req.body || {};
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Name, email, and message are required.' });
    }
    return res.status(201).json({
      message: 'Thank you for contacting Ezana Academy. Our admissions team will respond within 1 business day.',
    });
  });

  // Mount modular REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/youtube', youtubeRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/academic', academicRoutes);
  app.use('/api/communication', communicationRoutes);
  app.use('/api/dashboard', adminOwnerRoutes);

  // Serve Vite dev middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: rootDir,
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(rootDir, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Ezana Academy running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
