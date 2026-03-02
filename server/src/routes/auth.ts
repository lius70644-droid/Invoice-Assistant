import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { authenticateUser } from '../middleware/auth';

const router = Router();

interface LoginBody {
  name: string;
  studentId: string;
  supervisor?: string;
  phone?: string;
}

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { name, studentId, supervisor, phone } = req.body as LoginBody;

    if (!name || !studentId) {
      return res.status(400).json({ error: '请提供姓名和学号' });
    }

    const token = jwt.sign(
      { studentId, name, supervisor, phone },
      config.jwt.secret,
      { expiresIn: config.jwt.userExpiry }
    );

    res.json({
      token,
      user: { name, studentId, supervisor, phone }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateUser, async (req: any, res) => {
  res.json({ user: req.user });
});

export default router;
