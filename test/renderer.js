var assert = require("assert");
var Cache = require("lru-cache");
var Handlebars = require("handlebars");
var noop = require("nop");
var path = require("path");
var Renderer = require("../lib/renderer.js");

var fixture = path.resolve.bind(null, __dirname, "fixtures");

describe("Renderer(options)", function () {
  it("should be a function", function () {
    assert.equal(typeof Renderer, "function");
  });

  it("should not require the new keyword", function () {
    var r = Renderer();
    assert(r instanceof Renderer);
  });

  it("should set default options", function () {
    var r = new Renderer();
    assert.deepEqual(r.options, Renderer.defaults);
  });

  it("should override defaults", function () {
    var r = new Renderer({ defaultLayout: "main" });
    assert.equal(r.options.defaultLayout, "main");
  });

  it("should use a new handlebars instance by default", function () {
    var r = new Renderer();
    assert.equal(r.handlebars.VERSION, Handlebars.VERSION);
  });

  it("should allow a custom handlebars instance", function () {
    var hbs = {};
    var r = new Renderer({ handlebars: hbs });
    assert.strictEqual(r.handlebars, hbs);
  });

  it("should register global helpers if provided", function () {
    var helpers = { abc: noop };
    var r = new Renderer({ helpers: helpers });
    assert.strictEqual(r.handlebars.helpers.abc, noop);
  });

  it("should register global partials if provided", function () {
    var partials = { abc: noop };
    var r = new Renderer({ partials: partials });
    assert.strictEqual(r.handlebars.partials.abc, noop);
  });

  it("should set up a cache when enabled", function () {
    var r = new Renderer();
    assert(r.cache instanceof Cache);
  });

  it("should not have a cache when disabled", function () {
    var r = new Renderer({ cache: false });
    assert(!r.cache);
  });
});

describe("Renderer#getFile(file)", function () {
  var r = new Renderer();

  it("should read the contents of the file (absolute path)", async function() {
    var layout = await r.getFile(fixture("layouts/main.hbs"));
    assert.deepEqual(layout, {
      body: "Layout: {{@body}}\n",
      attributes: {}
    });
  });
});

describe("Renderer#compileTemplate(file)", function () {
  it("should return a decorated object for the template", async function() {
    var r = new Renderer();
    var layout = await r.compileTemplate(fixture("layouts/main.hbs"));

    assert.equal(typeof layout, "object");
    assert.equal(layout.body.trim(), "Layout: {{@body}}");
    assert.deepEqual(layout.attributes, {});
    assert.equal(typeof layout.fn, "function");
    assert.equal(typeof layout.render, "function");
  });
});

describe("Renderer#getTemplate(file)", function () {
  it("should cache the template fn when caching is enabled", async function() {
    var r = new Renderer({ root: fixture() });
    var rel = "layouts/main.hbs";
    var path = fixture(rel);
    var key = "template:" + path;

    var layout = await r.getTemplate(path);
    assert.strictEqual(r.cache.get(key), layout);
    var layoutCached = await r.getTemplate(path);
    assert.strictEqual(layoutCached, layout);
  });

  it("should bypass the cache when disabled", async function() {
    var r = new Renderer({ root: fixture(), cache: false });
    var rel = "layouts/main.hbs";
    var key = "template:" + rel;
    var path = fixture(rel);

    var layout = await r.getTemplate(path);
    assert(!r.cache);
  });

  it("should find the right file even with multiple extensions", async function() {
    var r = new Renderer({ root: fixture(), extension: [ ".hbs", ".md" ] });
    var template = await r.getTemplate(fixture("views/markdown"));
    assert.equal(template.render(), "# This is Markdown!\n");
  });

  it("should throw an error when a template is not found", async function() {
    var r = new Renderer({ root: fixture() });
    var file = fixture("views/markdown");

    try {
      await r.getTemplate(file);
      throw new Error("the template should not be found");
    } catch (err) {
      assert.equal(err.message, "Could not find template file: " + file);
    }
  });
});

describe("Renderer#viewPath(id)", function () {
  it("should combine the path correctly", function () {
    var r = new Renderer({
      root: fixture()
    });

    assert.equal(r.viewPath("home"), fixture("views/home"));
  });

  it("should correctly handle options", function () {
    var r = new Renderer({
      root: fixture(),
      viewsDir: "pages"
    });

    assert.equal(r.viewPath("home"), fixture("pages/home"));
  });

  it("should allow using a custom absolute path", function () {
    var r = new Renderer({
      root: fixture(),
      viewPath: function (id) {
        return path.join("/this/is/absolute", id);
      }
    })

    assert.equal(r.viewPath("home"), "/this/is/absolute/home");
  });
});

describe("Renderer#getView(id)", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should retrieve a view function", async function() {
    var view = await r.getView("simple");
    assert.equal(view.render({ name: "World" }).trim(), "Hello, World!");
  });
});

