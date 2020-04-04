"use strict"

const webrtc = false

var ffi = require("ffi")
var os = require("os")
var StructType = require("ref-struct")

const MOUSEEVENTF_LEFTDOWN = 2;
const MOUSEEVENTF_LEFTUP = 4;
const MOUSEEVENTF_MOVE = 1;
const MOUSEEVENTF_ABSOLUTE = 0x8000;

var Input = StructType({
    "type": "int",
    "???": "int",
    "dx": "long",
    "dy": "long",
    "mouseData": "int",
    "dwFlags": "int",
    "time": "int",
    "dwExtraInfo": "int64"
})

var user32 = ffi.Library("user32", {
    SendInput: ["int", ["int", Input, "int"]],
})

var unclickMouse, dragMouse

if (process.platform === "win32"){

  unclickMouse = function () {
    const entry = new Input()
    entry.dwFlags = MOUSEEVENTF_LEFTUP
    user32.SendInput(1, entry, 40)
  }

  dragMouse = function (point) {
    const entry = new Input()
    entry.dx = (point.x*65535)
    entry.dy = (point.y*65535)
    entry.mouseData = 0
    entry.dwFlags = MOUSEEVENTF_LEFTDOWN
    entry.dwFlags |= MOUSEEVENTF_MOVE
    entry.dwFlags |= MOUSEEVENTF_ABSOLUTE
    user32.SendInput(1, entry, 40)
  }

} else if (process.platform === "linux"){

  let firstPoint = false
  const { spawn } = require("child_process")

  const cmd = "xrandr | grep ' connected'"
  const resolution = spawn(cmd).split(" ")[3].split("+")[0].split("x")[0]
  const screenWidth = parseInt(resolution[0])
  const screenHeight = parseInt(resolution[1])

  unclickMouse = function () {
    spawn("xdotool mouseup 1")
    firstPoint = true
  }

  dragMouse = function (point) {
    if (firstPoint){
      spawn(`xdotool mousemove ${point.x*screenWidth} ${point.y*screenHeight} mousedown 1`)
      firstPoint = false
    } else {
      spawn(`xdotool mousedown 1 mousemove ${point.x*screenWidth} ${point.y*screenHeight}`)
    }
  }

} else {
  console.error("OS not supported")
}

// Start server

// Get local IP
function getIP() {
    const ifaces = os.networkInterfaces()
    let response = []
    Object.keys(ifaces).forEach(function (ifname) {
      var alias = 0
      ifaces[ifname].forEach(function (iface) {
        if ("IPv4" !== iface.family || iface.internal !== false) {
          // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
          return
        }
  
        if (alias >= 1) {
          // this single interface has multiple ipv4 addresses
          response.push({"ifname": ifname, "alias": alias, "address": iface.address})
        } else {
          // this interface has only one ipv4 adress
          response.push({"ifname": ifname, "alias": "", "address": iface.address})
        }
        ++alias
      })
    })
    return response
}

var fs = require('fs'),
    path = require("path"),
    ejs = require("ejs"),
    library

const options = {}

if (webrtc === true){
  library = require('https')
  options = {
    key: fs.readFileSync(path.join(__dirname, "server.key")),
    cert: fs.readFileSync(path.join(__dirname, "server.cert")),
    rejectUnauthorized: false,
    requestCert: true
  }
} else {
  library = require('http')
}


const template = fs.readFileSync("./server-public/index.ejs").toString()
const index = ejs.render(template, {IPs: getIP()})

const server = library.createServer(options, function (req, res) {
    if (req.url == "/"){
        res.writeHead(200)
        res.end(index)
    } else {
      fs.readFile(__dirname + req.url, function (err,data) {
        if (err) {
          res.writeHead(404)
          res.end(JSON.stringify(err))
          return
        }
        res.writeHead(200)
        res.end(data)
      })
    }
})

server.listen(3000, "0.0.0.0")

var count = 0
var offer, serverId, clientId
offer = serverId = clientId = null

const io = require("socket.io")(server, {transports: []})

async function init(){

  io.sockets.on("connection", async (socket) => {

    if (io.engine.clientsCount > 2) {
      socket.disconnect()
      console.log("Too many clients")
      return
    }

    socket.on("serverConnected", async () => {
      console.log(new Date(), "Server connected.")
      serverId = socket.id
      if (clientId !== null){
        socket.send("clientConnected")
      }
    })

    socket.on("clientConnected", async () => {
      console.log(new Date(), "Client connected.")
      clientId = socket.id
      if (serverId !== null){
        io.to(serverId).send("clientConnected")
      }
    })

    socket.on("RTCPOffer", (newOffer) => {
      console.log("RTCPOffer", newOffer)
      offer = newOffer
      io.to(clientId).emit("RTCPOffer", offer)
    })

    socket.on("newIceCandidate", iceCandidate => {
      io.to((socket.id == clientId) ? serverId : clientId).emit("newIceCandidate", iceCandidate)
    })

    socket.on("RTCPAnswer", function(answer){
      console.log("RTCPAnswer", answer)
      io.to(serverId).emit("RTCPAnswer", answer)
    })
    
    socket.on("UP", unclickMouse)

    socket.on("movement", dragMouse)

    socket.on("disconnect", async (reason) => {
      if (socket.id === clientId){
        console.log(new Date(), "Client disconnected.", reason)
        clientId = null
        io.to(serverId).send("clientDisconnected")
      } else {
        console.log(new Date(), "Server disconnected.", reason)
      }
      unclickMouse()
      count = 0
    })

  })

}

init().then(() => {
  console.log("Initialized")
})

