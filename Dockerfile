# 1. Base image for dependencies
FROM node:18-alpine AS base

# 2. Dependency installation
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production

# 3. Build step
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 4. Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user and group
RUN addgroup -g 1001 -S nextjs && \
    adduser -S nextjs -u 1001

# Copy standalone output
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
