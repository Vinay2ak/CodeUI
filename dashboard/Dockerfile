# Multi-stage Dockerfile for CodeBridge Dashboard

# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for all VITE_ environment variables
ARG VITE_USE_MOCKS=false
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_GATEWAY_URL=http://localhost:8080
ARG VITE_BASE_PATH=/
ARG VITE_SIGNIN_URL=http://localhost:5173/login
ARG VITE_ACCOUNT_URL=http://localhost:5176/
ARG VITE_WORKSPACE_URL=http://localhost:5177/
ARG VITE_WS_URL=/ws/events
ARG VITE_DEV_TOOLS=false
ARG VITE_GRAFANA_URL=
ARG VITE_FEATURE_AI_BRIEF=
ARG VITE_DRAFT_PUBLISH=
ARG VITE_FEATURE_AI_VERIFICATION=

# Export ARGs as ENV for the build process
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_SIGNIN_URL=$VITE_SIGNIN_URL
ENV VITE_ACCOUNT_URL=$VITE_ACCOUNT_URL
ENV VITE_WORKSPACE_URL=$VITE_WORKSPACE_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_DEV_TOOLS=$VITE_DEV_TOOLS
ENV VITE_GRAFANA_URL=$VITE_GRAFANA_URL
ENV VITE_FEATURE_AI_BRIEF=$VITE_FEATURE_AI_BRIEF
ENV VITE_DRAFT_PUBLISH=$VITE_DRAFT_PUBLISH
ENV VITE_FEATURE_AI_VERIFICATION=$VITE_FEATURE_AI_VERIFICATION

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime Stage
FROM nginx:1.27-alpine AS runner

# Copy customized Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production static assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

