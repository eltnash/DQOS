# Build stage
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Coolify: set these as *build* arguments on each app (prod vs dev use different Supabase projects).
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG GATEKEEPER_RELAXED_EXECUTION=false
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
ENV GATEKEEPER_RELAXED_EXECUTION=$GATEKEEPER_RELAXED_EXECUTION

RUN node scripts/write-environment.mjs
RUN npm run build

# Runtime stage
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/mraai/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
