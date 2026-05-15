# CareerTimeline Portfolio

[**Live Demo**](https://www.hrjlhy.com/) · [Repository](https://github.com/hrjlhy123/CareerTimeline)

CareerTimeline is an interactive portfolio website for presenting my software development history, project experience, and technical growth through a WebGPU-powered timeline and a game-style project gallery.

The project is not a traditional static resume page. It combines a 3D timeline, MongoDB-backed project records, WebSocket-based data loading, animated project cards, project dashboards, and custom visual effects to make my past work easier to explore.

## Overview

This site was built to organize my work across web development, AI-integrated systems, full-stack applications, and 3D visualization. Instead of listing projects in a plain text format, CareerTimeline presents projects by year, lets visitors explore them through an animated card interface, and shows short project summaries with simple metrics.

The current version is still mainly written in vanilla JavaScript, HTML, CSS, WebGPU, Node.js, and MongoDB, but the project has been cleaned up and moved toward a more maintainable Vite-based workflow.

## Key Features

### WebGPU 3D Timeline

- Renders a custom 3D timeline belt using WebGPU.
- Loads and parses a COLLADA `.dae` model directly in the browser.
- Uses `gl-matrix` for camera, projection, and model transforms.
- Synchronizes 3D model positions with DOM-based year labels.
- Supports capped scroll input to avoid excessive timeline motion.
- Auto-centers timeline years when hovering project list items.

### MongoDB + WebSocket Project Data

- Loads project data from MongoDB / MongoDB Atlas.
- Uses a Node.js + Express backend with the `ws` WebSocket library.
- The browser requests all projects or projects from a selected year through `/ws`.
- Dashboard metadata is joined from a separate dashboard collection.
- Project cards and project summaries are rendered dynamically from database records.

### Interactive Project Gallery

- Year-based project filtering.
- Horizontal project list with hover and checked states.
- Animated project card stack.
- Lazy iframe loading through `data-src` so demos are not loaded until needed.
- Support for multiple URLs per project with iframe rotation.
- Picked-card mode for focusing one selected project from a larger stack.
- Back button to return from a selected year to the full project list.

### Project Dashboard UI

- Dashboard panel with project title, description, and live link.
- Three simple project metrics: Complexity, Ownership, and Impact.
- Dashboard content updates when hovering project list items or iframe cards.
- Tape-based pinning lets the user lock one dashboard card while browsing.
- Hover synchronization between iframe cards and project list items.

### Visual and Interaction Effects

- Liquid-style project list hover effect.
- Timeline-colored ripple transition when selecting projects.
- Project card deal-in animation.
- Glass-like card styling and year-label highlights.
- Pointer-based global illumination for timeline labels, dashboard metrics, and the back button.
- Title click firework animation.
- Floating contact bubbles as a small easter egg.
- Background reveal easter egg using a canvas mask after idle interaction.

### Deployment-Oriented Updates

- Vite is used for frontend development and production builds.
- Backend runs separately through `node server.js`.
- Production deployment is designed to run the backend behind an Nginx reverse proxy.
- WebSocket requests use the same-origin `/ws` path, which works well behind Nginx.

## Tech Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript ES modules
- WebGPU
- WGSL shaders
- Vite
- `gl-matrix`

### Backend

- Node.js
- Express.js
- `ws` WebSocket server
- MongoDB / MongoDB Atlas
- `dotenv`
- CORS

### Deployment

- Ubuntu server
- Nginx reverse proxy
- Vite production build
- Node.js backend process

## Project Structure

```text
CareerTimeline/
├── index.html              # Main page structure
├── index.css               # Main visual design and interaction styles
├── 3D_model.js             # WebGPU timeline rendering and model animation
├── interaction.js          # UI interactions, project cards, dashboard, WebSocket client
├── read_dae.js             # COLLADA .dae parser for timeline model data
├── server.js               # Express + WebSocket + MongoDB backend
├── vite.config.mjs         # Vite build configuration
├── package.json            # Scripts and dependencies
├── resources/              # Images, icons, models, and visual assets
├── tools/                  # Helper utilities for geometry and coordinate calculation
└── *.wgsl                  # WebGPU shader files
```

## Data Model

### `projects` collection

Each project record should include at least:

```json
{
  "year": 2024,
  "name": "AI Grader",
  "URLs": [
    "https://example.com/demo"
  ]
}
```

### `dashboards` collection

Dashboard records are matched by `dashboardKey`, which is built as:

```text
year::project name
```

Example:

```json
{
  "dashboardKey": "2024::AI Grader",
  "description": "An AI-assisted short-answer grading system using OCR, LLMs, and a full-stack dashboard.",
  "complexity": 88,
  "ownership": 92,
  "impact": 85
}
```

The backend normalizes missing dashboard fields, so projects can still render even if dashboard data is incomplete.

## Environment Variables

Create a `.env` file for the backend:

```env
MONGODB_URI=mongodb+srv://your-user:your-password@your-cluster.mongodb.net/
MONGODB_DB=careerTimeline
MONGODB_COLLECTION=projects
MONGODB_DASHBOARD_COLLECTION=dashboards
PORT=3000
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm start
```

Start the Vite frontend:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Important Local Development Note

The current frontend WebSocket client connects to:

```js
/ws
```

This assumes the frontend and backend are served from the same origin, usually through Nginx in production.

When using Vite dev server locally, the page may run on `localhost:5173`, while the backend may run on `localhost:3000`. In that case, either use a local proxy or add a Vite dev-server proxy for `/ws`.

Example Vite proxy idea:

```js
server: {
  proxy: {
    "/ws": {
      target: "ws://localhost:3000",
      ws: true
    }
  }
}
```

## Production Deployment Notes

A typical production setup is:

1. Build the frontend with Vite.
2. Serve the generated `dist` folder through Nginx.
3. Run `server.js` as a backend process on a local port such as `3000`.
4. Proxy `/ws` from Nginx to the Node.js backend.

Example Nginx WebSocket proxy block:

```nginx
location /ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;

    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

If the frontend is deployed under a subpath, make sure Vite `base`, asset paths, Nginx routing, and WebSocket routing are all aligned.

## Recent Major Updates

Recent work focused on making the portfolio feel more complete, interactive, and deployment-ready:

- Cleaned up tracked local files and prepared the repository for refactoring.
- Added Vite-based build and preview workflow.
- Improved project index UI.
- Added a liquid project list hover effect.
- Optimized iframe showcase behavior and project selection.
- Added timeline-colored ripple transitions for project cards.
- Refined year labels and iframe transitions.
- Added a project back button and background reveal easter egg.
- Added checked and hover synchronization for project list items.
- Refined portfolio interactions and insight UI.
- Added project card deal-in animation.
- Consolidated picked-card state and refined project interactions.
- Added tape-based pinning for project dashboard hover.
- Routed timeline auto-centering through a capped scroll queue.
- Updated backend deployment to run behind an Nginx proxy.

## Current Status

This is an actively evolving personal portfolio project. The current implementation prioritizes originality, interaction design, and technical experimentation. It is also being gradually cleaned up so the codebase can be easier for recruiters, interviewers, and future collaborators to understand.

## Future Improvements

Planned or possible next steps:

- Split large JavaScript files into smaller modules.
- Add clearer project categories and technology filters.
- Improve mobile and small-screen layout behavior.
- Add stronger WebSocket reconnection handling.
- Add screenshots or fallback previews for demos that should not load immediately.
- Improve accessibility for keyboard navigation and reduced-motion users.
- Continue moving toward a cleaner React / TypeScript or component-based structure if needed.

## Author

**Jack Hao**

Full-stack / front-end developer focused on AI-integrated systems, WebGPU-based visualization, real-time browser applications, and data-rich user interfaces.
