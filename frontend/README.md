# 🖥️ Tactical Dashboard Frontend & Express API Server

This folder contains the React + Vite dashboard and the lightweight Express API server for the Geospatial Fire & Industrial Anomaly Risk Engine.

For complete project documentation, data pipelines, and architecture diagrams, see the [Root README](../README.md).

---

## 🚀 Running the Frontend & Backend

You need two terminal windows running concurrently:

### Terminal 1: Express Data Server (Port 3001)
Serves paginated fires, facilities, and summary stats from `server/data/*.json`:

```bash
npm run server
```

- Server URL: `http://localhost:3001`
- Endpoints:
  - `GET /api/fires` (paginated episodes with search & risk filters)
  - `GET /api/fires/map` (lightweight markers for Leaflet clustering)
  - `GET /api/facilities` (monitored industrial facilities)
  - `GET /api/stats` (dashboard aggregated statistics)

### Terminal 2: React Tactical Dashboard (Port 3000)
Runs the Vite development server:

```bash
npm run dev
```

- App URL: [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start the Vite client on `http://localhost:3000` |
| `npm run server` | Start the Express REST API server on `http://localhost:3001` |
| `npm run build` | Compile the TypeScript and Vite production bundle into `dist/` |
| `npm run preview` | Locally preview the production build |
| `npm run lint` | Run `tsc --noEmit` to validate TypeScript types |
| `npm run clean` | Clean build outputs (`dist/`, `server.js`) |

---

## 🔄 Re-generating Server Data

To update the JSON datasets used by the Express server from latest pipeline results:
```bash
python server/export_json.py
```

To update the offline TypeScript static data fallback:
```bash
python generate_frontend_data.py
```
