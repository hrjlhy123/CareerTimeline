# CareerTimeline Portfolio

[**Live Demo**](https://www.hrjlhy.com/) · [Repository](https://github.com/hrjlhy123/CareerTimeline)

CareerTimeline is an interactive portfolio website for presenting my software development history, project experience, and technical growth through a WebGPU-powered timeline and a game-style project gallery.

It is designed as more than a static resume page. Visitors can browse projects by year, open live previews, view short project summaries, and interact with a custom 3D timeline.

## Overview

This site organizes my work across web development, AI-integrated systems, full-stack applications, and 3D visualization. The current version is mainly built with vanilla JavaScript, HTML, CSS, WebGPU, Node.js, WebSocket, and MongoDB, with a Vite-based frontend build workflow.

Recent updates focused on making the site more reliable across different browsers, screen ratios, and device capabilities while keeping the original interactive experience.

## Key Features

### WebGPU 3D Timeline

- Custom WebGPU timeline belt rendered in the browser.
- COLLADA `.dae` model parsing for timeline geometry.
- DOM year labels synchronized with 3D model positions.
- Scroll and hover interactions for browsing projects by year.

### Project Gallery

- Year-based project filtering.
- Animated project card stack.
- Lazy iframe loading for live demos.
- Support for multiple URLs per project.
- Picked-card mode for focusing on one selected project.
- Back button for returning to the full project list.

### Project Dashboard

- Project title, description, and live link.
- Simple metrics for Complexity, Ownership, and Impact.
- Dashboard updates when hovering project list items or cards.
- Tape-based pinning for locking a selected project summary.

### Compatibility and Accessibility

- Mobile users are redirected to the legacy portfolio page.
- Browsers without graphics acceleration fall back to the legacy page.
- Browsers without WebGPU can still use a simplified project-list layout.
- Layout adjustments for 16:9, 16:10, 4:3, and iPad-like screen ratios.
- Keyboard support for major interactions, including Enter, Space, and Escape.
- Improved focus styles, ARIA states, and reduced-motion handling.

### Visual Effects

- Liquid-style project list hover effect.
- Timeline-colored ripple transition.
- Project card deal-in animation.
- Pointer-based lighting on timeline labels and dashboard elements.
- Title click firework effect.
- Floating contact bubbles as an easter egg.
- Background reveal effect after idle interaction.

## Tech Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript ES modules
- WebGPU / WGSL
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
├── index.css               # Main visual design and responsive styles
├── 3D_model.js             # WebGPU timeline rendering
├── interaction.js          # UI interaction, project cards, dashboard, WebSocket client
├── read_dae.js             # COLLADA .dae parser
├── server.js               # Express + WebSocket + MongoDB backend
├── vite.config.mjs         # Vite configuration
├── package.json            # Scripts and dependencies
├── resources/              # Images, icons, models, and visual assets
├── tools/                  # Helper utilities
└── *.wgsl                  # WebGPU shader files
```

## Data Model

### `projects` collection

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

Dashboard records are matched by `dashboardKey`:

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

## Production Notes

A typical deployment setup is:

1. Build the frontend with Vite.
2. Serve the generated `dist` folder through Nginx.
3. Run `server.js` as a backend process.
4. Proxy `/ws` from Nginx to the Node.js backend.

Example WebSocket proxy block:

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

## Recent Updates

Recent work focused on:

- Vite build workflow.
- Project dashboard and card interactions.
- Lazy iframe loading and iframe performance.
- Responsive layout adjustments.
- WebGPU / no-WebGPU compatibility handling.
- Mobile and low-graphics fallback behavior.
- Keyboard and accessibility improvements.
- Visual refinements such as firework, ripple, hover, and lighting effects.

## Current Status

CareerTimeline is an actively evolving personal portfolio project. The current version prioritizes originality, interaction design, and technical experimentation while gradually improving maintainability and compatibility.

## Future Improvements

- Split large JavaScript files into smaller modules.
- Add clearer project filters and categories.
- Improve fallback previews for live demos.
- Continue improving accessibility and small-screen behavior.
- Consider moving toward a cleaner component-based structure.

## Author

**Jack Hao**

Full-stack / front-end developer focused on AI-integrated systems, WebGPU-based visualization, real-time browser applications, and data-rich user interfaces.
