var peerConnection = null,
  dataChannel = null,
  socket = null,
  screenHeight,
  screenWidth,
  screenInnerHeight,
  screenInnerWidth,
  areaLeft = 0,
  areaTop = 0,
  normalizeX,
  normalizeY,
  newPoint,
  onlyPen = false;

const alert = document.getElementById("alert");
const drawingArea = document.getElementById("drawingArea");
const installWarning = document.getElementById("install");
const remoteVideo = document.getElementById("remoteVideo");
const startButton = document.getElementById("startButton");
const tokenInput = document.getElementById("tokenInput");

startButton.shouldEnable = false;

// Check if device is running iOS

const isIOS =
  /iPad|iPhone|iPod/.test(navigator.platform) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Show an informative message

function showMessage(message) {
  installWarning.style.display = "block";
  installWarning.children[0].innerText = message;
}

// Show an error message. It also reinitializes everything

function showError(error) {
  remoteVideo.style.display = "none";
  alert.style.display = "block";
  alert.children[0].innerText = error;
  restart();
}

// webRTC data channel events handler

function onDataChannelCb(event) {
  dataChannel = event.channel;
  dataChannel.binaryType = "arraybuffer";
  dataChannel.onopen = function() {
    console.log("dataChannel opened");
  };
  dataChannel.onclose = function() {
    console.log("dataChannel closed");
    const error = "Connection lost. Tap to retry.";
    showError(error);
  };
}

// webRTC peer connection events handler

function onConnectionStateChangeCb() {
  console.log("Connection state:", peerConnection.connectionState);
  switch (peerConnection.connectionState) {
    case "disconnected":
    case "failed":
      const error = "Connection lost. Tap to retry.";
      showError(error);
      break;
    case "connected":
      document.getElementById("start").style.display = "none";
      alert.style.display = "none";
      socket.close();
      socket = null;
      break;
    default:
      break;
  }
}

/*
 * iOS needs a slightly different method to check if a stylus has
 * been used: touch.force is not enough to distinguish between
 * finger and stylus
 */

if (isIOS) {
  newPoint = async function(event) {
    const touch = event.changedTouches[0];
    if (!onlyPen || touch.touchType === "stylus") {
      const X = (touch.clientX - areaLeft) * normalizeX;
      const Y = (touch.clientY - areaTop) * normalizeY;
      dataChannel.send(Uint16Array.from([Math.floor(X), Math.floor(Y)]));
    }
  };
} else {
  newPoint = async function(event) {
    const touch = event.changedTouches[0];
    if (!onlyPen || touch.force !== 1.0) {
      const X = (touch.clientX - areaLeft) * normalizeX;
      const Y = (touch.clientY - areaTop) * normalizeY;
      dataChannel.send(Uint16Array.from([Math.floor(X), Math.floor(Y)]));
    }
  };
}

// Restart everything if error occurred

async function restart() {
  if (peerConnection !== null) {
    peerConnection.close();
  }
  if (dataChannel !== null) {
    dataChannel.close();
  }
  if (socket !== null) {
    socket.close();
  }

  document.getElementById("start").style.display = "block";

  if (startButton.shouldEnable === true) {
    function onclick() {
      tokenInput.removeEventListener("keyup", onkeyup);
      startButton.removeEventListener("click", onclick);
      const sessionToken = tokenInput.value;
      console.log("started", sessionToken);
      start(sessionToken);
    }

    startButton.addEventListener("click", onclick);

    function onkeyup(event) {
      tokenInput.value = tokenInput.value.toUpperCase();
      if (event.key === "Enter") {
        onclick();
      }
    }

    tokenInput.addEventListener("keyup", onkeyup);
    startButton.shouldEnable = false;
  }
}

// PHASE 4: start websocket and webRTC

