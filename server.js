// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
// import http from "http";
import https from "https";
import { WebSocketServer } from 'ws';
import { MongoClient } from "mongodb";

const app = express()
app.use(cors())
app.use(express.static(`/`))

const options = {
    key: fs.readFileSync(`./localhost-key.pem`),
    cert: fs.readFileSync(`./localhost-cert.pem`),
}

const httpsServer = https.createServer(options, app)
const wss = new WebSocketServer({ server: httpsServer });
const uri = `mongodb://localhost:27017`
const dbName = `careerTimeline`
let db

MongoClient.connect(uri)
    .then((client) => {
        console.log(`✅ Connected to MongoDB`)
        db = client.db(dbName)

        httpsServer.listen(443, () => {
            console.log(`🚀 Secure Server running at https://localhost:443`)
        })

        wss.on('connection', function connection(ws) {
            console.log('✅ New client connected');

            ws.on('message', async function message(data) {
                const msg = JSON.parse(data.toString());
                console.log('📨 Received:', msg);

                if (msg.type === 'projects') {
                    const { year } = msg;

                    let query = {};
                    if (year) {
                        query.year = parseInt(year);  // year 可以是字符串
                    }

                    const projects = await db.collection('projects')
                        .find(query)
                        .project({ _id: 0, name: 1, URLs: 1 })
                        .toArray();

                    ws.send(JSON.stringify({
                        type: 'projects',
                        year: year || 'all',
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