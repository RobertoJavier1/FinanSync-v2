# FinanSync — Web App

Aplicación web de finanzas personales construida con **Next.js 15 + React 18 + TypeScript + Tailwind CSS**, conectada a **Cloud Firestore** y con integración de **Gemini 2.5 Flash** para sugerencias personalizadas y un consultor financiero en tiempo real.

Esta es la entrega **Proyecto Final** del curso Full Stack Web & Mobile con Integración de IA — Mayo 2026. La app comparte la misma base de datos en Firestore con la versión Android, por lo que un usuario puede acceder con las mismas credenciales desde cualquier plataforma y los cambios se sincronizan en ambas direcciones.

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
| Firebase Auth | 12.11 | Autenticación email + Google Sign-In |
| Firebase Firestore | 12.11 | Base de datos con sincronización Android |
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

Crear el archivo `.env.local` en la raíz de `/web` con las siguientes variables:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Gemini
GEMINI_API_KEY=tu_clave_de_Google_AI_Studio
```

**Firebase:** ir a [Firebase Console](https://console.firebase.google.com), crear un proyecto, agregar una app web y copiar el objeto de configuración.  
**Gemini:** obtener la clave gratis en [Google AI Studio](https://aistudio.google.com/) seleccionando el modelo `gemini-2.5-flash`.

> `.env.local` está en `.gitignore` y nunca se versiona.

### 4. Habilitar servicios en Firebase Console

- **Authentication** → Sign-in method → **Correo electrónico/Contraseña** ✅
- **Authentication** → Sign-in method → **Google** ✅
- **Firestore Database** → Crear base de datos en modo producción.

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
| **Registro** | `/registrarse` | Crea cuenta en Firebase Auth + perfil en Firestore |
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
│   ├── AuthContext.tsx             # Sesión Firebase Auth
│   ├── FinanzasContext.tsx         # Estado global de transacciones, presupuestos, metas
│   ├── NotifContext.tsx            # Alertas y notificaciones en app
│   └── ThemeContext.tsx            # Modo oscuro persistido en Firestore
└── lib/
    ├── firebase.ts                 # Inicialización Firebase
    ├── transacciones.ts            # CRUD Firestore — transacciones
    ├── presupuestos.ts             # CRUD Firestore — presupuestos
    └── metas.ts                    # CRUD Firestore — metas
```

---

## ☁️ Estructura de datos en Firestore

La estructura es **idéntica entre Web y Android** — ambas plataformas comparten las mismas colecciones.

| Colección | Campos principales |
|---|---|
| `usuarios` / `users` | `nombre`, `email`, `creadoEn`, `preferencias.{moneda, categorias, tema, alertasPresupuesto, progresoMetas, recomendacionesIA}` |
| `transacciones` | `uid`, `descripcion`, `categoria`, `monto`, `tipo` (INGRESO/GASTO), `fecha`, `icono`, `monedaOrigen` |
| `presupuestos` | `uid`, `categoria`, `limiteMonthly`, `mes`, `anio`, `colorHex`, `icono`, `monedaOrigen` |
| `metas` | `uid`, `nombre`, `objetivo`, `actual`, `fechaLimite`, `colorHex`, `icono`, `completada`, `monedaOrigen` |
| `recurrentes` | `uid`, `descripcion`, `categoria`, `monto`, `tipo`, `frecuencia`, `proximaFecha`, `activa`, `monedaOrigen` |

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

## 🔐 Reglas de Firestore

Pegar en Firebase Console → Firestore → Reglas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /transacciones/{doc} {
      allow read:           if request.auth != null && resource.data.uid == request.auth.uid;
      allow create:         if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
    match /presupuestos/{doc} {
      allow read:           if request.auth != null && resource.data.uid == request.auth.uid;
      allow create:         if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
    match /metas/{doc} {
      allow read:           if request.auth != null && resource.data.uid == request.auth.uid;
      allow create:         if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
    match /recurrentes/{doc} {
      allow read:           if request.auth != null && resource.data.uid == request.auth.uid;
      allow create:         if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

---

## 📄 Documentación adicional

- 📘 [`FinanSync-DocumentaciónFinal.pdf`](./FinanSync-DocumentaciónFinal.pdf) — documentación completa de la entrega final.
- 📊 [`FinanSync-DiagramasProyectoFinal.pdf`](./FinanSync-DiagramasProyectoFinal.pdf) — diagramas de arquitectura, autenticación, Firestore, Gemini y navegación.
