var koa = require("koa");
var handlebars = require("../../index.js");

var app = koa();

app.use(require("koa-favi")());
app.use(require("koa-logger")());

app.use(handlebars({
  cache: app.env !== "development",
  defaultLayout: "main"
}));

app.use(function *() {
  yield this.render("test", {
    user: { name: "World" }
  });
});

app.listen(3000);
