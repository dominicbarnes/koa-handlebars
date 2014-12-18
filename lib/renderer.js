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

  // register global helpers/partials
  if (o.helpers) this.helper(o.helpers);
  if (o.partials) this.partial(o.partials);

  // enabling caching (via lru-cache)
  if (o.cache) {
    debug("caching enabled");
    this.cache = new Cache({ max: 100 });
  }
}

// reasonable defaults, exposed to allow users to change globally for their app
Renderer.defaults = require("./defaults.js");

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
  return this.options.viewPath.call(this, id);
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
  return this.options.layoutPath.call(this, id);
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
 * Take the relative path (ie: `file`) and turn it into a handlebars-friendly
 * partial name. (without slashes, file extension, etc)
 *
 * Example: ""
 *
 * @param {String} file  Path to file, relative to partials dir
 * @returns {String}
 */
Renderer.prototype.partialId = function (file) {
  return this.options.partialId.call(this, file);
};

/**
 * Finds the available partials in the partialsDir. If an array, it will loop
 * and find all partials in the given dirs.
 *
 * @returns {Array:String}  List of partial template filenames in all dirs
 */
Renderer.prototype.findPartials = function *() {
  var o = this.options;
  var dir = path.resolve(o.root, o.partialsDir);
  var key = "partials:list:" + dir;
  debug("searching for partials in %s", dir.grey);

  if (o.cache && this.cache.peek(key)) return this.cache.get(key);
  var files = yield glob("**/*" + o.extension, { cwd: dir });
  if (o.cache) this.cache.set(key, files);

  debug("%s partials found", files.length.toString().green);
  return files;
};

/**
 * Retrieves a partial template from it's relative path
 *
 * @param {String} file
 * @returns {Function}
 */
Renderer.prototype.getPartial = function *(file) {
  var o = this.options;
  return yield this.getTemplate(path.resolve(o.root, o.partialsDir, file));
};

/**
 * Returns all the compiled partials
 *
 * @returns {Object}  Shallow hash of all partials
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
  var o = this.options;

  if (typeof template === "object" && template.body) {
    // extract body
    var body = template.body;
    delete template.body;

    // shift arguments
    options = locals;
    locals = template;
  }

  locals = extend(true, {}, locals);
  options = extend(true, { data: o.data }, options);
  debug("rendering %s template with", template.underline, Object.keys(locals));

  var layoutId = locals.layout || o.defaultLayout;
  delete locals.layout;

  // retrieve templates
  if (!body) var view = yield this.getView(template);
  var layout = yield this.getLayout(layoutId);

  // set up some special meta locals before rendering
  if (!body) options.data.view = template;
  if (layoutId) options.data.layout = layoutId;

  // load partials
  options.partials = yield this.getPartials();

  // when a layout is needed
  if (layout) {
    debug("rendering with layout %s", layoutId.underline);
    options.data.body = body || view(locals, options);
    return layout(locals, options);
  } else {
    return body || view(locals, options);
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
      var l = extend(true, {}, this.locals, locals);
      var o = extend(true, { data: { koa: this } }, options);

      if (typeof self.options.beforeRender === "function") {
        self.options.beforeRender.call(this, l, o);
      }

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
