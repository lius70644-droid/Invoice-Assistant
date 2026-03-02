# 风味组报销助手 - 前后端分离重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将单页应用重构为前后端分离架构，支持多用户和管理员审批

**Architecture:** 前端 React + Vite，后端 Express.js + Nginx，Docker 容器化部署

**Tech Stack:** React 19, TypeScript, Express.js, Supabase, 阿里云 OCR, Docker

---

## Task 1: 项目结构搭建

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`

**Step 1: Create server/package.json**

```json
{
  "name": "reimbursement-server",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "@supabase/supabase-js": "^2.39.0",
    "ali-sdk": "^1.0.0",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/multer": "^1.4.11",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0"
  }
}
```

**Step 2: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create server/.env.example**

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Aliyun OCR
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_jwt_secret_key

# Server
PORT=3000
NODE_ENV=production
```

**Step 4: Commit**

```bash
git add server/package.json server/tsconfig.json server/.env.example
git commit -m "chore: init backend project structure"
```

---

## Task 2: 后端 - 基础配置

**Files:**
- Create: `server/src/index.ts`
- Create: `server/src/config/index.ts`
- Create: `server/src/middleware/auth.ts`

**Step 1: Create server/src/config/index.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  aliyun: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_me',
    userExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
    adminExpiry: 24 * 60 * 60 * 1000, // 24 hours
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
  school: {
    name: '江南大学',
    taxId: '1210000071780177X1',
  },
};
```

**Step 2: Create server/src/middleware/auth.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface UserPayload {
  studentId: string;
  name: string;
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
```

**Step 3: Create server/src/index.ts**

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import recordRoutes from './routes/records';
import adminRoutes from './routes/admin';
import ocrRoutes from './routes/ocr';

const app = express();

app.use(cors());
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
```

**Step 4: Commit**

```bash
git add server/src/config/index.ts server/src/middleware/auth.ts server/src/index.ts
git commit -m "feat: add backend basic structure and auth middleware"
```

---

## Task 3: 后端 - Supabase 客户端

**Files:**
- Create: `server/src/lib/supabase.ts`

**Step 1: Create server/src/lib/supabase.ts**

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);
```

**Step 2: Commit**

```bash
git add server/src/lib/supabase.ts
git commit -m "feat: add supabase client"
```

---

## Task 4: 后端 - 阿里云 OCR 服务

**Files:**
- Create: `server/src/services/ocr.ts`

**Step 1: Create server/src/services/ocr.ts**

