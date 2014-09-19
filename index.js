// dependencies
var Renderer = require("./lib/renderer.js");

// single export
exports = module.exports = function (options) {
  var r = new Renderer(options);
  return r.middleware();
};

exports.Renderer = Renderer;