async function start(sessionToken) {
  console.log("started");
  peerConnection = dataChannel = null;

  // Init Websocket
  socket = io({
    transports: ["websocket"],
    reconnectionAttempts: 2
  });

  socket.on("connect", () => {
    socket.emit("videoReceiverConnected", {
      id: sessionToken
    });

    socket.on("RTCPOffer", async offer => {
      console.log("RTCPOffer received");
      const aspectRatio = offer.aspectRatio;
      let areaWidth = screenInnerWidth;
      let areaHeight = screenInnerHeight;

      // Adapt drawing area size and position to the remote video one
      if (aspectRatio < screenWidth / screenHeight) {
        // Bands on left and right
        console.log(
          screenWidth,
          screenInnerWidth,
          screenHeight,
          screenInnerHeight
        );
        areaWidth = screenHeight * aspectRatio;
        areaLeft = (screenInnerWidth - areaWidth) / 2;
        drawingArea.style.width = `${areaWidth}px`;
        drawingArea.style.left = `${areaLeft}px`;
      } else {
        // Bands on top and bottom
        areaHeight = screenWidth / aspectRatio;
        areaTop = (screenInnerHeight - areaHeight) / 2;
        drawingArea.style.height = `${areaHeight}px`;
        drawingArea.style.top = `${areaTop}px`;
      }
      normalizeX = 65535 / areaWidth;
      normalizeY = 65535 / areaHeight;

      peerConnection = new RTCPeerConnection();
      peerConnection.ondatachannel = onDataChannelCb;
      peerConnection.ontrack = event => {
        remoteVideo.style.display = "block";
        remoteVideo.srcObject = event.streams[0];
      };
      peerConnection.onconnectionstatechange = onConnectionStateChangeCb;
      peerConnection.onicecandidate = async event => {
        if (event.candidate) {
          const iceCandidate = event.candidate;
          // console.log("iceCandidate sent:", iceCandidate);
          socket.emit("newIceCandidate", iceCandidate);
        }
      };
      await peerConnection
        .setRemoteDescription(new RTCSessionDescription(offer.offer))
        .then(() => {
          peerConnection
            .createAnswer()
            .then(answer => {
              peerConnection
                .setLocalDescription(answer)
                .then(() => {
                  console.log("RTCPAnswer sent");
                  socket.emit("RTCPAnswer", answer);
                })
                .catch(error =>
                  console.error("setLocalDescription error:", error)
                );
            })
            .catch(error => console.error("createAnswer error:", error));
        })
        .catch(error => console.error("setRemoteDescription error:", error));
    });

    socket.on("newIceCandidate", async iceCandidate => {
      peerConnection
        .addIceCandidate(iceCandidate)
        .catch(error =>
          console.error("Error adding received ice candidate", error)
        );
    });

    socket.on("message", message => {
      switch (message) {
        case "wrongToken":
          const error = "It seems like you mistook the token. Try again.";
          showError(error);
          break;
        default:
          break;
      }
    });
  });

  socket.on("connect_error", e => {
    console.error("Error on connection:", e);
  });

  socket.on("reconnect_failed", e => {
    const error = "Connection failed. Please check your connection.";
    showError(error);
    console.error("Reconnect failed:", e);
  });

  drawingArea.addEventListener("touchstart", newPoint, {
    passive: true
  });

  drawingArea.addEventListener("touchmove", newPoint, {
    passive: true
  });

  drawingArea.addEventListener(
    "touchend",
    () => {
      dataChannel.send("UP");
    },
    {
      passive: true
    }
  );
}

// PHASE 3: App Init

async function installed() {
  onlyPen = false;
  remoteVideo.style.display = "none";
  const menu = document.getElementById("menu");

  // Getting real screen dimensions before keyboard opens
  screenWidth = window.screen.availWidth;
  screenHeight = window.screen.availHeight;
  screenInnerHeight = window.innerHeight;
  screenInnerWidth = window.innerWidth;

  installWarning.style.display = "none";
  document.getElementById("afterInstall").style.display = "block";
  document.getElementById("start").style.display = "block";

  document.body.addEventListener(
    "touchstart",
    event => {
      if (event.touches.length >= 2) {
        // event.stopPropagation();
        if (menu.style.display === "none") {
          drawingArea.style.display = "none";
          menu.style.display = "block";
        } else {
          drawingArea.style.display = "block";
          menu.style.display = "none";
        }
      }
    },
    {
      passive: true
    }
  );

  function onclick() {
    tokenInput.removeEventListener("keyup", onkeyup);
    startButton.removeEventListener("click", onclick);
    startButton.shouldEnable = true;
    const sessionToken = tokenInput.value;
    console.log("started", sessionToken);
    start(sessionToken);
  }

  startButton.addEventListener("click", onclick);

  function onkeyup(event) {
    tokenInput.value = tokenInput.value.toUpperCase();
    if (event.key === "Enter") {
      onclick();
    }
  }

  tokenInput.addEventListener("keyup", onkeyup);

  menu
    .querySelector("input[type=button]")
    .addEventListener("click", async () => {
      onlyPen = menu.children[1].checked;
      drawingArea.style.display = "block";
      menu.style.display = "none";
    });
}

// PHASE 2: Check if PWA has been installed

const DEBUG = false;

function checkInstall() {
  let deferredPrompt;

  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    DEBUG === true
  ) {
    installed();
  } else {
    if (isIOS) {
      installWarning.style.display = "block";
    } else {
      window.addEventListener("beforeinstallprompt", async e => {
        console.log("beforeinstall");
        const message =
          "You have to install the app in order to use it. Touch the screen and accept the prompt.";
        showMessage(message);
        e.preventDefault();
        deferredPrompt = e;

        installWarning.addEventListener("click", () => {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(choiceResult => {
            if (choiceResult.outcome === "accepted") {
              console.log("User accepted the prompt");
              if (
                window.matchMedia("(display-mode: standalone)").matches ||
                window.matchMedia("(display-mode: fullscreen)").matches ||
                window.navigator.standalone === true
              ) {
                installed();
              } else {
                const message =
                  "Now close the browser and open the installed app";
                showMessage(message);
              }
            } else {
              console.log("User dismissed the prompt");
            }
            deferredPrompt = null;
          });
        });
      });
    }
  }
}

// PHASE 1: install service worker

let newWorker;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then(reg => {
      console.log(
        "ServiceWorker registration successful with scope:",
        reg.scope
      );
      reg.addEventListener("updatefound", () => {
        // A wild service worker has appeared in reg.installing!
        newWorker = reg.installing;

        newWorker.addEventListener("statechange", () => {
          // Has network.state changed?
          switch (newWorker.state) {
            case "installed":
              if (navigator.serviceWorker.controller) {
                // new update available
                console.log("Ready for update");
                newWorker.postMessage({ action: "skipWaiting" });
              }
              break;
          }
        });
      });
    })
    .then(() => {
      checkInstall();
    })
    .catch(err => console.error("ServiceWorker registration failed:", err));
}

let refreshing;
navigator.serviceWorker.addEventListener("controllerchange", () => {
  if (refreshing) return;
  window.location.reload();
  refreshing = true;
});
