var assert = require("assert");
var Cache = require("lru-cache");
var co = require("co");
var Handlebars = require("handlebars");
var isGenerator = require("is-generator").fn;
var noop = function*(){};
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

  it("should register helpers if provided", function () {
    var helpers = { abc: noop };
    var r = new Renderer({ helpers: helpers });
    assert.strictEqual(r.handlebars.helpers.abc, noop);
  });

  it("should set up a cache when enabled", function () {
    var r = new Renderer();
    assert(r.cache instanceof Cache);
  });

  it("should not have a cache when disabled", function () {
    var r = new Renderer({ cache: false });
    assert(!r.cache);
  });

  it("should init the partialsLoaded flag", function () {
    var r = new Renderer();
    assert(!r.partialsLoaded);
  });
});

describe("Renderer#getFile(file)", function () {
  var r = new Renderer();

  it("should read the contents of the file (absolute path)", function *() {
    var layout = yield r.getFile(fixture("layouts/main.hbs"));
    assert.equal(layout.trim(), "Layout: {{body}}");
  });
});

describe("Renderer#compileTemplate(file)", function () {
  it("should compile the file into a template (absolute path)", function *() {
    var r = new Renderer();
    var layout = yield r.compileTemplate(fixture("layouts/main.hbs"));
    assert.equal(typeof layout, "function");
    assert.equal(layout({ body: "a" }).trim(), "Layout: a");
  });
});

describe("Renderer#getTemplate(file)", function () {
  it("should cache the template fn when caching is enabled", function *() {
    var r = new Renderer({ root: fixture() });
    var key = "layouts/main.hbs";
    var layout = yield r.getTemplate(fixture(key));
    assert.strictEqual(r.cache.get(key), layout);
  });
});

describe("Renderer#viewPath(id)", function () {
  it("should combine the path correctly", function () {
    var r = new Renderer({
      root: fixture()
    });

    assert.equal(r.viewPath("home"), fixture("views/home.hbs"));
  });

  it("should correctly handle options", function () {
    var r = new Renderer({
      root: fixture(),
      viewsPath: "pages",
      extension: ".handlebars"
    });

    assert.equal(r.viewPath("home"), fixture("pages/home.handlebars"));
  });
});

describe("Renderer#getView(id)", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should retrieve a view function", function *() {
    var view = yield r.getView("simple");
    assert.equal(view({ name: "World" }).trim(), "Hello, World!");
  });
});

describe("Renderer#layoutPath(id)", function () {
  it("should combine the path correctly", function () {
    var r = new Renderer({
      root: fixture()
    });

    assert.equal(r.layoutPath("main"), fixture("layouts/main.hbs"));
  });

  it("should correctly handle options", function () {
    var r = new Renderer({
      root: fixture(),
      layoutsPath: "containers", // lol, not sure what else people call layouts
      extension: ".handlebars"
    });

    assert.equal(r.layoutPath("main"), fixture("containers/main.handlebars"));
  });
});

describe("Renderer#getLayout(id)", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should retrieve a layout function", function *() {
    var layout = yield r.getLayout("main");
    assert.equal(layout({ body: "body" }).trim(), "Layout: body");
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

describe("Renderer#partialPath(file)", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should return the partials dir", function () {
    assert.equal(r.partialPath(), fixture("partials"));
  });

  it("should combine the path correctly", function () {
    assert.equal(r.partialPath("hello.hbs"), fixture("partials/hello.hbs"));
  });
});

describe("Renderer#partialId(file)", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should strip the extension", function () {
    assert.equal(r.partialId("hello.hbs"), "hello");
  });
});

describe("Renderer#getPartial(file)", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should register the partial at the give path", function *() {
    yield r.getPartial("hello.hbs");
    assert(r.handlebars.partials.hello);
  });
});

describe("Renderer#getPartials()", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should register all the partials in the partials dir", function *() {
    yield r.getPartials();
    assert(r.handlebars.partials.hello);
  });
});

