# Flowchart AI Frontend

Flowchart AI Frontend is a React/Vite workspace for creating, editing, animating, comparing, and sharing AI-generated flowcharts in the browser.

## Product capabilities

- Landing and sign-in flows with protected dashboard and editor routes.
- Prompt-based AI generation with selectable screen ratios (`16:9`, `1:1`, `9:16`, and `4:3`).
- React Flow canvas editing with custom nodes, edges, screen layouts, styling, animation timing, and parallel views.
- Step-by-step animation playback and presentation-oriented preview modes.
- Public preview, canvas, and compare routes for shared flowcharts without requiring a viewer login.
- Flowchart CRUD, public sharing, custom arrowhead assets, model settings, and profile/settings screens through the backend API.

## Architecture

The app is a client-side React 18 application bootstrapped by Vite. `App.tsx` defines public, protected, editor, and shared-preview routes. Zustand stores manage authentication and flowchart state; `src/api/client.ts` centralizes Axios calls, bearer-token injection, error handling, and the backend origin from `VITE_API_URL`. React Flow renders the editable canvas, while Tailwind CSS and local component styles provide the UI.

```text
Browser
  ├─ React Router ── public, protected, editor, shared-preview routes
  ├─ Zustand ─────── auth + flowchart state
  ├─ React Flow ──── canvas, nodes, edges, comparison
  └─ Axios ───────── JSON/file requests + JWT
                         │
                         ▼
                  Flowchart AI API
```

## Tech stack

React 18, TypeScript, Vite, React Router, Zustand, Axios, `@xyflow/react`, Tailwind CSS, Headless UI, Lucide, React Dropzone, React Markdown, Lottie React, and React Hot Toast.

## Local setup

1. Install Node.js compatible with the repository’s Vite/TypeScript toolchain.

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Create a frontend environment file and set the backend origin:

   ```bash
   printf 'VITE_API_URL=<backend-origin>\n' > .env.local
   ```

   Keep `.env.local` uncommitted. The API client reads `VITE_API_URL` at build time; if it is omitted, the source currently falls back to its development default.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Build and preview the production bundle:

   ```bash
   npm run build
   npm run preview
   ```

The backend must be running separately, with its `CORS_ORIGINS` configured for the frontend origin.

## Routes

- `/` — landing page or authenticated dashboard redirect.
- `/login` — sign-in.
- `/dashboard` — protected flowchart list and settings shell.
- `/flowchart/:id` — protected full-screen editor.
- `/view/:shareId/preview` — public animated preview.
- `/view/:shareId/canvas` — public canvas view.
- `/view/:shareId/compare` — public comparison view.

## Deployment

`vercel.json` is included for Vercel-style static deployment. Configure `VITE_API_URL` in the deployment environment before building, and configure the backend’s `CORS_ORIGINS` with the resulting frontend origin. No public demo URL is documented here because a verified live deployment URL is not present in the repository metadata.

## Current status

The main authoring and viewing flows are implemented, including the AI generation modal and animated/presentation components. The repository currently commits `node_modules` and `dist`; these are present in the source repository but are not required when installing from `package-lock.json`. No automated test suite or CI workflow is visible, so validate login, generation, editing, sharing, preview, and production build behavior manually before release.

## Security notes

- `VITE_*` values are exposed to the browser; never put API keys or other secrets in them.
- Keep authentication, LLM credentials, database access, and storage credentials in the backend environment only.
- Use environment-specific origins and avoid committing `.env.local` or generated secrets.
