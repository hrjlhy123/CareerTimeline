# CareerTimeline Portfolio

CareerTimeline is a personal portfolio website designed to present my software development experience, project history, and technical growth through an interactive timeline interface.

The project combines a visual career timeline, project showcase area, WebSocket-based data loading, and MongoDB-backed project records. It is currently being refactored toward a more maintainable React / TypeScript / Next.js architecture.

## Overview

This website was built to organize and present my past web development, AI, full-stack, and 3D visualization projects in a more interactive way than a traditional resume.

The current version focuses on:

- Interactive year-based career timeline
- Project list and project showcase display
- MongoDB-backed project data
- WebSocket communication between client and server
- Local HTTPS development server
- Experimental visual design inspired by game-style UI and timeline navigation

## Tech Stack

Current implementation:

- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- WebSocket (`ws`)
- MongoDB / MongoDB Atlas
- HTTPS local development server

Planned refactor:

- Next.js
- React
- TypeScript
- Component-based project explorer
- Lazy-loaded project demos
- Improved project descriptions for recruiters and hiring managers

## Project Goals

The main goal of this project is to make my portfolio easier to understand for both technical and non-technical audiences.

Many of my previous projects were built with vanilla JavaScript, Node.js, AI APIs, WebSocket, WebGPU, and 3D visualization techniques. This site is intended to organize those projects into a clearer presentation, including:

- What each project is
- What problem it solves
- What technologies were used
- What my role was
- Why the project is relevant to full-stack, front-end, AI, or visualization work

## Current Features

- Year-based project timeline
- Project list loaded from MongoDB
- WebSocket-based project query
- Project display area for demos
- Local HTTPS support
- Favicon, metadata, and web app manifest setup
- Basic portfolio branding

## Planned Improvements

The next major updates will focus on improving maintainability, performance, and recruiter readability.

Planned steps:

1. Improve repository structure and documentation
2. Add a structured project data format
3. Build a React / TypeScript Project Explorer
4. Add filtering by year, category, and technology stack
5. Add featured projects for quick recruiter review
6. Replace always-loaded iframes with lazy-loaded demos
7. Add project explanation panels using a dialogue-style UI
8. Refactor the timeline into a standalone rendering module
9. Improve visual polish, background design, glow effects, and animation performance

## Local Development

Install dependencies:

```bash
npm install