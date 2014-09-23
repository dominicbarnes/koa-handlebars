// dependencies
var Cache = require("lru-cache");
var co = require("co");
var colors = require("colors");
var debug = require("debug")("koa-handlebars");
var extend = require("extend");
var fs = require("co-fs");
var glob = require("co-glob");
var handlebars = require("handlebars");
var path = require("path");
var watch = require("watch");

// single export
module.exports = Renderer;

/**
 * A Handlebars rendering abstraction class. Made a constructor to allow
 * sub-classing and customization.
 *
 * @constructor
 * @param {Object} options
 */
function Renderer(options) {
  if (!(this instanceof Renderer)) {
    return new Renderer(options);
  }

  // create complete options object (using defaults)
  debug("creating koa-handlebars instance with options", options);
  var o = this.options = extend({}, Renderer.defaults, options);
  debug("using %s as the root", o.root.grey);

  // custom handlebars instance
  if (o.handlebars) {
    debug("using a custom handlebars instance");
    this.handlebars = o.handlebars;
  } else {
    this.handlebars = handlebars.create();
  }

  // register the hash of partials if provided
  if (o.helpers) {
    debug("adding custom helpers during init", Object.keys(o.helpers));
    this.helper(o.helpers);
  }

  // enabling caching (via lru-cache)
  if (o.cache) {
    debug("caching enabled");
    // TODO optimize this cache, or enable external config
    this.cache = new Cache({ max: 100 });
  }

  // flag used in Renderer#render() after lazy-loading partials
  this.partialsLoaded = false;
}

// reasonable defaults, exposed to allow users to change globally for their app
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

/**
 * Retrieves a file from the filesystem (and logs it)
 *
 * @param {String} file  An absolute file path to a template file
 * @returns {String}
 */
Renderer.prototype.getFile = function *(file) {
  debug("reading file %s", path.relative(this.options.root, file).grey);
  return yield fs.readFile(file, "utf8");
};

/**
 * Retrieves a file from disk and compiles it into a handlebars function
 *
 * @param {String} file  An absolute path to a template file
 * @returns {Function}
 */
Renderer.prototype.compileTemplate = function *(file) {
  var contents = yield this.getFile(file);
  debug("compiling template %s", path.relative(this.options.root, file).grey);
  return this.handlebars.compile(contents);
};

/**
 * Retrieves a compiled template. Also gets/sets from the cache if enabled.
 *
 * @param {String} file  An absolute path to a template file
 * @returns {Function}
 */
Renderer.prototype.getTemplate = function *(file) {
  var o = this.options;
  var key = path.relative(o.root, file);

  // when caching is enabled
  if (o.cache) {
    if (this.cache.peek(key)) { // check for existence
      debug("template %s found in cache", key.grey);
      return this.cache.get(key);
    } else {
      var template = yield this.compileTemplate(file);
      debug("saving template %s to cache", key.grey);
      this.cache.set(key, template); // save to the cache
      return template;
    }
  } else {
    return yield this.compileTemplate(file);
  }
};

/**
 * Generates an absolute path to a view given it's "id", which is the value
 * sent by the user in `this.render(":id")` in the koa app.
 *
 * Example: "home" -> "/path/to/root/views/home.hbs"
 *
 * @param {String} id
 * @returns {String}
 */
Renderer.prototype.viewPath = function (id) {
  var o = this.options;
  return path.resolve(o.root, o.viewsPath, id + o.extension);
};

/**
 * Retrieves the template for a view given it's "id"
 *
 * @param {String} id
 * @returns {Function}
 */
Renderer.prototype.getView = function *(id) {
  return yield this.getTemplate(this.viewPath(id));
};

/**
 * Generates an absolute path to a layout given it's "id", which is the value
 * sent by the user in `this.render("view", { layout: ":id" })` in the koa app.
 * (or the value set in `options.defaultLayout`)
 *
 * Example: "main" -> "/path/to/root/layouts/main.hbs"
 *
 * @param {String} id
 * @returns {String}
 */
Renderer.prototype.layoutPath = function (id) {
  var o = this.options;
  return path.resolve(o.root, o.layoutsPath, id + o.extension);
};

/**
 * Retrieves the template for a layout given it's "id"
 *
 * @param {String} id
 * @returns {Function}
 */
Renderer.prototype.getLayout = function *(id) {
  if (!id) return false;
  return yield this.getTemplate(this.layoutPath(id));
};

/**
 * Register one or more partials with handlebars
 * @see handlebars.registerPartial(...)
 *
 * @param  {String}   name
 * @param  {Function} fn
 */
Renderer.prototype.partial = function (name, fn) {
  debug("registering partial %s", name.underline);
  this.handlebars.registerPartial(name, fn);
};

