var assert = require("assert");
var hbs = require("../index.js");
var Renderer = require("../lib/renderer.js");

describe("koa-handlebars", function () {
  it("should export a function", function *() {
    assert.equal(typeof hbs, "function");
  });

  it("should call Renderer#middleware()", function *() {
    var old = Renderer.prototype.middleware;
    Renderer.prototype.middleware = function () {
      return "middleware";
    };

    assert.equal(hbs(), "middleware");
    Renderer.prototype.middleware = old;
  });

  it("should also expose the Renderer class", function *() {
    assert.strictEqual(hbs.Renderer, Renderer);
  });
});
