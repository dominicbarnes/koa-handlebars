exports.upper = function (str) {
  return str.toUpperCase();
};

exports.link = function(object) {
  var url = this.handlebars.escapeExpression(object.url),
      text = this.handlebars.escapeExpression(object.text);

  return new this.handlebars.SafeString(
    "<a href='" + url + "'>" + text + "</a>"
  );
};
