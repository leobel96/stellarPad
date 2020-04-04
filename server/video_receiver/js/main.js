
async function start(ip, webrtc){

  var socket = io({transports: ["websocket"], reconnectionAttempts: 2})
  var peerConnection

  const remoteVideo = document.querySelector("#remoteVideo")
  const drawingArea = document.querySelector("#drawingArea")
  let areaWidth = window.areaWidth
  let areaHeight = window.areaHeight
  let areaX = 0, areaY = 0

  socket.on("connect",  () => {

    socket.emit("clientConnected")

    socket.on("RTCPOffer", async (offer) => {
      console.log("Offer received", offer)
      const aspectRatio = offer.aspectRatio
      if (aspectRatio < (window.areaWidth / window.areaHeight)){
        areaWidth = window.areaHeight * aspectRatio
        areaX = (window.areaWidth - areaWidth) / 2
        drawingArea.style.width = `${window.areaHeight*aspectRatio}px`
        drawingArea.style.left = `${areaX}px`
      } else {
        areaHeight = window.areaWidth / aspectRatio
        areaY = (window.areaHeight - areaHeight) / 2
        drawingArea.style.height = `${window.areaWidth/aspectRatio}px`
        drawingArea.style.top = `${areaY}px`
      }
      if (webrtc){
        peerConnection = new RTCPeerConnection()
        peerConnection.ontrack = e => remoteVideo.srcObject = e.streams[0]
        peerConnection.addEventListener("connectionstatechange", event => {
          console.log("Connection state:", peerConnection.connectionState, event)
          if (peerConnection.connectionState === "connected"){
            document.querySelector("#start").style.display = "none"
            document.querySelector("#alert").style.display = "none"
          }
        })
        peerConnection.addEventListener("icecandidate", async event => {
          if (event.candidate) {
            const iceCandidate = event.candidate
            console.log("iceCandidate sent:", iceCandidate)
            socket.emit("newIceCandidate", iceCandidate)
          }
        })
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.offer))
          .then(() => {
            peerConnection.createAnswer()
              .then((answer) => {
                peerConnection.setLocalDescription(answer)
                  .then(() => {
                    console.log("Answer sent", answer)
                    socket.emit("RTCPAnswer", answer)
                  })
                  .catch((e) => {
                    console.log("setLocalDescription error:", e)
                  })
              })
              .catch(error => console.log("createAnswer error:", error))
          })
          .catch((e) => {
            console.log("setRemoteDescription error:", e)
          })
      } else {
        document.querySelector("#start").style.display = "none"
        document.querySelector("#alert").style.display = "none"
      }
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

    socket.on("message", async (message) => {
      switch (message) {
        case "serverDisconnected":
          if (webrtc){
            peerConnection.close()
          }
          break
        default:
          break
      }
    })

  })

  socket.on('connect_error', (e) => {
    console.error("Error on connection:", e)
  })

  socket.on("reconnect_failed", (e) => {
    loading = false
    const alert = document.querySelector("#alert")
    alert.style.display = "block"
    alert.children[0].innerText = "Connection failed. Please check your IP."
    console.error("Reconnect failed:", e)
  })


  // Init Canvas

  async function newPoint(event){
    const touch = event.changedTouches[0]
    if (!onlyPen || touch.force !== 1.0){
      const X = (touch.clientX - areaX) / areaWidth
      const Y = (touch.clientY - areaY) / areaHeight
      const point = {x:X, y:Y}
      socket.emit("movement", point)
    }
  }

  document.body.addEventListener("touchmove", (event) => {
    if (event.touches.length === 2){
      event.stopPropagation()
    }
  }, {passive:true})

  document.body.addEventListener("touchend", (event) => {
    if (event.touches.length === 2){
      event.stopPropagation()
    }
  }, {passive:true})

  drawingArea.addEventListener("touchstart", newPoint, {passive: true})

  drawingArea.addEventListener("touchmove", newPoint, {passive: true})

  drawingArea.addEventListener("touchend", () => {
    socket.emit("UP")
  }, {passive:true})

}


// App Init

let loading = false
const installWarning = document.querySelector("#install")
let onlyPen = false

async function installed(){

  const drawingArea = document.querySelector("#drawingArea")
  const menu = document.querySelector("#menu")
  window.areaWidth = window.screen.availWidth
  window.areaHeight = window.screen.availHeight
  installWarning.style.display = "none"
  document.querySelector("#afterInstall").style.display = "block"
  document.querySelector("#start").style.display = "block"

  document.body.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2){
      event.stopPropagation()
      if (menu.style.display === "none"){
        drawingArea.style.display = "none"
        menu.style.display = "block"
      } else {
        drawingArea.style.display = "block"
        menu.style.display = "none"
      }
    }
  }, {passive:true})

  document.querySelector("#menu>input[type=button]").addEventListener("click", () => {
    onlyPen = menu.children[1].checked
    drawingArea.style.display = "block"
    menu.style.display = "none"
  })

  document.querySelector("#start>form").addEventListener("submit", async (event)=>{
    if (!loading){
      loading = true
      event.preventDefault()
      const ip = event.target[0].value
      console.log("started")
      start(ip, false)
    }
  })

}


function checkInstall(){
  let deferredPrompt

  window.addEventListener("beforeinstallprompt", async (e) => {
    console.log("beforeinstall")
    installWarning.style.display = "block"
    e.preventDefault()
    deferredPrompt = e

    installWarning.addEventListener("click", e => {
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted the prompt")
          if (window.matchMedia("(display-mode: standalone)").matches || 
              window.matchMedia("(display-mode: fullscreen)").matches || 
              window.navigator.standalone === true) {
            installed()
          }else{
            installWarning.children[0].innerText = "Now close the browser and open the installed app"
          }
        } else {
          installWarning.children[0].innerText = `You have to install the app in order to use it. 
                                                  Reload the page and try again`
          console.log("User dismissed the prompt")
        }
        deferredPrompt = null;
      })
    })

  })
}

if (window.matchMedia("(display-mode: standalone)").matches || 
    window.matchMedia("(display-mode: fullscreen)").matches || 
    window.navigator.standalone === true) {
  installed()
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then(() => {
      checkInstall()
      console.log("ServiceWorker registration successful")
    })
    .catch((err) => {
      console.log("ServiceWorker registration failed: ", err)
    })
}
