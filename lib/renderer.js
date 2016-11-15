// dependencies
var Cache = require("lru-cache");
var chalk = require("chalk");
var debug = require("debug")("koa-handlebars");
var extend = require("extend");
var fm = require("front-matter");
var fs = require("mz/fs");
var handlebars = require("handlebars");
var path = require("path");
var promisify = require("es6-promisify");

// helpers
var find = promisify(require("find-alternate-file"));
var readdir = promisify(require("recursive-readdir"));

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
  if (options) {
    debug("creating koa-handlebars instance with options", options);
  } else {
    debug("creating koa-handlebars instance");
  }

  var o = this.options = extend({}, Renderer.defaults, options);
  debug("using %s as the root", chalk.grey(o.root));

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
Renderer.prototype.getFile = async function(file) {
  debug("reading file %s", chalk.grey(path.relative(this.options.root, file)));
  return fm(await fs.readFile(file, "utf8"));
};

/**
 * Retrieves a file from disk and compiles it into a handlebars function
 *
 * @param {String} file  An absolute path to a template file
 * @returns {Function}
 */
Renderer.prototype.compileTemplate = async function(file) {
  var meta = await this.getFile(file);
  debug("compiling template %s", chalk.grey(path.relative(this.options.root, file)));
  meta.fn = this.handlebars.compile(meta.body);
  meta.render = function (locals, options) {
    return this.fn(locals, options);
  };
  return meta;
};

/**
 * Retrieves a compiled template. Also gets/sets from the cache if enabled.
 *
 * @param {String} file  An absolute path to a template file
 * @returns {Function}
 */
Renderer.prototype.getTemplate = async function(file) {
  var o = this.options;
  var abs = await find(file, o.extension);
  if (!abs) throw new Error("Could not find template file: " + file);

  var rel = path.relative(o.root, abs);
  var key = "template:" + abs;

  // when caching is enabled
  if (o.cache) {
    if (this.cache.peek(key)) { // check for existence
      debug("template %s found in cache", chalk.grey(rel));
      return this.cache.get(key);
    } else {
      var template = await this.compileTemplate(abs);
      debug("saving template %s to cache", chalk.grey(rel));
      this.cache.set(key, template); // save to the cache
      return template;
    }
  } else {
    return await this.compileTemplate(abs);
  }
};

/**
 * Generates an path to a view given it's "id", which is the value sent by the
 * user in `this.render(":id")` in the koa app.
 *
 * If the path returned is relative, it will be assumed to be relative to the
 * configured `viewsDir` (which is relative to the configured `root`)
 *
 * Example: "home" -> "views/home"
 *
 * @param {String} id
 * @returns {String}
 */
Renderer.prototype.viewPath = function (id) {
  var o = this.options;
  var ret = o.viewPath.call(this, id);
  if (path.isAbsolute(ret)) return ret;
  return path.join(o.root, o.viewsDir, ret);
};

/**
 * Retrieves the template for a view given it's "id"
 *
 * @param {String} id
 * @returns {Function}
 */
Renderer.prototype.getView = async function(id) {
  return await this.getTemplate(this.viewPath(id));
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
  var ret = o.layoutPath.call(this, id);
  if (path.isAbsolute(ret)) return ret;
  return path.join(o.root, o.layoutsDir, ret);
};

/**
 * Retrieves the template for a layout given it's "id"
 *
 * @param {String} id
 * @returns {Function}
 */
