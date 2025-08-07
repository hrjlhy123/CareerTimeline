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

wss.on('connection', function connection(ws) {
    console.log('✅ New client connected');

    ws.on('message', function message(data) {
        console.log('📨 Received:', data.toString());

        // 回传消息
        ws.send(`Server received: ${data}`);
    });

    ws.on('close', () => {
        console.log('❌ Client disconnected');
    });
});


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

                if (msg.type === 'users') {
                    const users = await db.collection('users').find().toArray();
                    ws.send(JSON.stringify({
                        type: 'users',
                        data: users
                    }));
                }
            });

            ws.on('close', () => {
                console.log('❌ Client disconnected');
            });
        });
    })
    .catch(err => console.error(`❌ MongoDB connection failed ${err}`))