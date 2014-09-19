var assert = require("assert");
var hbs = require("..");
var Renderer = require("../lib/renderer.js");

describe("koa-handlebars", function () {
  it("should export a function", function *() {
    assert.equal(typeof hbs, "function");
  });

  it("should also expose the Renderer class", function *() {
    assert.strictEqual(hbs.Renderer, Renderer);
  });
});
