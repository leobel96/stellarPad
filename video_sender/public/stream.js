async function startCapture() {
  let captureStream = null
  try {
    if (navigator.mediaDevices.getDisplayMedia){
      captureStream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false})
    } else {
      captureStream = await navigator.getDisplayMedia({video: true, audio: false})
    }
  } catch(e) {
    console.error("Error in getting display", e)
    const alert = document.querySelector("#alert")
    alert.children[0].innerText = "Cannot get your display. Refresh the page and try again."
    alert.style.display = "block"
  }
  return captureStream
}

async function main(webrtc) {
  
  document.querySelector("#start").style.display = "none"

  // Socket io configuration
  var socket = io()

  if (webrtc){
    // Get display media
    var stream = await startCapture()
    var peerConnection = null
  }

  socket.on("connect", async () => {

    socket.emit("serverConnected")

    socket.on("message", async (message) => {
      switch (message) {
        case "clientConnected":
          console.log("Client started")
          const aspectRatio = window.screen.width/window.screen.height
          if (webrtc){
            peerConnection = new RTCPeerConnection()
            for (const track of stream.getTracks()) {
              peerConnection.addTrack(track, stream)
              // aspectRatio = track.getSettings().aspectRatio
              // console.log("aspectRatio", aspectRatio)
            }
            peerConnection.addEventListener("connectionstatechange", () => {
              console.log("Connection state:", peerConnection.connectionState)
            })
            await peerConnection.createOffer()
              .then(async (offer) => {
                peerConnection.setLocalDescription(offer)
                console.log("Offer sent", offer)
                socket.emit("RTCPOffer", {offer:offer, aspectRatio:aspectRatio})
              })
              .catch(error => console.log("createOffer error:", error))
            peerConnection.addEventListener("icecandidate", async event => {
              if (event.candidate) {
                const iceCandidate = event.candidate
                console.log("iceCandidate found:", iceCandidate)
                socket.emit("newIceCandidate", iceCandidate)
              }
            })
          } else {
            socket.emit("RTCPOffer", {offer:null, aspectRatio:aspectRatio})
          }
          break;
        case "clientDisconnected":
          if (webrtc){
            peerConnection.close()
          }
          break;
        default:
          console.log("Unknown message received")
          break;
      }
    })

    socket.on("RTCPAnswer", async function(answer){
      console.log("Answer received", answer)
      peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
          console.log("Remote description set")
        })
        .catch((e) => {
          console.log("Remote description error:", e)
        })
    })

    socket.on("newIceCandidate", async iceCandidate => {
      peerConnection.addIceCandidate(iceCandidate)
        .then(() => {
          console.log("iceCandidate received:", iceCandidate)
        })
        .catch ((e) => {
          console.error("Error adding received ice candidate", e)
        })
    })

  })

}