describe("Renderer#removePartial(file)", function () {
  it("should unregister the partial matching that file", function *() {
    var r = new Renderer({ root: fixture() });
    yield r.getPartials();
    r.removePartial("hello.hbs");
    assert(!r.handlebars.partials.hello);
  });
});

// TODO
// describe("Renderer#watchPartials()");
// describe("Renderer#unwatchPartials()");

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

describe("Renderer#render(template, locals)", function () {
  it("should render a plain view", function *() {
    var r = new Renderer({ root: fixture() });
    var result = yield r.render("simple", { name: "World" });
    assert.equal(result.trim(), "Hello, World!");
  });

  it("should render a view within a layout", function *() {
    var r = new Renderer({ root: fixture() });
    var result = yield r.render("simple", {
      layout: "main",
      name: "World"
    });
    assert.equal(result.trim(), "Layout: Hello, World!");
  });

  it("should respect options.defaultView", function *() {
    var r = new Renderer({
      root: fixture(),
      defaultLayout: "main"
    });
    var result = yield r.render("simple", { name: "World" });
    assert.equal(result.trim(), "Layout: Hello, World!");
  });

  it("should allow overwriting options.defaultView", function *() {
    var r = new Renderer({
      root: fixture(),
      defaultLayout: "does-not-exist"
    });
    var result = yield r.render("simple", {
      layout: "main",
      name: "World"
    });
    assert.equal(result.trim(), "Layout: Hello, World!");
  });

  it("should set the partialsLoaded flag", function *() {
    var r = new Renderer({ root: fixture() });
    var result = yield r.render("simple");
    assert(r.partialsLoaded);
  });

  it("should not watch partials when caching enabled");
  it("should start watching partials if caching disabled");

  it("should add some meta locals (and remove 'layout' from locals)", function *() {
    var r = new Renderer({ root: fixture() });
    var result = yield r.render("meta", { layout: "empty" });
    assert.equal(result.trim(), "Layout: empty\nView: meta");
  });

  it("should clone locals and not modify the original", function *() {
    var r = new Renderer({ root: fixture() });
    var locals = { layout: "empty" };
    yield r.render("meta", locals);
    assert.deepEqual(locals, { layout: "empty" });
  });
});

describe("Renderer#middleware()", function () {
  var r = new Renderer({
    root: fixture()
  });

  it("should return a generator function", function () {
    assert(isGenerator(r.middleware()));
  });

  describe("ctx.renderView(view, locals)", function () {
    it("should be added to the context", function *() {
      var ctx = {};
      co(r.middleware()).call(ctx, noop);
      assert.equal(typeof ctx.renderView, "function");
    });

    it("should call Renderer#render(view, locals)", function *() {
      var ctx = {};
      co(r.middleware()).call(ctx, noop);

      var view = "a";
      var locals = { a: "A", b: "B" };

      r.render = function *(v, l) {
        assert.strictEqual(v, view);
        assert.deepEqual(l, locals);
        return "html";
      };

      var html = yield ctx.renderView(view, locals);
      assert.equal(html, "html");
    });

    it("should merge ctx.locals", function *() {
      var ctx = {
        locals: { a: "A" }
      };
      co(r.middleware()).call(ctx, noop);

      r.render = function *(v, l) {
        assert.deepEqual(l, { a: "A", b: "B" });
        return "html";
      };

      var html = yield ctx.renderView("test", { b: "B" });
      assert.equal(html, "html");
    });
  });

  describe("ctx.render(view, locals)", function () {
    it("should be added to the context", function *() {
      var ctx = {};
      co(r.middleware()).call(ctx, noop);
      assert.equal(typeof ctx.render, "function");
    });

    it("should call ctx.renderView(view, locals)", function *() {
      var ctx = {};
      co(r.middleware()).call(ctx, noop);

      ctx.renderView = function *(view, locals) {
        assert.equal(view, "test");
        assert.deepEqual(locals, { a: "A" });
        return "body";
      };

      yield ctx.render("test", { a: "A" });
      assert.equal(ctx.type, "html");
      assert.equal(ctx.body, "body");
    });
  });
});
