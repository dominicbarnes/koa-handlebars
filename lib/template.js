
var fm = require("front-matter");
var fs = require("co-fs");

function Template(file, handlebars) {
  this.file = file;
  this.handlebars = handlebars;
}

Template.prototype.get = function *(contents) {
  var contents = yield fs.readFile(this.file, "utf8");

  if (fm.test(contents)) {
    var meta = fm.parse(contents);
    this.locals = meta.attributes;
    this.contents = meta.body;
  } else {
    this.contents = contents;
  }

  this.fn = this.handlebars.compile(this.contents);
};

Template.prototype.render = function (options) {

}
