// dependencies
var camel = require("to-camel-case");
var koa = require("koa");
var handlebars = require("../../index.js");
var path = require("path");

// locals
var app = koa();

// middleware
app.use(require("koa-favi")());
app.use(require("koa-logger")());

// handlebars config
app.use(handlebars({
  // setting up cache based on the env
  cache: app.env !== "development",

  // setting up a default layout
  defaultLayout: "main",

  // custom views dir
  viewsDir: "pages",

  // expects pages/:name/template.hbs
  viewPath: function (id) {
    var o = this.options;
    return path.resolve(o.root, o.viewsDir, id, "template" + o.extension);
  },

  // expects layouts/:name/template.hbs
  layoutPath: function (id) {
    var o = this.options;
    return path.resolve(o.root, o.layoutsDir, id, "template" + o.extension);
  },

  // expects partials/:name/template.hbs
  partialId: function (file) {
    return camel(file.split(path.sep).slice(0, -1).join("-"));
  },

  // loading some global helpers
  helpers: require("./lib/helpers.js")
}));

// render example
app.use(function *() {
  yield this.render("test", {
    user: { name: "World" }
  });
});

// start server
app.listen(3000);
