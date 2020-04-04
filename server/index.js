'use strict';
const express = require('express');
const serverless = require('serverless-http');
const app = express();
const path = require("path");

app.use(express.static(path.join(__dirname, 'video_receiver')));

// app.use('/', (req, res) => res.sendFile(path.join(__dirname, 'video_receiver/index.html')));


module.exports = app;
module.exports.handler = serverless(app);

// const io = require('socket.io')(server);

// require('./socketio.js')(io);

// server.listen(4000, () => console.log('Listening on localhost:4000'));