describe("Renderer#layoutPath(id)", function () {
  it("should combine the path correctly", function () {
    var r = new Renderer({
      root: fixture()
    });

    assert.equal(r.layoutPath("main"), fixture("layouts/main"));
  });

  it("should correctly handle options", function () {
    var r = new Renderer({
      root: fixture(),
      layoutsDir: "containers" // lol, not sure what else people call layouts
    });

    assert.equal(r.layoutPath("main"), fixture("containers/main"));
  });

  it("should allow using a custom absolute path", function () {
    var r = new Renderer({
      root: fixture(),
      layoutPath: function (id) {
        return path.join("/this/is/absolute", id);
      }
    })

    assert.equal(r.layoutPath("main"), "/this/is/absolute/main");
  });
});

describe("Renderer#getLayout(id)", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should retrieve a layout function", async function() {
    var layout = await r.getLayout("main");
    assert.equal(layout.render({}, { data: { body: "body" } }).trim(), "Layout: body");
  });
});

describe("Renderer#partial(name, fn)", function () {
  var r = new Renderer();

  it("should register a single partial", function () {
    r.partial("a", noop);
    assert.strictEqual(r.handlebars.partials.a, noop);
  });

  it("should register multiple partials", function () {
    r.partial({ b: noop, c: noop });
    assert.strictEqual(r.handlebars.partials.b, noop);
    assert.strictEqual(r.handlebars.partials.c, noop);
  });
});

describe("Renderer#partialId(file)", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should strip the extension", function () {
    assert.equal(r.partialId("hello.hbs"), "hello");
  });

  it("should camel-case", function () {
    assert.equal(r.partialId("nav/main.hbs"), "navMain");
  });
});

describe("Renderer#findPartials()", function () {
  it("should return an array of files", async function() {
    var r = new Renderer({ root: fixture() });

    var partials = await r.findPartials();
    assert.deepEqual(partials, [ "hello.hbs", "nav/main.hbs" ]);
  });

  it("should work properly with and without '.' prefix in extensions", async function() {
    var r = new Renderer({ root: fixture(), extension: [ "hbs", ".md" ] });

    var partials = await r.findPartials();
    assert.deepEqual(partials, [ "hello.hbs", "markdown.md", "nav/main.hbs" ]);
  });

  it("should retrieve the listing from the cache", async function() {
    var r = new Renderer({ root: fixture() });

    var partials = await r.findPartials();
    assert.equal(partials.length, 2);
    var partialsCached = await r.findPartials();
    assert(r.cache.peek("partials:list:" + fixture("partials")));
    assert.deepEqual(partials, partialsCached);
  });

  it("should bypass the cache when disabled", async function() {
    var r = new Renderer({ root: fixture(), cache: false });

    var partials = await r.findPartials();
    assert.equal(partials.length, 2);
    assert(!r.cache);
  });
});

describe("Renderer#getPartials()", function () {
  it("should register all the partials in the partials dir", async function() {
    var r = new Renderer({ root: fixture() });
    var partials = await r.getPartials();
    assert.equal(typeof partials.hello, 'function');
  });

  it("should not break w/o a partials dir", async function() {
    var r = new Renderer({ root: fixture(), partialsDir: 'does-not-exist' });
    await r.getPartials();
  });
});

describe("Renderer#helper(name, fn)", function () {
  var r = new Renderer();
  var helpers = require("./fixtures/helpers.js");

  it("should register a single helper", function () {
    r.helper("upper", helpers.upper);
    assert.strictEqual(r.handlebars.helpers.upper, helpers.upper);
  });

  it("should register multiple helpers", function () {
    r.helper(helpers);
    assert.strictEqual(r.handlebars.helpers.upper, helpers.upper);
  });
});

