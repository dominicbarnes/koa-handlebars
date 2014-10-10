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
}

// reasonable defaults, exposed to allow users to change globally for their app
Renderer.defaults = {
  root: process.cwd(),      // root directory to search for templates
  viewsPath: "views",       // what dir contains views
  partialsPath: "partials", // what dir contains partials
  layoutsPath: "layouts",   // what dir contains layouts
  extension: ".hbs",        // what extension to use for templates
  defaultLayout: null,      // what layout (if any) should be used by default
  helpers: null,            // predefined helpers
  cache: true,              // whether or not to cache templates
  beforeRender: null        // allow last-second modifications before render
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
  var rel = path.relative(o.root, file);
  var key = "template:" + file;

  // when caching is enabled
  if (o.cache) {
    if (this.cache.peek(key)) { // check for existence
      debug("template %s found in cache", rel.grey);
      return this.cache.get(key);
    } else {
      var template = yield this.compileTemplate(file);
      debug("saving template %s to cache", rel.grey);
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
 * Finds the available partials in the partialsDir
 *
 * If caching is enabled, then this list is cached
 */
Renderer.prototype.findPartials = function *() {
  var o = this.options;
  debug("searching for partials in %s", o.partialsPath.grey);
  var params = { cwd: this.partialPath() };
  var key = "partials:list";

  if (o.cache && this.cache.peek(key)) return this.cache.get(key);
  var files = yield glob("**/*" + o.extension, params);
  if (o.cache) this.cache.set(key, files);

  debug("%s partials found", files.length.toString().green);
  return files;
};

/**
 * Register a partial just given it's relative path.
 *
 * @param {String} file  Path to file, relative to partials dir
 */
Renderer.prototype.getPartial = function *(file) {
  return yield this.getTemplate(this.partialPath(file));
};

/**
 * Returns a hash of all the partials in the partialsDir
 */
Renderer.prototype.getPartials = function *() {
  var self = this;
  var files = yield this.findPartials();

  return yield files.reduce(function (acc, file) {
    acc[self.partialId(file)] = self.getPartial(file);
    return acc;
  }, {});
};

/**
 * Registers one or more global partials with handlebars
 * @see handlebars.registerPartial()
 *
 * @param  {String}   name
 * @param  {Function} fn
 */
Renderer.prototype.partial = function (name, fn) {
  debug("registering global partial %s", name.underline);
  this.handlebars.registerPartial(name, fn);
};

/**
 * Registers one or more global helpers with handlebars
 * @see handlebars.registerHelper()
 *
 * @param  {String}   name
 * @param  {Function} fn
 */
Renderer.prototype.helper = function (name, fn) {
  debug("registering global helper %s", name.underline);
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
 * @param {String} template   The view "id"
 * @param {Object} [locals]   The template params
 * @param {Object} [options]  Additional options for handlebars
 */
Renderer.prototype.render = function *(template, locals, options) {
  locals = extend(true, {}, locals);
  options = extend(true, { data: {} }, options);
  debug("rendering %s template with", template.underline, Object.keys(locals));

  var o = this.options;
  var layoutId = locals.layout || o.defaultLayout;
  delete locals.layout;

  // retrieve templates
  var view = yield this.getView(template);
  var layout = yield this.getLayout(layoutId);

  // set up some special meta locals before rendering
  options.data.view = template;
  if (layoutId) options.data.layout = layoutId;

  // load partials
  options.partials = yield this.getPartials();

  // when a layout is needed
  if (layout) {
    debug("rendering with layout %s", layoutId.underline);
    options.data.body = view(locals, options);
    return layout(locals, options);
  } else {
    return view(locals, options);
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
    this.renderView = function *(view, locals, options) {
      if (!locals) locals = {};
      if (!options) options = {};

      if (typeof self.options.beforeRender === "function") {
        self.options.beforeRender.call(this, locals, options);
      }

      var l = extend(true, {}, this.locals, locals);
      var o = extend(true, { data: { koa: this } }, options);

      try {
        return yield self.render(view, l, o);
      } catch (err) {
        debug("unable to render view %s", view.underline, err.stack);
        this.throw(500, "unable to render view: " + view + " because " + err.message);
      }
    };

    // renders the template and automatically responds
    this.render = function *(view, locals, options) {
      this.type = "html";
      this.body = yield this.renderView(view, locals, options);
    };

    yield next;
  }
};
