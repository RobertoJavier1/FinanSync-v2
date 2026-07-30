# FinanSync — Web App

Aplicación web de finanzas personales construida con **Next.js 15 + React 18 + TypeScript + Tailwind CSS**, conectada a **Supabase (Postgres + Auth)** y con integración de **Gemini 2.5 Flash** para sugerencias personalizadas y un consultor financiero en tiempo real.

Esta es la entrega **Proyecto Final** del curso Full Stack Web & Mobile con Integración de IA — Mayo 2026.

> **Migración a Supabase.** La versión original usaba Firebase Auth + Cloud Firestore. Ahora el backend es Supabase: los datos viven en cinco tablas de Postgres (`usuarios`, `categorias`, `transacciones`, `metas`, `presupuestos`) con Row Level Security, y la autenticación usa Supabase Auth con sesión en cookies. El schema completo está en [`supabase/migrations/0001_schema_inicial.sql`](supabase/migrations/0001_schema_inicial.sql).

---

## 🌐 Live Demo

**[https://finan-sync-dun.vercel.app/](https://finan-sync-dun.vercel.app/)**

---

## 🎬 Video demo

**[https://youtu.be/jUmD25vVK48](https://youtu.be/jUmD25vVK48)**

---

## 🚀 Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15.2.4 | Framework principal — App Router, API Routes, SSR |
| React | 18.3 | UI con hooks y Context API |
| TypeScript | 5 | Tipado estático en toda la app |
| Tailwind CSS | 3.4 | Estilos utilitarios |
| Recharts | 2.15 | AreaChart, PieChart, LineChart, BarChart |
| Lucide React | 0.475 | Iconografía |
| Supabase Auth | 2.111 | Autenticación email + Google (OAuth) |
| Supabase Postgres | 2.111 | Base de datos relacional con Row Level Security |
| @supabase/ssr | 0.12 | Sesión en cookies, compartida entre cliente y servidor |
| @google/generative-ai | 0.24 | Gemini 2.5 Flash — sugerencias y chat IA |
| jsDelivr Currency API | pública | Tasas de cambio en tiempo real (caché 24h) |

---

## ⚙️ Configuración local

### 1. Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18.17 |
| npm | 9 |

### 2. Clonar e instalar

```bash
git clone https://github.com/RobertoJavier1/FinanSync
cd FinanSync/FinalProject/web
npm install
```

### 3. Variables de entorno

Hay una plantilla lista en `.env.local.example`; basta copiarla a la raíz del proyecto y rellenar los valores:

```bash
cp .env.local.example .env.local
```

```env
# Supabase — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key

# Gemini
GEMINI_API_KEY=tu_clave_de_Google_AI_Studio
```

**Supabase:** en [supabase.com/dashboard](https://supabase.com/dashboard) abrir el proyecto → *Project Settings* → *API* y copiar la URL y la clave `anon`.
**Gemini:** obtener la clave gratis en [Google AI Studio](https://aistudio.google.com/) seleccionando el modelo `gemini-2.5-flash`.

> La clave `anon` es pública por diseño: quien limita el acceso a los datos son las políticas RLS. La `service_role` key nunca debe ponerse en una variable `NEXT_PUBLIC_`.
>
> `.env.local` está en `.gitignore` y nunca se versiona.

### 4. Crear el schema y habilitar los proveedores en Supabase

1. **SQL Editor** → *New query* → pegar el contenido de `supabase/migrations/0001_schema_inicial.sql` → *Run*. Esto crea las cinco tablas, los índices, las políticas RLS y el trigger que genera el usuario y sus categorías al registrarse.
2. **Authentication → Providers → Email** ✅ (para desarrollo conviene desactivar *Confirm email*, si no el registro no devuelve sesión hasta abrir el correo).
3. **Authentication → Providers → Google** ✅ pegando el Client ID y Client Secret de Google Cloud Console.
4. **Authentication → URL Configuration → Redirect URLs**, agregar:
   - `http://localhost:3000/auth/callback`
   - `https://TU-DOMINIO.vercel.app/auth/callback`

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

### 6. Build de producción

```bash
npm run build
npm start
```

---

## 📱 Pantallas implementadas

| Pantalla | Ruta | Descripción |
|---|---|---|
| **Login** | `/` | Email/contraseña + Google Sign-In |
| **Registro** | `/registrarse` | Crea cuenta en Supabase Auth + perfil vía trigger |
| **Dashboard** | `/dashboard` | Saldo total, gráficas de área y pie, alertas, sugerencias IA |
| **Transacciones** | `/transacciones` | Lista con buscador, filtro por tipo y mes, eliminar |
| **Agregar Transacción** | `/transacciones/agregar` | Formulario con categorías, conversión de moneda |
| **Presupuesto** | `/presupuesto` | CRUD de presupuestos con progreso real por categoría |
| **Metas** | `/metas` | CRUD de metas de ahorro con aportes |
| **Perspectivas IA** | `/perspectivas-ia` | Health Score, análisis automático, comparativa por categorías |
| **Chat IA** | `/chat-ia` | Consultor financiero conversacional con Gemini |
| **Configuración** | `/configuracion` | Perfil, moneda, notificaciones, apariencia (modo oscuro) |

---

## 🗂️ Estructura del proyecto

```
web/
├── app/
│   ├── layout.tsx                  # Root layout (fuente Inter)
│   ├── globals.css                 # Directivas Tailwind
│   ├── page.tsx                    # Login
│   ├── registrarse/page.tsx        # Registro
│   ├── (app)/
│   │   ├── layout.tsx              # Layout con Sidebar
│   │   ├── dashboard/page.tsx
│   │   ├── transacciones/page.tsx
│   │   ├── transacciones/agregar/page.tsx
│   │   ├── presupuesto/page.tsx
│   │   ├── metas/page.tsx
│   │   ├── perspectivas-ia/page.tsx
│   │   ├── chat-ia/page.tsx
│   │   └── configuracion/page.tsx
│   └── api/
│       ├── chat/route.ts           # Endpoint Gemini chat
│       ├── perspectivas/route.ts   # Endpoint Gemini sugerencias
│       └── tipo-cambio/route.ts    # Endpoint tasas de cambio
├── components/
│   └── layout/Sidebar.tsx          # Sidebar fijo con navegación activa
├── context/
│   ├── AuthContext.tsx             # Sesión de Supabase Auth
│   ├── FinanzasContext.tsx         # Moneda (tabla usuarios) y categorías (tabla categorias)
│   ├── NotifContext.tsx            # Preferencias de notificaciones (tabla usuarios)
│   └── ThemeContext.tsx            # Modo oscuro persistido en el navegador
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Cliente para el navegador
│   │   ├── server.ts               # Cliente para Server Components y API Routes
│   │   └── types.ts                # Tipos de las tablas
│   ├── categorias.ts               # CRUD Postgres — categorías (traduce nombre ↔ id)
│   ├── transacciones.ts            # CRUD Postgres — transacciones
│   ├── presupuestos.ts             # CRUD Postgres — presupuestos
│   └── metas.ts                    # CRUD Postgres — metas
├── middleware.ts                   # Refresco de sesión + protección de rutas
└── supabase/
    └── migrations/
        └── 0001_schema_inicial.sql # Tablas, índices, RLS y triggers
```

---

## 🗄️ Estructura de datos en Postgres

El modelo sigue el diagrama entidad-relación del proyecto: cinco tablas, todas colgando del usuario con `ON DELETE CASCADE`, así que borrar una cuenta arrastra todos sus datos.

| Tabla | Columnas principales |
|---|---|
| `usuarios` | `id_usuario` (= `auth.users.id`), `nombre`, `email`, `moneda`, `notif_presupuesto`, `notif_metas`, `notif_ia`, `categorias` (`text[]`, derivada), `creado_en` |
| `categorias` | `id_categoria`, `id_usuario`, `nombre`, `creado_en` — único por (`id_usuario`, `nombre`) |
| `transacciones` | `id_transaccion`, `id_usuario`, `id_categoria`, `descripcion`, `monto`, `tipo` (enum `income`/`expense`), `fecha` (`date`), `moneda_origen`, `creado_en` |
| `presupuestos` | `id_presupuesto`, `id_usuario`, `id_categoria`, `limite_mensual`, `mes`, `anio`, `color`, `icono`, `moneda_origen`, `creado_en` — único por (`id_usuario`, `id_categoria`, `mes`, `anio`) |
| `metas` | `id_meta`, `id_usuario`, `nombre`, `objetivo`, `monto_actual`, `fecha_limite`, `color`, `icono`, `moneda_origen`, `creado_en` |

`usuarios` no reemplaza a `auth.users` — esa tabla la administra Supabase y no se toca. Es una tabla espejo en el esquema `public`, con el mismo id, donde sí se pueden guardar campos propios.

**`usuarios.categorias` es derivada, no una segunda copia.** El diagrama entidad-relación del proyecto tiene el campo `categorias` dentro de `Usuarios` *y además* la tabla `Categorias`. La misma información en dos lugares suele acabar en datos que no coinciden, así que aquí la copia no la escribe la aplicación: dos triggers la mantienen. `sincronizar_categorias_usuario()` rearma el arreglo cada vez que se inserta, actualiza o borra una fila de `categorias`, y `usuarios_categorias_solo_lectura()` lo recalcula antes de cualquier `update` sobre `usuarios`, de modo que el campo no se puede dejar mal ni a propósito. La fuente de la verdad sigue siendo la tabla `categorias`, porque es la que `transacciones` y `presupuestos` referencian por llave foránea.

**`metas` no tiene columna `completada`**, también como en el diagrama. Una meta está cumplida cuando `monto_actual >= objetivo`, y eso ya se sabe con los datos guardados; una columna aparte podría quedar en `false` con la meta ya alcanzada. `lib/metas.ts` la calcula al leer, así que la interfaz `Meta` que usan las páginas sigue teniendo `completada: boolean`.

**Qué pasa al borrar una categoría.** Las dos llaves foráneas hacia `categorias` se comportan distinto a propósito: en `transacciones` es `ON DELETE SET NULL`, así que la transacción se conserva y solo queda sin clasificar (un `CASCADE` ahí borraría el historial financiero del usuario); en `presupuestos` es `ON DELETE CASCADE`, porque un presupuesto de una categoría que ya no existe no significa nada. La pantalla de Configuración pide confirmación antes de quitar una categoría.

**Cambios frente al modelo anterior de Firestore.** El `uid` suelto pasó a ser `id_usuario` con clave foránea real. El campo `tipo` dejó de ser texto libre (`INGRESO`/`GASTO`) y ahora es un enum que Postgres valida. Las dos fechas de cada transacción (`fecha` + `fechaISO`) se unificaron en una sola columna `date`. Las categorías dejaron de ser un arreglo de texto dentro del documento del usuario y son filas propias con llave foránea. Y las preferencias del usuario dejaron de ser campos sueltos en `users/{uid}` para vivir en `usuarios`, con una fila creada automáticamente por un trigger al registrarse.

Las páginas siguen trabajando con nombres de categoría, no con ids: la traducción entre ambos la hace `lib/categorias.ts` y es invisible para los componentes.

---

## 💱 Conversión de monedas

El endpoint `/api/tipo-cambio` consulta la API pública de jsDelivr y cachea las tasas en memoria por 24 horas. Cada transacción guarda su `monedaOrigen` y se convierte al renderizar — el histórico permanece fiel y las tasas frescas se aplican siempre.

**Monedas soportadas:** GTQ, MXN, USD, EUR, COP, ARS.

---

## 🤖 Integración con Gemini 2.5 Flash

**Sugerencias de ahorro (Dashboard)**  
El endpoint `/api/perspectivas` recibe el contexto financiero del usuario y devuelve 4 sugerencias en formato `N.emoji|título|consejo`. Respeta el toggle `recomendacionesIA` de Configuración.

**Chat IA**  
El endpoint `/api/chat` adjunta el contexto financiero real (saldo, ingresos, gastos, top categorías, presupuestos, metas) y un system prompt estricto que restringe la IA a temas financieros. Si la pregunta es off-topic responde con un mensaje de rechazo fijo.

**Health Score (0–100)** — Cálculo local: `40 + tasaAhorro × 100`, clamped entre 40 y 100. Misma fórmula exacta que Android.

---

## 🔐 Seguridad — Row Level Security

Las reglas de Firestore se reemplazaron por políticas RLS, que Postgres aplica dentro de la propia base de datos: no importa qué consulta mande el cliente, solo puede alcanzar sus propias filas.

Las cinco tablas tienen RLS activo y una política por operación con la forma:

```sql
create policy "transacciones: leer las propias"
  on public.transacciones for select
  using (auth.uid() = user_id);
```

Son 20 políticas en total (select / insert / update / delete por tabla). En `usuarios` la comparación es `auth.uid() = id_usuario`, porque ese id *es* el del usuario.

Cuatro funciones completan el esquema:

| Función | Qué hace |
|---|---|
| `handle_new_user()` | Trigger `after insert on auth.users`. Crea la fila de `usuarios` con el `nombre` que viene en los metadatos (o el `full_name` que manda Google) y las ocho categorías por defecto como filas de `categorias`. Esto arregla un bug del modelo anterior: quien entraba con Google nunca obtenía documento de perfil. |
| `sincronizar_categorias_usuario()` | Trigger `after insert or update or delete on categorias`. Vuelve a armar `usuarios.categorias` para el usuario afectado. |
| `usuarios_categorias_solo_lectura()` | Trigger `before update on usuarios`. Recalcula `usuarios.categorias` desde la tabla `categorias`, para que el campo no se pueda escribir a mano. |
| `eliminar_mi_cuenta()` | `security definer`, así que puede borrar de `auth.users` sin exponer la `service_role` key en el navegador. Solo borra al usuario de la sesión actual (`auth.uid()`), y el `on delete cascade` arrastra categorías, transacciones, metas y presupuestos. Se llama desde Configuración con `supabase.rpc('eliminar_mi_cuenta')`. |

---

## 📄 Documentación adicional

- 📘 [`FinanSync-DocumentaciónFinal.pdf`](./FinanSync-DocumentaciónFinal.pdf) — documentación completa de la entrega final.
- 📊 [`FinanSync-DiagramasProyectoFinal.pdf`](./FinanSync-DiagramasProyectoFinal.pdf) — diagramas de arquitectura, autenticación, base de datos, Gemini y navegación.

> Los diagramas y la documentación PDF describen el modelo original con Firebase. La arquitectura de datos y autenticación vigente es la descrita en este README.
