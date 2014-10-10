var Base = require("../../index.js").Renderer;
var Case = require("case");
var inherits = require("util").inherits;
var path = require("path");

module.exports = Handlebars;

function Handlebars(options) {
  if (!(this instanceof Handlebars)) {
    return new Handlebars(options);
  }

  Base.call(this, options);
}

inherits(Handlebars, Base);

Handlebars.prototype.viewPath = function (id) {
  var o = this.options;
  return path.resolve(o.root, o.viewsPath, id, "template" + o.extension);
};

Handlebars.prototype.layoutPath = function (id) {
  var o = this.options;
  return path.resolve(o.root, o.layoutsPath, id, "template" + o.extension);
};

Handlebars.prototype.partialPath = function (name) {
  var o = this.options;
  return name
    ? path.resolve(o.root, o.partialsPath, this.partialId(name), "template" + o.extension)
    : path.resolve(o.root, o.partialsPath);
};

Handlebars.prototype.partialId = function (file) {
  var id = file.split(path.sep).slice(0, -1).join("-");
  return Case.camel(id);
};
