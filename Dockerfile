# CAP Trellis — production image (Next.js standalone output)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# build-time page data (login screen etc.) comes from a throwaway embedded DB
ENV DATABASE_URL=pglite://memory
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

RUN addgroup -S trellis && adduser -S trellis -G trellis

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# uploads + embedded-db files live under /app/data — mount a volume here
RUN mkdir -p /app/data && chown -R trellis:trellis /app

USER trellis
EXPOSE 3100
CMD ["node", "server.js"]
