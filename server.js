// server.js
import express from "express";
import cors from "cors";
// import fs from "fs";
import http from "http";
// import https from "https";
import { WebSocketServer } from 'ws';
import { MongoClient } from "mongodb";

import "dotenv/config";

const app = express()
app.use(cors())
app.use(express.static(`/`))

// const options = {
//     key: fs.readFileSync(`/etc/letsencrypt/live/hrjlhy.com/privkey.pem`),
//     cert: fs.readFileSync(`/etc/letsencrypt/live/hrjlhy.com/fullchain.pem`),
// }

// const httpsServer = https.createServer(options, app)
const httpServer = http.createServer(app);
// const wss = new WebSocketServer({ server: httpsServer });
const wss = new WebSocketServer({ server: httpServer });
// const uri = `mongodb://localhost:27017`
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || `careerTimeline`
const collectionName = process.env.MONGODB_COLLECTION || "projects";
const dashboardCollectionName =
    process.env.MONGODB_DASHBOARD_COLLECTION || "dashboards";

let db;
function getDashboardKey(project) {
    return `${project.year}::${project.name}`;
}

function normalizeDashboard(dashboard) {
    return {
        description: dashboard?.description || "",
        complexity: Number(dashboard?.complexity) || 0,
        ownership: Number(dashboard?.ownership) || 0,
        impact: Number(dashboard?.impact) || 0,
    };
}

async function getProjectsWithDashboards(year) {
    const query = {};

    if (year) {
        query.year = parseInt(year);
    }

    console.log(
        "Using DB:",
        dbName,
        "Projects Collection:",
        collectionName,
        "Dashboards Collection:",
        dashboardCollectionName,
        "Query:",
        query
    );

    const projects = await db.collection(collectionName)
        .find(query)
        .project({ _id: 0, name: 1, URLs: 1, year: 1 })
        .toArray();

    const dashboardKeys = projects.map(getDashboardKey);

    const dashboards = await db.collection(dashboardCollectionName)
        .find({
            dashboardKey: { $in: dashboardKeys }
        })
        .project({
            _id: 0,
            dashboardKey: 1,
            description: 1,
            complexity: 1,
            ownership: 1,
            impact: 1
        })
        .toArray();

    const dashboardMap = new Map(
        dashboards.map((dashboard) => [
            dashboard.dashboardKey,
            dashboard
        ])
    );

    return projects.map((project) => {
        const dashboardKey = getDashboardKey(project);
        const dashboard = dashboardMap.get(dashboardKey);

        return {
            ...project,
            dashboardKey,
            dashboard: normalizeDashboard(dashboard)
        };
    });
}

MongoClient.connect(uri)
    .then((client) => {
        console.log(`✅ Connected to MongoDB`)
        db = client.db(dbName)

	const PORT = process.env.PORT || 3000;

        httpServer.listen(PORT, () => {
            console.log(`🚀 Server running at https://localhost:${PORT}`)
        })

        wss.on('connection', function connection(ws) {
            console.log('✅ New client connected');

            ws.on('message', async function message(data) {
                const msg = JSON.parse(data.toString());
                console.log('📨 Received:', msg);

                if (msg.type === 'projects') {
                    const { year } = msg;

                    const projects = await getProjectsWithDashboards(year);

                    ws.send(JSON.stringify({
                        type: "projects",
                        year: year || "all",
                        data: projects
                    }));
                }
            });

            ws.on('close', () => {
                console.log('❌ Client disconnected');
            });
        });
    })
    .catch(err => console.error(`❌ MongoDB connection failed ${err}`))
