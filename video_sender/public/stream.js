
const {desktopCapturer} = require("electron")
const {unclickMouse, dragMouse} = require("../mouse.js")

var socket = null, peerConnection = null, dataChannel = null
const alert = document.querySelector("#alert")

// Generate random sessionToken
function randomString(length) {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let result = ""
  for (var i = length; i > 0; --i) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// Show error and restart
function showError(error) {
  alert.style.display = "block"
  alert.children[0].innerText = error
  if (peerConnection !== null){
    peerConnection.close()
  }
  if (dataChannel !== null){
    dataChannel.close()
  }
  if (socket !== null){
    socket.close()
  }
  main()
}

// start capturing user screen
function startCapture(peerConnection) {
  return desktopCapturer.getSources({ types: ["screen"] }).then(async() => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop"
        }
      }
    })
    peerConnection.addTrack(stream.getTracks()[0], stream)
    return stream
  })
}

async function onIceCandidateCallback(event) {
  if (event.candidate) {
    const iceCandidate = event.candidate
    // console.log("iceCandidate found:", iceCandidate)
    socket.emit("newIceCandidate", iceCandidate)
  }
}

function onReceiveChannelStateChange(event) {
  console.log("Channel state is:", event.type)
}

function onReceiveMessageCallback(event) {
  if(event.data === "UP"){
    unclickMouse()
  } else {
    const point = new Uint16Array(event.data)
    dragMouse(point)
  }
}

async function main() {

  document.querySelector("#start").style.display = "none"
  const sessionToken = randomString(5)

  // Socket io configuration
  socket = io("https://stellarpad.glitch.me",{
    // transports: ["websocket"],
    reconnectionAttempts: 2
  })

  document.querySelector("#sessionToken>div").innerText = sessionToken

  socket.on("connect", async () => {

    socket.emit("videoSenderConnected", {id:sessionToken})

    socket.on("message", async (message) => {
      switch (message) {
        case "videoReceiverConnected":
          console.log("videoReceiver started")
          peerConnection = new RTCPeerConnection()
          // Data channel
          dataChannel = peerConnection.createDataChannel("channel")
          dataChannel.binaryType = "arraybuffer"
          dataChannel.onopen = onReceiveChannelStateChange
          dataChannel.onmessage = onReceiveMessageCallback
          dataChannel.onclose = () => {
            const error = "Connection lost. Click to try again."
            showError(error)
          }
          peerConnection.onicecandidate = onIceCandidateCallback
          peerConnection.onconnectionstatechange = () => {
            console.log("Connection state:", peerConnection.connectionState)
            switch (peerConnection.connectionState) {
              case "disconnected":
              case "failed":
                const error = "Connection lost. Click to try again."
                showError(error)
                break
              case "connected":
                socket.close()
                socket = null
                console.log("Socket closed")
                break
              default:
                break
            }
          }
          startCapture(peerConnection, socket).then(() => {
            const aspectRatio = window.screen.width / window.screen.height
            peerConnection.createOffer().then(async (offer) => {
              peerConnection.setLocalDescription(offer)
              console.log("Offer sent", offer)
              socket.emit("RTCPOffer", {offer:offer, aspectRatio:aspectRatio})
            })
          }).catch((e) => {
            console.error("Error in startCapture():", e)
          })
          break
        case "videoReceiverDisconnected":
            peerConnection.close()
          break
        default:
          console.log("Unknown message received")
          break
      }
    })

    socket.on("RTCPAnswer", async (answer) => {
      // console.log("Answer received", answer)
      peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
          console.log("Remote description set")
        })
        .catch((e) => {
          console.log("Remote description error:", e)
        })
    })

    socket.on("newIceCandidate", async (iceCandidate) => {
      peerConnection.addIceCandidate(iceCandidate)
        .then(() => {
          // console.log("iceCandidate received:", iceCandidate)
        })
        .catch ((e) => {
          console.error("Error adding received ice candidate", e)
        })
    })

  })

  socket.on("reconnect_failed", (e) => {
    const error = "Connection failed. Please check your internet connection. Click to retry."
    showError(error)
    console.error("Reconnect failed:", e)
  })

  socket.on("disconnect", (e) => {
    if (peerConnection === null){
      const error = "Connection with server lost. Please check your internet connection. Click to retry."
      showError(error)
      console.error("Socket disconnected:", e)
    }
  })

}