```typescript
import https from 'https';
import { config } from '../config';

export interface InvoiceData {
  invoiceNumber: string;
  sellerName: string;
  buyerName: string;
  sellerTaxId: string;
  buyerTaxId: string;
  sellerBankAccount: string;
  category: string;
  amount: number;
}

export const extractInvoiceData = async (imageBase64: string): Promise<InvoiceData> => {
  const { accessKeyId, accessKeySecret } = config.aliyun;

  // 阿里云 OCR API 调用
  const postData = JSON.stringify({
    image: imageBase64,
    prob: false,
    table: false,
    useClassicMode: true
  });

  const options = {
    hostname: 'ocr-api.cn-hangzhou.aliyuncs.com',
    path: '/?Action=RecognizeAdvance&Format=JSON&Version=2021-07-07',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}`,
      'X-Ca-Key': accessKeyId,
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          // 解析阿里云 OCR 结果，提取发票信息
          const text = result.data?.text || '';
          const parsed = parseOcrText(text);
          resolve(parsed);
        } catch (e) {
          reject(new Error('OCR 解析失败'));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

const parseOcrText = (text: string): InvoiceData => {
  // 解析 OCR 文本，提取发票信息
  // 需要根据实际阿里云 OCR 返回格式调整
  const lines = text.split('\n').filter(l => l.trim());

  const findField = (keywords: string[]): string => {
    for (const line of lines) {
      for (const kw of keywords) {
        if (line.includes(kw)) {
          return line.split(kw)[1]?.trim() || '';
        }
      }
    }
    return '';
  };

  const findAmount = (): number => {
    for (const line of lines) {
      const match = line.match(/[价税合计|合计|金额][：:]\s*([\d.]+)/);
      if (match) return parseFloat(match[1]);
    }
    // 尝试找最大数字
    const amounts = lines.map(l => {
      const nums = l.match(/\d+\.?\d*/g);
      return nums ? Math.max(...nums.map(Number)) : 0;
    });
    return Math.max(...amounts) || 0;
  };

  return {
    invoiceNumber: findField(['发票号', '发票代码', 'No']),
    sellerName: findField(['销售方', '纳税人名称']),
    buyerName: findField(['购买方', '付款单位']),
    sellerTaxId: findField(['销售方税号', '纳税人识别号']),
    buyerTaxId: findField(['购买方税号']),
    sellerBankAccount: findField(['开户行', '账号']),
    category: findField(['项目', '商品', '类别']) || '通用',
    amount: findAmount(),
  };
};
```

**Step 2: Commit**

```bash
git add server/src/services/ocr.ts
git commit -m "feat: add aliyun OCR service"
```

---

## Task 5: 后端 - 认证路由

**Files:**
- Create: `server/src/routes/auth.ts`

**Step 1: Create server/src/routes/auth.ts**

```typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { supabase } from '../lib/supabase';
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
      { studentId, name },
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
```

**Step 2: Commit**

```bash
git add server/src/routes/auth.ts
git commit -m "feat: add auth routes"
```

---

## Task 6: 后端 - 报销记录路由

**Files:**
- Create: `server/src/routes/records.ts`

**Step 1: Create server/src/routes/records.ts**

```typescript
import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateUser, UserPayload } from '../middleware/auth';
import { config } from '../config';

const router = Router();

interface RecordBody {
  invoiceNumber: string;
  sellerName: string;
  buyerName: string;
  sellerTaxId: string;
  buyerTaxId: string;
  sellerBankAccount: string;
  category: string;
  amount: number;
  isPaid: boolean;
  surveyAnswers?: {
    hasDoubleSignature?: boolean;
    hasPaymentRecord?: boolean;
  };
}

