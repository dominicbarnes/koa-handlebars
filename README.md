# koa-handlebars

> A koa middleware for using handlebars templates

## Usage

This middleware adds 2 methods to the koa context object. The primary one is
`render(view, locals)`, which automatically sets the content-type as `text/html`
and writes the generated view as the response. There is also
`renderView(view, locals)`, which yields the raw string. This allows you to
modify the response further.

**app.js**
```js
var koa = require("koa");
var handlebars = require("koa-handlebars");

var app = koa();

app.use(handlebars({
  defaultLayout: "main"
}));

app.use(function *() {
  yield this.render("index", {
    title: "Test Page",
    name: "World"
  });
});

app.listen(3000);
```

**layouts/main.hbs**
```html
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}}</title>
  </head>
  <body>
    {{{body}}}
  </body>
</html>
```

**views/index.hbs**
```html
Hello, {{name}}!
```

[Resulting page](http://localhost:3000)
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Test Page</title>
  </head>
  <body>
    Hello, World!
  </body>
</html>
```

### Views

The entry point for rendering is known as a view. The view usually contains the
content specific to a single page. It has access to all loaded partials, helpers
and is injected into the `{{{body}}}` of the corresponding layout. (if there is
one)

The simplest usage is to have a flat `views/` directory that contains `.hbs`
files. (although other patterns are possible, see the "Advanced Usage" section
for more details)

In "development mode", views are not cached.

### Layouts

Layouts are the content that is shared between many views. Like views, it has
access to all loaded partials and helpers. The `{{{body}}}` local is set as the
content of the corresponding view.

The simplest usage is to have a flat `layouts/` directory that contains `.hbs`
files. (although other patterns are possible, see the "Advanced Usage" section
for more details)

In "development mode", layouts are not cached.

### Partials

[Partials](https://github.com/wycats/handlebars.js/#partials) are sub-templates
that you can use to render smaller bits within layouts/views.

Due to how Handlebars deals with partials, they must all be registered before
they can be used. This is unfortunate, particularly during development, as you
would need to restart your server each time you change a partial. (unlike views
and layouts, which are easy to deal with) Thankfully, koa-handlebars alleviates
this problem for you.

On the first `render` call, the available partials are loaded and compiled. In
"development mode", the partials directory is monitored for changes, keeping
handlebars aware of all changes to partials. (including updates, additions and
removals)

### Helpers

[Helpers](http://handlebarsjs.com/#helpers) are functions that any of your
templates can call upon.

The primary way to register helpers is during init with the `helpers` option.
This is a hash of functions (where each key is the helper id that will be used
in templates)

Currently, these are not very automated, so any changes here will require your
server to be restarted.

### Development

To enable "development mode" in your server, simply set `cache: false` in your
middleware configuration.

In addition, this library uses
[visionmedia/debug](https://github.com/visionmedia/debug), so you can enable
debug output via `DEBUG=koa-handlebars` in the terminal.

### Configuration Options
 * `root`: the root directory to operate with (defaults to `process.cwd()`)
 * `viewsPath`: the path (relative to `root`) to find views (defaults to
   `views/`)
 * `partialsPath`: the path (relative to `root`) to find partials (defaults
   to `partials/`)
 * `layoutsPath`: the path (relative to `root`) to find layouts (defaults to
   `layouts/`)
 * `extension`: the file extension to use for your templates (default: `.hbs`)
 * `defaultLayout`: if you are using layouts, enter your main one here
   (otherwise each call to `render` will need to specify `layout` manually)
 * `helpers`: a hash of helpers to load handlebars with (you can always add
   more after init)
 * `cache`: enables/disables the view cache (default: `true`)

## Advanced Usage

If you have an app structure that's different than the norm, you are able to
accomodate quite a bit by creating a custom instance of the `Renderer`. See
the advanced example for real code demonstrating what I mean.
