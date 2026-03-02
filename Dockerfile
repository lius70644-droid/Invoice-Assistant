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

# Install nginx
RUN apk add --no-cache nginx bash

# Copy backend
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/node_modules ./node_modules

# Copy frontend build
COPY --from=frontend /app/frontend/dist ./dist/client

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 3000

CMD ["sh", "-c", "node dist/index.js & nginx -g 'daemon off;'"]
