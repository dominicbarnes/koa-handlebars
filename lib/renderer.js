// dependencies
var Cache = require("lru-cache");
var co = require("co");
var colors = require("colors");
var debug = require("debug")("koa-handlebars");
var defaults = require("defaults");
var fs = require("co-fs");
var glob = require("co-glob");
var handlebars = require("handlebars");
var path = require("path");
var watch = require("watch");

// single export
module.exports = Renderer;

/**
 * A Renderer renderer class
 *
 * @constructor
 * @param {Object} options
 */
function Renderer(options) {
  if (!(this instanceof Renderer)) {
    return new Renderer(options);
  }

  debug("creating koa-handlebars instance", options);
  this.options = defaults(options, Renderer.defaults);
  debug("using %s as the root", this.options.root.grey);

  if (options.handlebars) {
    debug("using a custom handlebars instance");
    this.handlebars = options.handlebars;
  } else {
    this.handlebars = handlebars.create();
  }

  if (options.helpers) {
    debug("adding custom helpers during init", Object.keys(options.helpers));
    this.helper(options.helpers);
  }

  if (options.cache) {
    debug("caching enabled");
    // TODO optimize this cache, or enable external config
    this.cache = new Cache({ max: 100 });
  }

  this.partialsLoaded = false;
}

Renderer.defaults = {
  root: process.cwd(),
  viewsPath: "views",
  partialsPath: "partials",
  layoutsPath: "layouts",
  extension: ".hbs",
  defaultLayout: null,
  helpers: null,
  cache: true
};

Renderer.prototype.getFile = function *(file) {
  debug("reading file %s", path.relative(this.options.root, file).grey);
  return yield fs.readFile(file, "utf8");
};

Renderer.prototype.getTemplate = function *(file) {
  var o = this.options;
  var key = path.relative(o.root, file);
  var template;

  if (o.cache) {
    template = this.cache.get(key);

    if (template) {
      debug("template %s found in cache", key.grey);
    } else {
      template = yield this.compileTemplate(file);
      debug("saving template %s to cache", key.grey);
      this.cache.set(key, template);
    }

    return template;
  } else {
    return yield this.compileTemplate(file);
  }
};

Renderer.prototype.compileTemplate = function *(file) {
  var contents = yield this.getFile(file);
  debug("compiling template %s", path.relative(this.options.root, file).grey);
  return this.handlebars.compile(contents);
}

Renderer.prototype.viewPath = function (id) {
  var o = this.options;
  return path.resolve(o.root, o.viewsPath, id + o.extension);
};

Renderer.prototype.getView = function *(id) {
  return yield this.getTemplate(this.viewPath(id));
};

Renderer.prototype.layoutPath = function (id) {
  var o = this.options;
  return path.resolve(o.root, o.layoutsPath, id + o.extension);
};

Renderer.prototype.getLayout = function *(id) {
  if (!id) return false;
  return yield this.getTemplate(this.layoutPath(id));
};

Renderer.prototype.partial = function (name, fn) {
  debug("registering partial %s", name.underline);
  this.handlebars.registerPartial(name, fn);
};

Renderer.prototype.partialPath = function (id) {
  var o = this.options;
  if (id) return path.resolve(o.root, o.partialsPath, id + o.extension);
  return path.resolve(o.root, o.partialsPath);
};

Renderer.prototype.partialId = function (file) {
  var o = this.options;
  return path.join(path.dirname(file), path.basename(file, o.extension));
};

Renderer.prototype.getPartial = function *(file) {
  var template = yield this.getFile(this.partialPath(this.partialId(file)));
  this.partial(this.partialId(file), template);
};

Renderer.prototype.getPartials = function *() {
  debug("searching for partials in %s", this.options.partialsPath.grey);

  var files = yield glob("**/*" + this.options.extension, {
    cwd: this.partialPath()
  });

  debug("%s partials found", files.length.toString().green);

  return yield files.map(this.getPartial.bind(this));
};

Renderer.prototype.removePartial = function (file) {
  var id = this.partialId(file);
  debug("unregistering partial %s", id.underline);
  this.handlebars.unregisterPartial(id);
};

Renderer.prototype.watchPartials = function () {
  var self = this;

  debug("monitoring %s for partials", this.options.partialsPath.grey);
  watch.createMonitor(this.partialPath(), function (monitor) {
    self.partialsMonitor = monitor;

    monitor.on("created", function (f, stat) {
      var file = path.relative(self.partialPath(), f);
      debug("new partial %s detected", file.underline);
      co(self.getPartial.bind(self, file));
    });

    monitor.on("removed", function (f, stat) {
      var file = path.relative(self.partialPath(), f);
      debug("partial %s deleted", file.underline);
      self.removePartial(file);
    });

    monitor.on("changed", function (f, stat) {
      var file = path.relative(self.partialPath(), f);
      debug("partial %s modified", file.underline);
      co(self.getPartial.bind(self, file));
    });
  });
};

Renderer.prototype.unwatchPartials = function () {
  debug("stopping partials monitor");
  this.partialsMonitor.stop();
};

Renderer.prototype.helper = function (name, fn) {
  debug("registering helper %s", name.underline);
  this.handlebars.registerHelper(name, fn);
};

Renderer.prototype.render = function *(template, locals) {
  debug("rendering %s template with", template.underline, locals);
  var o = this.options;
  var layoutId = locals.layout || o.defaultLayout;

  var view = yield this.getView(template);
  var layout = yield this.getLayout(layoutId);

  if (!this.partialsLoaded) {
    debug("loading partials on first render call")
    var partials = yield this.getPartials();
    this.partialsLoaded = true;
    if (!o.cache) this.watchPartials(); // monitor for future changes
  }

  if (layout) {
    debug("rendering with layout %s", layoutId.underline);
    locals.body = view(locals);
    return layout(locals);
  } else {
    return view(locals);
  }
};

Renderer.prototype.middleware = function () {
  var self = this;

  return function *(next) {
    // renders the template and returns the string
    // this allows you to do further processing on the response (like using
    // another type besides HTML)
    this.renderView = self.render.bind(self);

    // renders the template and automatically responds
    this.render = function *(view, locals) {
      this.type = "html";
      this.body = yield this.renderView(view, locals);
    };

    yield next;
  }
};
