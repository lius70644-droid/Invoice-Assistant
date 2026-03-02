import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface UserPayload {
  studentId: string;
  name: string;
  supervisor?: string;
  phone?: string;
}

export interface AdminPayload {
  username: string;
}

export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(token, config.jwt.secret) as UserPayload;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
};

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(token, config.jwt.secret + '_admin') as AdminPayload;
    (req as any).admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
};
