var Koa = require("koa");
var handlebars = require("../../index.js");

var app = new Koa();

app.use(require("koa-favi")());
app.use(require("koa-logger")());

app.use(handlebars({
  cache: app.env !== "development",
  defaultLayout: "main"
}));

app.use(async function() {
  await this.render("test", {
    user: { name: "World" }
  });
});

app.listen(3000);
