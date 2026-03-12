# Technology Stack

**Analysis Date:** 2026-03-13

## Languages

**Primary:**
- JavaScript (ES2022+) - All application code
- JSX - React component markup in `src/App.jsx`

## Runtime

**Environment:**
- Node.js - Runtime for dev server and build tooling

**Package Manager:**
- npm - Dependency management
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React 18.2.0 - UI library and component framework
  - `react-dom` 18.2.0 - DOM rendering

**Build/Dev:**
- Vite 5.1.0 - Build tool and dev server
  - `@vitejs/plugin-react` 4.2.1 - React JSX Fast Refresh support

## Key Dependencies

**Critical:**
- react 18.2.0 - Provides `useState`, `useEffect`, `useRef` hooks for state management and side effects
- react-dom 18.2.0 - Mounts React components to DOM at `#root` in `index.html`
- vite 5.1.0 - Hot module replacement dev server and production build
- @vitejs/plugin-react 4.2.1 - Enables JSX transformation without Babel configuration

**No additional runtime dependencies** - The application implements all game logic, UI components, and state management using React hooks alone. No third-party UI libraries, no ORM, no state management library (Redux/Zustand).

## Configuration

**Environment:**
- Single configuration file: `vite.config.js`
- No environment variables required for core functionality
- API keys (if any) would be client-side (see INTEGRATIONS.md)

**Build:**
- `vite.config.js` - Minimal Vite configuration using React plugin
- `index.html` - Entry point with `<div id="root">` and Playfair Display/Barlow font imports from Google Fonts
- `src/main.jsx` - React StrictMode initialization

## Platform Requirements

**Development:**
- Node.js (version unspecified, recommend 18 LTS+)
- npm 9+
- Any modern browser with ES2022 support

**Production:**
- Deployed to Vercel
- `vercel.json` - Routing configuration for SPA (Single Page Application)
  - Routes all requests to `/` for React Router (if implemented) or single-file SPA handling

## Build & Deployment

**Scripts:**
```
npm run dev      # Start Vite dev server (default: http://localhost:5173)
npm run build    # Vite build to `dist/` directory
npm run preview  # Preview production build locally
```

**Output:**
- Production build artifacts in `dist/`
- Served from Vercel via `vercel.json` SPA configuration

## Static Assets

**Fonts (from Google Fonts CDN):**
- Playfair Display (700, 900, 400-italic) - Headings
- Barlow Condensed (400, 500, 600, 700, 800) - Labels and UI
- JetBrains Mono (400, 500, 700) - Monospace for data

**Icons:**
- `public/favicon.svg` - Favicon

**Verification:**
- `public/riot.txt` - Riot Games verification file (contains GUID)

## Notable Constraints

**No backend framework** - Single-file React SPA with all logic client-side
**No database** - Seed data and mock accounts hardcoded in `src/App.jsx` (lines 160-171)
**No authentication backend** - Mock authentication logic in App component (line 4426)
**No external package dependencies beyond React + build tools** - Intentionally minimal to reduce complexity

---

*Stack analysis: 2026-03-13*
