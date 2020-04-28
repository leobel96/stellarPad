"use strict";

var ffi = require("ffi-napi");
var StructType = require("ref-struct-napi");

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
    entry.dx = (point[0]*65535)
    entry.dy = (point[1]*65535)
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
      spawn(`xdotool mousemove ${point[0]*screenWidth} ${point[1]*screenHeight} mousedown 1`)
      firstPoint = false
    } else {
      spawn(`xdotool mousedown 1 mousemove ${point[0]*screenWidth} ${point[1]*screenHeight}`)
    }
  }

} else {
  console.error("OS not supported")
}

// Start server

const express = require("express");
const app = express();
const path = require("path");
    
app.use(express.static(path.join(__dirname, "public")));

app.listen(4000, "0.0.0.0", () => console.log("Listening on port 4000"));
