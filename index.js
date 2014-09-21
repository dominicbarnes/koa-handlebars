// dependencies
var Renderer = require("./lib/renderer.js");

// single export
exports = module.exports = function (options) {
  return Renderer(options).middleware();
};

// export the class
exports.Renderer = Renderer;
