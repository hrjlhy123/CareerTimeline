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
const architectureCollectionName =
    process.env.MONGODB_ARCHITECTURE_COLLECTION || "projectArchitectures";

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

function normalizeArchitecture(architecture) {
    if (!architecture) {
        return {
            architectureAvailable: false,
            architecturePreviewAvailable: false,

            architectureMermaidPreview: "",
            mermaidPreview: "",
            architectureMermaid: "",
            mermaid: "",
            fullArchitectureMermaid: "",

            preview: {
                mermaid: "",
            },

            frontendSummary: "",
            backendSummary: "",
            dataSummary: "",
            skipReason: "No architecture record found",

            containsWebGPU: false,
            containsAI: false,
            containsExternalService: false,
            externalCategories: [],
        };
    }

    const previewMermaid = String(
        architecture.architectureMermaidPreview ||
        architecture.mermaidPreview ||
        architecture.architecture?.preview?.mermaid ||
        ""
    );

    const fullMermaid = String(
        architecture.fullArchitectureMermaid ||
        architecture.architectureMermaid ||
        architecture.mermaid ||
        architecture.architecture?.mermaid ||
        ""
    );

    // 小背景图优先用 preview；如果没有 preview，再 fallback 到 full。
    const backgroundMermaid = previewMermaid || fullMermaid;

    const architectureAvailable =
        architecture.architectureAvailable !== false &&
        architecture.architectureStatus !== "skipped" &&
        Boolean(backgroundMermaid.trim());

    return {
        architectureAvailable,
        architecturePreviewAvailable: Boolean(previewMermaid.trim()),

        architectureStatus: architecture.architectureStatus || "",
        architectureStyle: architecture.architectureStyle || "",
        architectureKind: architecture.architectureKind || "",
        architecturePriority: architecture.architecturePriority || "",
        architectureConfidence: architecture.architectureConfidence || "",
        architectureSummary: String(architecture.architectureSummary || ""),
        recruiterTakeaway: String(architecture.recruiterTakeaway || ""),

        frontendSummary: String(
            architecture.frontendSummary ||
            architecture.frontEnd?.summary ||
            ""
        ),
        backendSummary: String(
            architecture.backendSummary ||
            architecture.backEnd?.summary ||
            ""
        ),
        dataSummary: String(
            architecture.dataSummary ||
            architecture.dataAndStorage?.summary ||
            ""
        ),
        skipReason: String(architecture.skipReason || ""),

        architectureMermaidPreview: backgroundMermaid,
        mermaidPreview: backgroundMermaid,

        architectureMermaid: backgroundMermaid,
        mermaid: backgroundMermaid,

        fullArchitectureMermaid: fullMermaid,

        preview: {
            mermaid: backgroundMermaid,
        },

        containsWebGPU: Boolean(architecture.containsWebGPU),
        containsAI: Boolean(architecture.containsAI),
        containsExternalService: Boolean(architecture.containsExternalService),
        externalCategories: Array.isArray(architecture.externalCategories)
            ? architecture.externalCategories
            : [],
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

    const [dashboards, architectures] = await Promise.all([
        db
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
            .toArray(),

        db
            .collection(architectureCollectionName)
            .find({ "projectRef.dashboardKey": { $in: dashboardKeys } })
            .project({
                _id: 0,
                "projectRef.dashboardKey": 1,

                architectureAvailable: 1,
                architecturePreviewAvailable: 1,
                architectureStatus: 1,
                architectureStyle: 1,
                architectureKind: 1,
                architecturePriority: 1,
                architectureConfidence: 1,
                architectureSummary: 1,
                recruiterTakeaway: 1,

                frontendSummary: 1,
                backendSummary: 1,
                dataSummary: 1,
                skipReason: 1,

                // preview / compact background diagram
                architectureMermaidPreview: 1,
                mermaidPreview: 1,
                "architecture.preview.mermaid": 1,

                // full diagram fallback
                architectureMermaid: 1,
                mermaid: 1,
                "architecture.mermaid": 1,

                // layer tags
                containsWebGPU: 1,
                containsAI: 1,
                containsExternalService: 1,
                externalCategories: 1,

                "frontEnd.summary": 1,
                "backEnd.summary": 1,
                "dataAndStorage.summary": 1,
            })
            .toArray(),
    ]);

    const dashboardMap = new Map(
        dashboards.map((dashboard) => [dashboard.dashboardKey, dashboard])
    );

    const architectureMap = new Map(
        architectures
            .filter((architecture) => architecture.projectRef?.dashboardKey)
            .map((architecture) => [
                architecture.projectRef.dashboardKey,
                architecture,
            ])
    );

    return projects.map((project) => {
        const dashboardKey = getDashboardKey(project);
        const dashboard = dashboardMap.get(dashboardKey);
        const architecture = architectureMap.get(dashboardKey);

        return {
            ...project,
            dashboardKey,
            dashboard: normalizeDashboard(dashboard),
            architecture: normalizeArchitecture(architecture),
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