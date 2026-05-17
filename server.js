// server.js
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { MongoClient } from "mongodb";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "careerTimeline";
const collectionName = process.env.MONGODB_COLLECTION || "projects";
const dashboardCollectionName =
    process.env.MONGODB_DASHBOARD_COLLECTION || "dashboards";

if (!MONGODB_URI) {
    console.error("❌ Missing MONGODB_URI in .env");
    process.exit(1);
}

// 只暴露 Vite build 后的 dist，不要暴露系统根目录
const staticDir = path.join(__dirname, "dist");

app.use(
    express.static(staticDir, {
        dotfiles: "ignore",
        index: false,
        maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    })
);

// 前端 SPA fallback：不是资源文件的请求才返回 index.html
app.get(/^\/(?!ws).*/, (req, res, next) => {
    if (path.extname(req.path)) return next();

    res.sendFile(path.join(staticDir, "index.html"));
});

const httpServer = http.createServer(app);

// 明确只接受 /ws
const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
});

let db;

function getDashboardKey(project) {
    return `${project.year}::${project.name}`;
}

function normalizeDashboard(dashboard) {
    return {
        description: String(dashboard?.description || ""),
        complexity: Number(dashboard?.complexity) || 0,
        ownership: Number(dashboard?.ownership) || 0,
        impact: Number(dashboard?.impact) || 0,
    };
}

function parseRequestedYear(rawYear) {
    if (rawYear === undefined || rawYear === null || rawYear === "" || rawYear === "all") {
        return null;
    }

    const year = Number(rawYear);

    if (!Number.isInteger(year) || year < 2017 || year > 2025) {
        throw new Error("Invalid year");
    }

    return year;
}

function sendJSON(ws, payload) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

async function getProjectsWithDashboards(year) {
    const query = year ? { year } : {};

    const projects = await db
        .collection(collectionName)
        .find(query)
        .project({ _id: 0, name: 1, URLs: 1, year: 1 })
        .toArray();

    const dashboardKeys = projects.map(getDashboardKey);

    const dashboards = await db
        .collection(dashboardCollectionName)
        .find({ dashboardKey: { $in: dashboardKeys } })
        .project({
            _id: 0,
            dashboardKey: 1,
            description: 1,
            complexity: 1,
            ownership: 1,
            impact: 1,
        })
        .toArray();

    const dashboardMap = new Map(
        dashboards.map((dashboard) => [dashboard.dashboardKey, dashboard])
    );

    return projects.map((project) => {
        const dashboardKey = getDashboardKey(project);
        const dashboard = dashboardMap.get(dashboardKey);

        return {
            ...project,
            dashboardKey,
            dashboard: normalizeDashboard(dashboard),
        };
    });
}

async function main() {
    const client = new MongoClient(MONGODB_URI);

    await client.connect();
    db = client.db(dbName);

    console.log("✅ Connected to MongoDB");

    wss.on("connection", (ws) => {
        console.log("✅ New WebSocket client connected");

        ws.on("message", async (rawData) => {
            try {
                const msg = JSON.parse(rawData.toString());

                if (msg.type !== "projects") {
                    sendJSON(ws, {
                        type: "error",
                        message: "Unsupported message type",
                    });
                    return;
                }

                const year = parseRequestedYear(msg.year);
                const projects = await getProjectsWithDashboards(year);

                sendJSON(ws, {
                    type: "projects",
                    year: year || "all",
                    data: projects,
                });
            } catch (error) {
                console.error("❌ WebSocket message failed:", error);

                sendJSON(ws, {
                    type: "error",
                    message: "Failed to load projects",
                });
            }
        });

        ws.on("close", () => {
            console.log("❌ WebSocket client disconnected");
        });
    });

    httpServer.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

main().catch((error) => {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
});