# Docker 部署指南

## 前置要求

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. 配置 Docker 镜像加速器（解决网络问题）

## 配置步骤

### 1. 配置镜像加速器

打开 Docker Desktop → Settings → Docker Engine，添加以下配置：

```json
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填入实际值：

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的实际配置
```

必须配置的值：
- `SUPABASE_URL` - 你的 Supabase 项目 URL
- `SUPABASE_ANON_KEY` - 你的 Supabase Anon Key
- `ALIYUN_ACCESS_KEY_ID` - 阿里云 Access Key ID
- `ALIYUN_ACCESS_KEY_SECRET` - 阿里云 Access Key Secret
- `ADMIN_PASSWORD` - 管理员密码
- `JWT_SECRET` - JWT 密钥（建议使用随机字符串）

### 3. 构建和运行

```bash
# 构建镜像
docker-compose build

# 启动容器
docker-compose up -d
```

### 4. 访问应用

- 前端：http://localhost
- API：http://localhost/api

## 生产部署到云服务器

### 方式一：直接在服务器构建（推荐）

```bash
# 1. 克隆代码
git clone <your-repo-url>
cd fapiao_zhushou_wang

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际配置

# 3. 构建并启动
docker-compose up -d --build
```

### 方式二：使用 Docker Hub 镜像

```bash
# 1. 在本地构建并推送镜像
docker-compose build
docker tag fapiao_zhushou_wang-app:latest yourusername/fapiao-app:latest
docker push yourusername/fapiao-app:latest

# 2. 在服务器拉取并运行
docker pull yourusername/fapiao-app:latest
docker run -d -p 80:80 -p 3000:3003 --env-file .env yourusername/fapiao-app:latest
```

## 目录结构

```
.
├── Dockerfile              # Docker 镜像构建文件
├── docker-compose.yml      # Docker Compose 配置
├── nginx.conf              # Nginx 配置
├── .env.example            # 环境变量模板
├── .dockerignore           # Docker 忽略文件
├── 风味组报销助手/            # 前端代码
└── server/                 # 后端代码
```
