import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import recordRoutes from './routes/records';
import adminRoutes from './routes/admin';
import ocrRoutes from './routes/ocr';

const app = express();

// CORS 配置 - 从环境变量读取允许的来源
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000']; // 默认开发环境

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ocr', ocrRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port}`);
});

export default app;
