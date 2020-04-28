"use strict";

const express = require("express");
const app = express();
const httpLib = require("http");
const server = httpLib.Server(app);
const path = require("path");

server.listen(3000, () => console.log("Listening on port 3000"));

app.enable("trust proxy");

app.get("/", (req, res, next) => {
  if (!req.secure){
    res.redirect(301, `https://${process.env.PROJECT_DOMAIN}.glitch.me/`);
    return
  }
  next();
})

app.use(express.static(path.join(__dirname, "video_receiver")));


// Keep Glitch alive
setInterval(() => {
  httpLib.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
}, 280000);

const io = require("socket.io")(server);

let clients = []; // [[sessionToken, videoSenderId, videoReceiverId], ...]

io.sockets.on("connection", async socket => {
  socket.on("videoSenderConnected", message => {
    const sessionToken = message.id;
    const session = clients.find(session => session[0] === sessionToken);
    if (session !== undefined) {
      // Session already present
      if (session[1] !== null) {
        // videoSender already connected
        return;
      }
      session[1] = socket.id;
      if (session[2] !== null) {
        // videoReceiver already connected
        console.log("sent videoReceiverConnected");
        socket.send("videoReceiverConnected");
      }
    } else {
      console.log("New session created");
      clients.push([sessionToken, socket.id, null]);
    }
    console.log(new Date(), "videoSender connected with token", sessionToken);
  });

  socket.on("videoReceiverConnected", message => {
    const sessionToken = message.id;
    const session = clients.find(session => session[0] === sessionToken);
    if (session === undefined || session[2] !== null || session[1] === null) {
      // videoReceiver already connected or videoSender not connected
      console.log("wrong", session, session[2], session[1]);
      socket.send("wrongToken");
      return;
    }

    // videoSender already connected
    session[2] = socket.id;
    console.log("sent videoReceiverConnected");
    io.to(session[1]).send("videoReceiverConnected");
    console.log(new Date(), "videoReceiver connected with token", sessionToken);
  });

  socket.on("RTCPOffer", offer => {
    console.log("RTCPOffer");
    const session = clients.find(session => session[1] === socket.id);
    if (session === undefined) {
      console.log("RTCPOffer error: videoSender not present in sessions");
      return;
    }
    io.to(session[2]).emit("RTCPOffer", offer);
  });

  socket.on("newIceCandidate", iceCandidate => {
    const session = clients.find(
      session => session[1] === socket.id || session[2] === socket.id
    );
    if (session === undefined) {
      console.log("newIceCandidate error: client not present in sessions");
      return;
    }
    io.to(session[1] === socket.id ? session[2] : session[1]).emit(
      "newIceCandidate",
      iceCandidate
    );
  });

  socket.on("RTCPAnswer", answer => {
    console.log("RTCPAnswer");
    const session = clients.find(session => session[2] === socket.id);
    if (session === undefined) {
      console.log("RTCPAnswer error: videoReceiver not present in sessions");
      return;
    }
    io.to(session[1]).emit("RTCPAnswer", answer);
  });

  socket.on("disconnect", reason => {
    const session = clients.find(
      session => session[1] === socket.id || session[2] === socket.id
    );
    if (session !== undefined) {
      if (session[1] === socket.id) {
        session[1] = null;
        io.to(session[2]).send("videoSenderDisconnected");
        console.log("videoSender disconnected:", reason);
      }
      if (session[2] === socket.id) {
        session[2] = null;
        io.to(session[1]).send("videoReceiverDisconnected");
        console.log("videoReceiver disconnected:", reason);
      }
      if (session[1] === null && session[2] === null) {
        clients = clients.filter(sess => sess === session);
        console.log("Session", session[0], "removed");
      }
    }
  });
});
