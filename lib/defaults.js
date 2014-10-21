// dependencies
var camel = require("to-camel-case");
var path = require("path");


// root directory to search for templates
exports.root = process.cwd();

// whether or not to cache templates
exports.cache = true;

// handlebars options.data
exports.data = {};

// what extension to use for templates
exports.extension = ".hbs";

// what dir contains views
exports.viewsDir = "views";

// turn a view id into a absolute path
exports.viewPath = function (id) {
  var o = this.options;
  return path.resolve(o.root, o.viewsDir, id + o.extension);
};

// what layout (if any) should be used by default
exports.defaultLayout = null;

// what dir contains layouts
exports.layoutsDir = "layouts";

// turn a layout id into an absolute path
exports.layoutPath = function (id) {
  var o = this.options;
  return path.resolve(o.root, o.layoutsDir, id + o.extension);
};

// what dir contains partials
exports.partialsDir = "partials";

// turn a partial relative path into an id
exports.partialId = function (file) {
  var dir = path.dirname(file);
  var base = path.basename(file, this.options.extension)
  return camel(path.join(dir, base));
};

// predefined global helpers
exports.helpers = null;

// predefined global partials
exports.partials = null;

// allow last-second modifications before render
exports.beforeRender = null;
