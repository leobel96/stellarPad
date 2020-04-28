<img src="./images/logo.svg">

# Why?
I have an Ipad Pro and I really felt the necessity to use it as graphic tablet for my PC with my favourite softwares. At the moment only macOS natively supports this function and the third-party alternative are pretty expensive and closed-source. So I asked myself: why not developing a simple, open and cross-platform alternative? Why not take advantage of all the modern web technologies (see chapter ["A little bit of technical information"](#a-little-bit-of-technical-information))?

# Structure
Stellar Pad consists of 3 main parts:
- Server: a simple server application currently hosted on [glitch.com](https://stellarpad.glitch.me). Its purpouse is to serve `videoReceiver` and handle initial handshake
- videoSender: an electron application intended to be installed on the device (i.e. PC) that will send the video stream and will be controlled by the `videoReceiver`. Only Windows and Linux supported at the moment
- videoReceiver: a PWA (Progressive Web Application) intended to be installed on the device that will receive the video stream and will control the `videoSender`

# Usage
## videoSender
`videoSender` can be found in the realeases: download it according to your OS. A portable x64 version for Windows and portable AppImage version for Linux are present; simply run them.

## videoReceiver
The `videoReceiver` is a [PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) and can be reached visiting https://stellarpad.glitch.me. Once correctly opened the website, you will be asked to install the PWA; simply follow the passages and a Stellar Pad icon will be added to your homescreen (like a classic application).
⚠IMPORTANT⚠: [some internet providers block Glitch](https://support.glitch.com/t/i-cant-see-any-glitch-me-project/13992/2) (why?). If you encounter any problem with https://stellarpad.glitch.me (website unreachable or blank page), it is possible you have to [change your DNS](https://developers.google.com/speed/public-dns/docs/using) <b> on both `videoSender` device and `videoReceiver` device </b>.

## Supported devices
`videoReceiver` has been tested on an Ipad Pro 2nd generation and on an Android 10 smartphone but should work on all recent iOS and Android devices while `videoSender` has been tested on a Windows 10 laptop and an Ubuntu laptop but should work on all recent Windows and Linux devices.

# A little bit of technical information
The communication between `videoReceiver` and `videoSender` uses a <b>local</b> WebRTC for both video and data (finger/stylus movements). In order to initialize the WebRTC, [many passages are required](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Simple_RTCDataChannel_sample). Due to the fact that both PWA and WebRTC require a secure HTTPS connection, an external secure server had to be implemented in order to guarantee a secure handshake (obtain HTTPS certificates for local domains is a mess). The connection between `videoReceiver`, `videoSender` and `server` is established using [Socket.io](https://socket.io/): a pretty fast and easy to handle real-time engine. After the handshake both `videoReceiver` and `videoSender` disconnect from `server` and all the packets remain within local network. 
When a stylus or finger moves on the `videoReceiver`'s screen, a movement message is sent to `videoSender` through WebRTC datachannel and, then, mouse is moved using pretty fast C functions called though Foreign Function Interface (FFI). In this way, even if video latency is not very low, mouse latency is kept very low and is nearly negligible.

# Disclaimer
Stellar Pad is an amateur project developed by me in my spare time. It is distributed as-is and I assume no responsibility for any problem/damage it could provide. Use at your own risk.