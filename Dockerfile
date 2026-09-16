# Etapa 1: instala dependencias y compila la app
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Las variables NEXT_PUBLIC_* se incrustan en el bundle al compilar, no al
# arrancar el servidor, así que tienen que llegar como ARG del build (no
# sirve pasarlas solo como variables de entorno del servicio en Cloud Run).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# Etapa 2: imagen final, liviana, solo con lo necesario para correr
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Cloud Run inyecta PORT (normalmente 8080) y espera que el contenedor
# escuche en ese puerto; el server.js de la salida standalone ya lo respeta.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