Renderer.prototype.getLayout = async function(id) {
  if (!id) return false;
  return await this.getTemplate(this.layoutPath(id));
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
Renderer.prototype.findPartials = async function() {
  var o = this.options;
  var dir = path.resolve(o.root, o.partialsDir);
  var extensions = normalizeExtensions(o.extension);
  var key = "partials:list:" + dir;
  debug("searching for partials in %s", chalk.grey(dir));

  var exists = await fs.exists(dir);
  if (!exists) return [];

  if (o.cache && this.cache.peek(key)) return this.cache.get(key);
  var files = await readdir(dir);

  files = files.map(function (file) {
    return path.relative(dir, file);
  });

  files = files.filter(function (file) {
    return extensions.indexOf(path.extname(file)) > -1;
  });

  if (o.cache) this.cache.set(key, files);

  debug("%s partials found", chalk.green(files.length));
  return files;
};

/**
 * Retrieves a partial template from it's relative path
 *
 * @param {String} file
 * @returns {Function}
 */
Renderer.prototype.getPartial = async function(file) {
  var o = this.options;
  var tpl = await this.getTemplate(path.resolve(o.root, o.partialsDir, file));
  return tpl.fn;
};

/**
 * Returns all the compiled partials
 *
 * @returns {Object}  Shallow hash of all partials
 */
Renderer.prototype.getPartials = async function() {
  var self = this;
  var files = await this.findPartials();
  var partials = {};
  for (file of files) partials[self.partialId(file)] = await self.getPartial(file);
  return partials;
};

/**
 * Registers one or more global partials with handlebars
 * @see handlebars.registerPartial()
 *
 * @param  {String}   name
 * @param  {Function} fn
 */
Renderer.prototype.partial = function (name, fn) {
  debug("registering global partial %s", chalk.underline(name));
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
  debug("registering global helper %s", chalk.underline(name));
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
Renderer.prototype.render = async function(template, locals, options) {
  var o = this.options;

  locals = extend(true, {}, locals);
  options = extend(true, {}, { data: o.data }, options);
  debug("rendering %s template", chalk.underline(template));

  // extract layout id
  var layoutId = typeof locals.layout === 'undefined' ? o.defaultLayout : locals.layout;
  delete locals.layout;

  // extract pre-rendered body
  var body = options.body;

  // retrieve layout (if needed)
  var layout = await this.getLayout(layoutId);

  // retrieve view
  if (!body) var view = await this.getView(template);

  // extend locals with front-matter data
  if (layout && layout.attributes) extend(locals, layout.attributes);
  if (view && view.attributes) extend(locals, view.attributes);

  // set up some special meta locals before rendering
  options.data.view = template;
  if (layoutId) options.data.layout = layoutId;

  // load partials
  options.partials = await this.getPartials();

  // when a layout is needed
  if (layout) {
    debug("rendering with layout %s", chalk.underline(layoutId));
    options.data.body = body || view.render(locals, options);
    return layout.render(locals, options);
  } else {
    return body || view.render(locals, options);
  }
};

/**
 * The main entry point for koa, this returns a middleware function that koa
 * can use.
 *
 * @return {GeneratorFunction}
 */
Renderer.prototype.middleware = function() {
  var self = this;

  return async function(ctx, next) {
    // renders the template and returns the string
    // this allows you to do further processing on the response (like using
    // another type besides HTML)
    // this also merges in ctx.state and ctx.locals (if available)
    ctx.renderView = async function(view, locals, options) {
      var l = extend(true, {}, ctx.state, ctx.locals, locals);
      var o = extend(true, { data: {} }, options);
      o.data.koa = ctx;

      try {
        return await self.render(view, l, o);
      } catch (err) {
        debug("unable to render view %s", chalk.underline(view), err.stack);
        ctx.throw(500, "unable to render view: " + view + " because " + err.message);
      }
    };

    // renders the template and automatically responds
    ctx.render = async function(view, locals, options) {
      ctx.type = "html";
      ctx.body = await ctx.renderView(view, locals, options);
    };

    await next();
  }
};


/**
 * Normalize an array of file extensions:
 *
 *  - Make an array if not already
 *  - Ensure each has the `.` prefix
 *
 * @param {Mixed} list
 * @returns {Array:String}
 */

function normalizeExtensions(list) {
  if (!Array.isArray(list)) list = [ list ];

  return list.map(function (ext) {
    return ext[0] === "." ? ext : "." + ext;
  });
}
