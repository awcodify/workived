FROM node:22-alpine AS builder

WORKDIR /app

# Copy design tokens (shared dependency)
COPY design/ ./design/

# Copy frontend app
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
WORKDIR /app/apps/web
RUN npm ci --legacy-peer-deps

COPY apps/web/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
