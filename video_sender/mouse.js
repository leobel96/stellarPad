"use strict";

const ffi = require("ffi-napi");

if (process.platform === "win32"){

  const StructType = require("ref-struct-napi");

  const MOUSEEVENTF_LEFTDOWN = 2;
  const MOUSEEVENTF_LEFTUP = 4;
  const MOUSEEVENTF_MOVE = 1;
  const MOUSEEVENTF_ABSOLUTE = 0x8000;

  const Input = StructType({
      "type": "int",
      "???": "int",
      "dx": "long",
      "dy": "long",
      "mouseData": "int",
      "dwFlags": "int",
      "time": "int",
      "dwExtraInfo": "int64"
  });

  const user32 = ffi.Library("user32", {
      SendInput: ["int", ["int", Input, "int"]],
  });

  exports.unclickMouse = () => {
    const entry = new Input();
    entry.dwFlags = MOUSEEVENTF_LEFTUP;
    user32.SendInput(1, entry, 40);
  };

  exports.dragMouse = (point) => {
    const entry = new Input();
    entry.dx = point[0];
    entry.dy = point[1];
    entry.mouseData = 0;
    entry.dwFlags = MOUSEEVENTF_LEFTDOWN;
    entry.dwFlags |= MOUSEEVENTF_MOVE;
    entry.dwFlags |= MOUSEEVENTF_ABSOLUTE;
    user32.SendInput(1, entry, 40);
  };

} else if (process.platform === "linux") {

  const ref = require("ref-napi");
  const Struct = require('ref-struct-napi');
  
  let firstPoint = false;
  const screenWidth = window.screen.availWidth / 65535;
  const screenHeight = window.screen.availHeight / 65535;

  const CURRENTWINDOW = (0);

  const struct_charcodemap_t = Struct({
    'key'           : 'char', // wchar_t
    'code'          : 'char', // KeyCode
    'symbol'        : 'char', // KeySym
    'group'         : 'int',
    'modmask'       : 'int',
    'needs_binding' : 'int',
  });
  
  const p_struct_charcodemap_t = ref.refType(struct_charcodemap_t);

  const struct_xdo_t = Struct({
  
    /** The Display for Xlib */
    'xdpy'                     : ref.refType('int'), // Display*
  
    /** The display name, if any. NULL if not specified. */
    'display_name'             : 'char *',
    
    /** @internal Array of known keys/characters */
    'charcodes'                : p_struct_charcodemap_t,
  
    /** @internal Length of charcodes array */
    'charcodes_len'            : 'int',
  
    /** @internal highest keycode value */
    'keycode_high'             : 'int',
  
    /** @internal lowest keycode value */
    'keycode_low'              : 'int',
  
    /** @internal number of keysyms per keycode */
    'keysyms_per_keycode'      : 'int',
  
    /** Should we close the display when calling xdo_free? */
    'close_display_when_freed' : 'int',
  
    /** Be extra quiet? (omits some error/message output) */
    'quiet'                    : 'int',
  
    /** Enable debug output? */
    'debug'                    : 'int',
  
    /** Feature flags, such as XDO_FEATURE_XTEST, etc... */
    'features_mask'            : 'int',
  });
  
  const p_struct_xdo_t = ref.refType(struct_xdo_t);
  const isDev = process.env.APP_DEV ? (process.env.APP_DEV.trim() == "true") : false;
  const libPath = isDev ? "./libxdo.so.3" : (process.resourcesPath + "/libxdo.so.3");

  const libxdo = ffi.Library(libPath, {
    'xdo_new' : [ p_struct_xdo_t, [ 
      'string',  // const char *display
    ]],
    'xdo_move_mouse' : [ 'int', [ 
      p_struct_xdo_t,  // const xdo_t *xdo
      'int',           // int x
      'int',           // int y
      'int',           // int screen
    ]],
    'xdo_mouse_down' : [ 'int', [ 
      p_struct_xdo_t,  // const xdo_t *xdo
      'int',           // Window window
      'int',           // int button
    ]],
    'xdo_mouse_up' : [ 'int', [ 
      p_struct_xdo_t,  // const xdo_t *xdo
      'int',           // Window window
      'int',           // int button
    ]]
  });

  const xdo = libxdo.xdo_new(null);

  if (xdo.isNull()) { 
    console.log("Oh no! Couldn't create object!"); 
    return -1; 
  }

  exports.unclickMouse = () => {
    libxdo.xdo_mouse_up(xdo, CURRENTWINDOW, 1);
    firstPoint = true;
  }

  exports.dragMouse = (point) => {
    if (firstPoint){
      libxdo.xdo_move_mouse(xdo, point[0]*screenWidth, point[1]*screenHeight, CURRENTWINDOW);
      libxdo.xdo_mouse_down(xdo, CURRENTWINDOW, 1);
      firstPoint = false;
    } else {
      libxdo.xdo_mouse_down(xdo, CURRENTWINDOW, 1);
      libxdo.xdo_move_mouse(xdo, point[0]*screenWidth, point[1]*screenHeight, CURRENTWINDOW);
    }
  }

} else {
  console.error("OS not supported");
}
