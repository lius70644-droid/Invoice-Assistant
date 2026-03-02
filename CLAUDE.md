# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在本项目中工作时提供指导。

## 项目简介

风味组报销助手是一个基于 React 的网页应用，用于管理江南大学的发票报销工作流。它使用 AI（Google Gemini）从发票图片/PDF 中提取数据，并跟踪报销审批状态。

## 命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 类型检查
npm run lint
```

## 环境变量

创建 `.env.local` 文件，内容如下：
```
GEMINI_API_KEY=你的gemini_api_key
VITE_SUPABASE_URL=你的supabase_url
VITE_SUPABASE_ANON_KEY=你的supabase_anon_key
```

## 架构

### 技术栈
- **前端**: React 19, TypeScript, Vite
- **样式**: Tailwind CSS 4
- **AI/OCR**: Google Gemini (gemini-3-flash-preview)
- **数据库**: Supabase (PostgreSQL)
- **部署**: Vercel（已配置 vercel.json）

### 核心文件
- `App.tsx`: 主应用程序，包含所有 UI 和业务逻辑
- `services/geminiService.ts`: 使用 Gemini 进行发票 OCR 识别
- `services/supabaseClient.ts`: Supabase 数据库客户端
- `types.ts`: TypeScript 类型定义（InvoiceData、SubmissionRecord 等）

### 数据库表结构

表名：`reimbursement_records`
- 发票字段：invoiceNumber, sellerName, buyerName, sellerTaxId, buyerTaxId, sellerBankAccount, category, amount
- 提交人信息：name, studentId, supervisor, phone, isPaid
- 工作流：status（box → han → assistant → office → success/rejected）, paidEditCount, surveyAnswers, rejectionReason

### 审批流程

报销流程依次经过：`box` → `han` → `assistant` → `office` → `success` 或 `rejected`

### 常量
- 学校：江南大学
- 学校税号：1210000071780177X1
- 管理员学号：6240210040（SUPER_ADMIN_ID）

## 重要说明

**所有模型回答必须使用中文。**