// 获取当前用户的报销记录
router.get('/', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user as UserPayload;
    const { data, error } = await supabase
      .from('reimbursement_records')
      .select('*')
      .eq('student_id', user.studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 提交新的报销记录
router.post('/', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user as UserPayload;
    const body = req.body as RecordBody;

    // 校验购买方
    const buyerValid = body.buyerName.includes(config.school.name) &&
                       body.buyerTaxId.includes(config.school.taxId);
    if (!buyerValid) {
      return res.status(400).json({
        error: `发票抬头错误！购买方必须是：${config.school.name}`
      });
    }

    // 检查重复
    const { data: existing } = await supabase
      .from('reimbursement_records')
      .select('id')
      .eq('invoice_number', body.invoiceNumber)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({
        error: `发票号码 ${body.invoiceNumber} 已存在，不可重复报销`
      });
    }

    const { data, error } = await supabase
      .from('reimbursement_records')
      .insert([{
        name: user.name,
        student_id: user.studentId,
        invoice_number: body.invoiceNumber,
        seller_name: body.sellerName,
        buyer_name: body.buyerName,
        seller_tax_id: body.sellerTaxId,
        buyer_tax_id: body.buyerTaxId,
        seller_bank_account: body.sellerBankAccount,
        category: body.category,
        amount: body.amount,
        is_paid: body.isPaid,
        status: 'box',
        survey_answers: body.surveyAnswers || {},
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Create record error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 修改支付状态
router.put('/:id/paid', authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { isPaid } = req.body;
    const user = req.user as UserPayload;

    // 检查记录是否存在且属于当前用户
    const { data: record } = await supabase
      .from('reimbursement_records')
      .select('*')
      .eq('id', id)
      .single();

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    if (record.student_id !== user.studentId) {
      return res.status(403).json({ error: '无权限操作' });
    }

    const newCount = record.paid_edit_count + 1;
    if (newCount > 1) {
      return res.status(400).json({ error: '支付状态仅可修改一次' });
    }

    const { data, error } = await supabase
      .from('reimbursement_records')
      .update({
        is_paid: isPaid,
        paid_edit_count: newCount
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Update paid error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 提交问卷答案
router.put('/:id/survey', authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { hasDoubleSignature, hasPaymentRecord } = req.body;
    const user = req.user as UserPayload;

    const { data: record } = await supabase
      .from('reimbursement_records')
      .select('*')
      .eq('id', id)
      .single();

    if (!record || record.student_id !== user.studentId) {
      return res.status(403).json({ error: '无权限操作' });
    }

    const newAnswers = {
      ...(record.survey_answers || {}),
      ...(hasDoubleSignature !== undefined && { hasDoubleSignature }),
      ...(hasPaymentRecord !== undefined && { hasPaymentRecord }),
    };

    const { data, error } = await supabase
      .from('reimbursement_records')
      .update({ survey_answers: newAnswers })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Survey answer error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**Step 2: Commit**

```bash
git add server/src/routes/records.ts
git commit -m "feat: add records routes"
```

---

## Task 7: 后端 - 管理员路由

**Files:**
- Create: `server/src/routes/admin.ts`

**Step 1: Create server/src/routes/admin.ts**

```typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { supabase } from '../lib/supabase';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 简单验证：用户名和密码匹配
    if (username !== config.admin.username || password !== config.admin.password) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { username },
      config.jwt.secret + '_admin',
      { expiresIn: config.jwt.adminExpiry }
    );

    res.json({ token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取所有报销记录
router.get('/records', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reimbursement_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    console.error('Fetch all records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 修改审批状态
router.put('/records/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const updates: any = { status };
    if (status === 'rejected') {
      updates.rejection_reason = rejectionReason || '';
    }

    const { data, error } = await supabase
      .from('reimbursement_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Update status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 退单
router.post('/records/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data, error } = await supabase
      .from('reimbursement_records')
      .update({
        status: 'rejected',
        rejection_reason: reason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Reject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 导出 CSV
router.get('/export', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reimbursement_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const headers = ['发票号', '金额', '分类', '提交人', '学号', '电话', '导师', '状态', '老师签字', '支付记录', '当前进度', '退单原因'];
    const rows = (data || []).map((r: any) => [
      r.invoice_number,
      r.amount,
      r.category,
      r.name,
      r.student_id,
      r.phone,
      r.supervisor,
      r.is_paid ? '已付' : '待付',
      r.survey_answers?.hasDoubleSignature ? '是' : '否',
      r.survey_answers?.hasPaymentRecord ? '是' : '否',
      r.status,
      r.rejection_reason || ''
    ]);

    const csvContent = '\ufeff' + [headers, ...rows].map(e => e.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=报销清单_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**Step 2: Commit**

```bash
git add server/src/routes/admin.ts
git commit -m "feat: add admin routes"
```

---

## Task 8: 后端 - OCR 路由

**Files:**
- Create: `server/src/routes/ocr.ts`

**Step 1: Create server/src/routes/ocr.ts**

```typescript
import { Router } from 'express';
import { extractInvoiceData } from '../services/ocr';
import { config } from '../config';

const router = Router();

// 识别发票
router.post('/extract', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: '请提供图片' });
    }

    // 移除 data:image/xxx;base64, 前缀
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const data = await extractInvoiceData(base64Data);

    // 校验购买方
    const isBuyerValid = data.buyerName.includes(config.school.name) &&
                         data.buyerTaxId.includes(config.school.taxId);

    res.json({
      ...data,
      isBuyerValid,
    });
  } catch (error: any) {
    console.error('OCR error:', error);
    res.status(500).json({ error: '发票识别失败' });
  }
});

export default router;
```

**Step 2: Commit**

```bash
git add server/src/routes/ocr.ts
git commit -m "feat: add OCR route"
```

---

## Task 9: 前端 - API 服务

**Files:**
- Create: `src/services/api.ts`

**Step 1: Create src/services/api.ts**

```typescript
const API_BASE = '/api';

const getToken = () => localStorage.getItem('token');
const getAdminToken = () => localStorage.getItem('admin_token');

const request = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const adminToken = getAdminToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(adminToken && { Authorization: `Bearer ${adminToken}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  // 处理 CSV 下载
  if (response.headers.get('Content-Type')?.includes('text/csv')) {
    return response.blob();
  }

  return response.json();
};

// Auth
export const login = (data: { name: string; studentId: string; supervisor?: string; phone?: string }) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(data) });

export const getUserInfo = () => request('/auth/me');

export const adminLogin = (data: { username: string; password: string }) =>
  request('/admin/login', { method: 'POST', body: JSON.stringify(data) });

// Records
export const getRecords = () => request('/records');

export const createRecord = (data: any) =>
  request('/records', { method: 'POST', body: JSON.stringify(data) });

export const updatePaidStatus = (id: string, isPaid: boolean) =>
  request(`/records/${id}/paid`, { method: 'PUT', body: JSON.stringify({ isPaid }) });

export const submitSurvey = (id: string, data: any) =>
  request(`/records/${id}/survey`, { method: 'PUT', body: JSON.stringify(data) });

// Admin
export const getAllRecords = () => request('/admin/records');

export const updateStatus = (id: string, status: string, rejectionReason?: string) =>
  request(`/admin/records/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, rejectionReason })
  });

export const rejectRecord = (id: string, reason: string) =>
  request(`/admin/records/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });

export const exportCSV = async () => {
  const blob = await request('/admin/export');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `报销清单_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// OCR
export const extractInvoice = (image: string) =>
  request('/ocr/extract', { method: 'POST', body: JSON.stringify({ image }) });
```

**Step 2: Commit**

```bash
git add src/services/api.ts
git commit -m "feat: add frontend API service"
```

---

## Task 10: 前端 - 重构 App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Read current App.tsx and refactor**

需要将原来的单页应用拆分为：
1. 登录页面组件
2. 用户首页组件
3. 管理登录页面
4. 管理后台组件

具体重构内容：
- 移除原有的 Supabase 直接调用，改用 api.ts
- 移除原有的 Gemini OCR 调用，改用 api.ts
- 添加路由管理（使用 React Router）
- 保持原有的 UI 样式不变

**Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: separate frontend and integrate with backend API"
```

---

## Task 11: Docker 配置

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx.conf`

**Step 1: Create Dockerfile**

```dockerfile
# Build frontend
FROM node:20-alpine as frontend
WORKDIR /app/frontend
COPY 风味组报销助手/package*.json ./
RUN npm install
COPY 风味组报销助手/ ./
RUN npm run build

# Build backend
FROM node:20-alpine as backend
WORKDIR /app/backend
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# Production
FROM node:20-alpine
WORKDIR /app

# Copy backend
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/node_modules ./node_modules

# Copy frontend build
COPY --from=frontend /app/frontend/dist ./dist/client

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 3000

CMD ["sh", "-c", "node dist/index.js & nginx -g 'daemon off;'"]
```

**Step 2: Create nginx.conf**

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name localhost;
        root /app/dist/client;
        index index.html;

        # Frontend static files
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API proxy
        location /api/ {
            proxy_pass http://localhost:3000/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

**Step 3: Create docker-compose.yml**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - ALIYUN_ACCESS_KEY_ID=${ALIYUN_ACCESS_KEY_ID}
      - ALIYUN_ACCESS_KEY_SECRET=${ALIYUN_ACCESS_KEY_SECRET}
      - ADMIN_USERNAME=${ADMIN_USERNAME}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3000
    restart: unless-stopped
```

**Step 4: Create .env**

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ALIYUN_ACCESS_KEY_ID=your_aliyun_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_aliyun_access_key_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_change_this
```

**Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml nginx.conf .env
git commit -m "feat: add Docker configuration"
```

---

## Plan Complete

**Plan saved to:** `docs/plans/2026-03-01-reimbursement-architecture-design.md`

---

## Two Execution Options

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
