# syntax=docker/dockerfile:1

# ---- Build the static React bundle ----------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- Serve it with an unprivileged Nginx ----------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
# Upstream for /api requests; overridden per environment (Compose, Kubernetes).
ENV API_UPSTREAM=http://backend:8000
# Files in /etc/nginx/templates are rendered with envsubst at container start.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