/**
 * Generates a partial path given it's relative path. (if nothing is passed,
 * it will retrieve the root dir absolute path)
 *
 * The general flow of partials differs from views/layouts since handlebars
 * needs them to be registered before actually being used.
 *
 * We glob for them on disk first, and register them all at once. (if caching
 * is turned off, we monitor the filesystem for changes)
 *
 * @param {String} [file]  Path to partial file, relative to partials dir
 */
Renderer.prototype.partialPath = function (file) {
  var o = this.options;
  if (file) return path.resolve(o.root, o.partialsPath, file);
  return path.resolve(o.root, o.partialsPath);
};

/**
 * Take the relative path (ie: `file`) and turn it into a handlebars-friendly
 * partial name. (without slashes, file extension, etc)
 *
 * @param {String} file  Path to file, relative to partials dir
 * @returns {String}
 */
Renderer.prototype.partialId = function (file) {
  var o = this.options;
  return path.join(path.dirname(file), path.basename(file, o.extension));
};

/**
 * Register a partial just given it's relative path.
 *
 * @param {String} file  Path to file, relative to partials dir
 */
Renderer.prototype.getPartial = function *(file) {
  var template = yield this.getFile(this.partialPath(file));
  this.partial(this.partialId(file), template);
};

/**
 * Register all the partials in the partials dir.
 */
Renderer.prototype.getPartials = function *() {
  var o = this.options;

  debug("searching for partials in %s", o.partialsPath.grey);
  var files = yield glob("**/*" + o.extension, { cwd: this.partialPath() });
  debug("%s partials found", files.length.toString().green);

  yield files.map(this.getPartial.bind(this));
};

/**
 * Unregister/remove a partial from it's path (relative to the partials dir)
 *
 * @param {String} file
 */
Renderer.prototype.removePartial = function (file) {
  var id = this.partialId(file);
  debug("unregistering partial %s", id.underline);
  this.handlebars.unregisterPartial(id);
};

/**
 * Sets up a monitor for the partials dir (only used in development mode,
 * when the cache is disabled)
 */
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

/**
 * Stops the partials monitor (unused currently)
 */
Renderer.prototype.unwatchPartials = function () {
  debug("stopping partials monitor");
  this.partialsMonitor.stop();
};

/**
 * Registers one or more helpers with handlebars
 * @see handlebars.registerHelper()
 *
 * @param  {String}   name
 * @param  {Function} fn
 */
Renderer.prototype.helper = function (name, fn) {
  debug("registering helper %s", name.underline);
  this.handlebars.registerHelper(name, fn);
};

/**
 * The main workhorse function. Given the specified view (`template`)
 * and `locals`, it will render and return. (with a layout if needed)
 *
 * `locals` has 1 special-case, which is `layout`. When specified, it will use
 * the layout matching that "id" when rendering the view. (falling back to
 * `options.defaultLayout` if specified)
 *
 * @param {String} template  The view "id"
 * @param {Object} [locals]  The template params
 */
Renderer.prototype.render = function *(template, locals) {
  debug("rendering %s template with", template.underline, locals);
  locals = extend(true, {}, locals);

  var o = this.options;
  var layoutId = locals.layout || o.defaultLayout;
  delete locals.layout;

  // retrieve templates
  var view = yield this.getView(template);
  var layout = yield this.getLayout(layoutId);

  // only on the first call, load partials
  if (!this.partialsLoaded) {
    debug("loading partials on first render call")
    var partials = yield this.getPartials();
    this.partialsLoaded = true; // mark this as complete
    if (!o.cache) this.watchPartials(); // monitor for future changes
  }

  // set up some special meta locals before rendering
  locals._view = template;
  if (layoutId) locals._layout = layoutId;

  // when a layout is needed
  if (layout) {
    debug("rendering with layout %s", layoutId.underline);
    locals.body = view(locals); // special local
    return layout(locals);
  } else {
    return view(locals);
  }
};

/**
 * The main entry point for koa, this returns a middleware function that koa
 * can use.
 *
 * @return {GeneratorFunction}
 */
Renderer.prototype.middleware = function () {
  var self = this;

  return function *(next) {
    // renders the template and returns the string
    // this allows you to do further processing on the response (like using
    // another type besides HTML)
    // this also merges in ctx.locals (if available)
    this.renderView = function *(view, locals) {
      var l = extend(true, {}, this.locals, locals);
      return yield self.render(view, l);
    };

    // renders the template and automatically responds
    this.render = function *(view, locals) {
      this.type = "html";
      this.body = yield this.renderView(view, locals);
    };

    yield next;
  }
};
