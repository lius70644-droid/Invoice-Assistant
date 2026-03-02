# 风味组报销助手 - 前后端分离重构设计

**日期**: 2026-03-01

## 1. 项目概述

将现有的 React 单页应用重构为前后端分离架构，支持多用户使用和管理员审批功能。

### 目标用户
- **普通用户**：风味组学生/教工，上传发票、查看报销进度
- **管理员**：审批发票、查看所有记录

---

## 2. 技术架构

```
┌─────────────────────────────────────────┐
│              阿里云 ECS                 │
│  ┌───────────────────────────────────┐ │
│  │         Docker Compose            │ │
│  │  ┌───────────┐ ┌──────────────┐  │ │
│  │  │   Nginx   │ │  Express.js  │  │ │
│  │  │ :80 (前端)│ │ :3000 (API)  │  │ │
│  │  └─────┬─────┘ └──────┬───────┘  │ │
│  │        │              │          │ │
│  │   静态资源        API 请求        │ │
│  └────────┼──────────────┼───────────┘ │
└───────────┼──────────────┼────────────┘
            │              │
     ┌──────┴──────┐ ┌────┴─────┐
     │  阿里云 OCR  │ │ Supabase  │
     └─────────────┘ └───────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| 后端 | Express.js + TypeScript |
| 数据库 | Supabase (PostgreSQL) |
| OCR | 阿里云通用文字识别 |
| 部署 | Docker + Docker Compose → 阿里云 ECS |

---

## 3. API 设计

### 3.1 用户端

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/records` | 获取当前用户的报销记录 |
| POST | `/api/records` | 提交新的报销记录 |
| PUT | `/api/records/:id/paid` | 修改支付状态 |
| PUT | `/api/records/:id/survey` | 提交问卷答案 |

### 3.2 管理端

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| GET | `/api/admin/records` | 获取所有用户报销记录 |
| PUT | `/api/admin/records/:id/status` | 修改审批状态 |
| POST | `/api/admin/records/:id/reject` | 退单 |
| GET | `/api/admin/export` | 导出 CSV |

### 3.3 通用

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ocr/extract` | OCR 识别发票 |

---

## 4. 数据模型

### 数据库表: `reimbursement_records`

```sql
-- 用户信息 (登录时存储)
name VARCHAR(100),        -- 姓名
student_id VARCHAR(50),  -- 学号/工号
supervisor VARCHAR(100), -- 指导老师
phone VARCHAR(20),       -- 电话

-- 发票信息
invoice_number VARCHAR(50),   -- 发票号
seller_name VARCHAR(200),     -- 销售方名称
buyer_name VARCHAR(200),      -- 购买方名称
seller_tax_id VARCHAR(50),   -- 销售方税号
buyer_tax_id VARCHAR(50),    -- 购买方税号
seller_bank_account VARCHAR(100), -- 销售方银行账号
category VARCHAR(50),         -- 发票类别
amount DECIMAL(10,2),       -- 金额

-- 状态
is_paid BOOLEAN DEFAULT false,    -- 是否已付
paid_edit_count INT DEFAULT 0,     -- 已付状态修改次数
status VARCHAR(20) DEFAULT 'box',  -- 审批状态
rejection_reason TEXT,             -- 退单原因

-- 问卷
survey_answers JSONB,              -- 问卷答案

-- 元数据
id UUID PRIMARY KEY,
created_at TIMESTAMP DEFAULT NOW()
```

### 管理员表: `admins`

```sql
id UUID PRIMARY KEY,
username VARCHAR(50) UNIQUE,  -- 用户名
password_hash VARCHAR(255),   -- 密码哈希
created_at TIMESTAMP DEFAULT NOW()
```

---

## 5. 认证方案

### 5.1 用户端

- **登录方式**：学号 + 姓名
- **会话管理**：JWT Token，存储在 localStorage
- **Token 有效期**：7 天

### 5.2 管理端

- **登录方式**：用户名 + 密码
- **密码加密**：bcrypt 哈希存储
- **会话管理**：JWT Token，HttpOnly Cookie
- **Token 有效期**：24 小时

---

## 6. OCR 集成

### 阿里云通用文字识别

```typescript
// 请求参数
interface OCRRequest {
  image: string;  // Base64 编码的图片
}

// 响应参数
interface OCRResponse {
  invoiceNumber: string;
  sellerName: string;
  buyerName: string;
  sellerTaxId: string;
  buyerTaxId: string;
  sellerBankAccount: string;
  category: string;
  amount: number;
}
```

### 校验规则

1. **购买方校验**：必须是「江南大学」
2. **税号校验**：必须包含 `1210000071780177X1`
3. **重复校验**：发票号码不能与已有记录重复

---

## 7. 前端页面结构

```
/
├── /login              # 用户登录
├── /home               # 用户首页（发票上传、记录列表）
├── /admin              # 管理员登录
├── /admin/dashboard    # 管理后台
```

---

## 8. Docker 配置

### Dockerfile (后端)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### docker-compose.yml

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
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

### Nginx 配置

- `/` → 静态文件（前端 build）
- `/api/*` → 反向代理到 Express (3000 端口)

---

## 9. 部署步骤

1. **准备阿里云 ECS**
   - 购买 ECS 实例
   - 安装 Docker 和 Docker Compose

2. **配置环境变量**
   - 创建 `.env` 文件

3. **构建镜像**
   - `docker-compose build`

4. **启动服务**
   - `docker-compose up -d`

5. **访问应用**
   - `http://你的ECS公网IP`

---

## 10. 待定事项

- [ ] Supabase 表结构确认（需创建 admins 表）
- [ ] 阿里云 OCR 端点确认
- [ ] 正式环境域名备案（如需）
