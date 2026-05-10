# ── Stage: production image ───────────────────────────────────────────────────
FROM node:20-alpine

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy dependency manifests first (layer-cache optimisation)
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source
COPY . .

# Create uploads directory (volume-mounted at runtime, but must exist)
RUN mkdir -p uploads

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
