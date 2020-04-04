module.exports = function startServer(io){
    io.sockets.on("connection", async (socket) => {
  
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
  
    })
  }