describe("Renderer#render(template, locals, options)", function () {
  it("should render a plain view", async function() {
    var r = new Renderer({ root: fixture() });
    var result = await r.render("simple", { name: "World" });
    assert.equal(result.trim(), "Hello, World!");
  });

  it("should render a view within a layout", async function() {
    var r = new Renderer({ root: fixture() });
    var result = await r.render("simple", {
      layout: "main",
      name: "World"
    });
    assert.equal(result.trim(), "Layout: Hello, World!");
  });

  it("should respect options.defaultView", async function() {
    var r = new Renderer({
      root: fixture(),
      defaultLayout: "main"
    });
    var result = await r.render("simple", { name: "World" });
    assert.equal(result.trim(), "Layout: Hello, World!");
  });

  it("should allow overwriting options.defaultView", async function() {
    var r = new Renderer({
      root: fixture(),
      defaultLayout: "does-not-exist"
    });
    var result = await r.render("simple", {
      layout: "main",
      name: "World"
    });
    assert.equal(result.trim(), "Layout: Hello, World!");
  });

  it("should allow overwriting options.defaultView with null (no layout)", async function() {
    var r = new Renderer({
      root: fixture(),
      defaultLayout: "does-not-exist"
    });
    var result = await r.render("simple", {
      layout: null,
      name: "World"
    });
    assert.equal(result.trim(), "Hello, World!");
  });

  it("should add some meta locals (and remove 'layout' from locals)", async function() {
    var r = new Renderer({ root: fixture() });
    var result = await r.render("meta", { layout: "empty" });
    assert.equal(result.trim(), "Layout: empty\nView: meta");
  });

  it("should clone locals and not modify the original", async function() {
    var r = new Renderer({ root: fixture() });
    var locals = { layout: "empty" };
    await r.render("meta", locals);
    assert.deepEqual(locals, { layout: "empty" });
  });

  it("should allow sending a pre-rendered body", async function() {
    var r = new Renderer({ root: fixture() });
    var options = { body: "Hello World!" };
    var body = await r.render('meta', null, options);

    assert.equal(body, "Hello World!");
  });

  it("should still render layouts with a pre-rendered body", async function() {
    var r = new Renderer({ root: fixture() });
    var locals = { layout: "main" };
    var options = { body: "Hello World!" };
    var body = await r.render('meta', locals, options);

    assert.equal(body, "Layout: Hello World!\n");
  });

  it("should extract YAML front-matter from views", async function() {
    var r = new Renderer({ root: fixture() });
    var body = await r.render("front-matter");

    assert.equal(body.trim(), "Hello, World!");
  });

  it("should ensure that YAML data is accessible to all templates", async function() {
    var r = new Renderer({ root: fixture() });
    var body = await r.render("front-matter", { layout: "front-matter" });

    assert.equal(body.trim(), "Layout, World!"); // no {{{@body}}}
  });

  it("should allow YAML in layout", async function() {
    var r = new Renderer({ root: fixture() });
    var body = await r.render("simple", { layout: "front-matter-data" });

    assert.equal(body.trim(), "Layout, Test!"); // no {{{@body}}}
  });

  it("should allow layout YAML to be overridden by view YAML", async function() {
    var r = new Renderer({ root: fixture() });
    var body = await r.render("front-matter", { layout: "front-matter-data" });

    assert.equal(body.trim(), "Layout, World!"); // no {{{@body}}}
  });
});

describe("Renderer#middleware()", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should return a middleware function", function () {
    assert(typeof r.middleware() == "function");
  });

  describe("ctx.renderView(view, locals, options)", function () {
    it("should be added to the context", async function() {
      var ctx = {};
      r.middleware().call({}, ctx, noop);
      assert.equal(typeof ctx.renderView, "function");
    });
  
    it("should call Renderer#render(...)", async function() {
      var ctx = {};
       r.middleware().call({}, ctx, noop);

      var view = "a";
      var locals = { a: "A", b: "B" };
      var options = { data: { hello: "world" } };

      r.render = async function(v, l, o) {
        assert.strictEqual(v, view);
        assert.deepEqual(l, locals);
        assert.strictEqual(o.data.koa, ctx);
        assert.equal(o.data.hello, "world");
        return "html";
      };

      var html = await ctx.renderView(view, locals, options);
      assert.equal(html, "html");
    });

    it("should merge ctx.locals and ctx.state", async function() {
      var ctx = {
        locals: { a: "A" },
        state: { b: "B" }
      };
      r.middleware().call({}, ctx, noop);

      r.render = async function(v, l) {
        assert.deepEqual(l, { a: "A", b: "B", z: "Z" });
        return "html";
      };

      var html = await ctx.renderView("test", { z: "Z" });
      assert.equal(html, "html");
    });

    it("should throw an error", async function() {
      var ctx = {
        throw: function (code, msg) {
          var e = new Error(msg);
          e.code = code;
          throw e;
        }
      };
      r.middleware().call({}, ctx, noop);

      try {
        var html = await ctx.renderView("does-not-exist");
        assert(!html);
        assert(false);
      } catch (err) {
        assert(err instanceof Error);
        assert.equal(err.message.indexOf("unable to render view: does-not-exist because"), 0);
      }
    });

    it("should inject the koa context into the template data", async function() {
      var ctx = {};
      r.middleware().call({}, ctx, noop);

      r.render = async function(v, l, o) {
        assert.strictEqual(o.data.koa, ctx);
        return "html";
      };

      var html = await ctx.renderView("a", {}, {});
      assert.equal(html, "html");
    });
  });

  describe("ctx.render(view, locals, options)", function () {
    it("should be added to the context", async function() {
      var ctx = {};
      r.middleware().call({}, ctx, noop);
      assert.equal(typeof ctx.render, "function");
    });

    it("should call ctx.renderView(...)", async function() {
      var ctx = {};
      r.middleware().call({}, ctx, noop);

      ctx.renderView = async function(view, locals) {
        assert.equal(view, "test");
        assert.deepEqual(locals, { a: "A" });
        return "body";
      };

      await ctx.render("test", { a: "A" });
      assert.equal(ctx.type, "html");
      assert.equal(ctx.body, "body");
    });
  });
});
