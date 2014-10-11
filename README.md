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
    {{{@body}}}
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
and is injected into the `{{{@body}}}` of the corresponding layout. (if there is
one)

The simplest usage is to have a flat `views/` directory that contains `.hbs`
files. (although other patterns are possible, see the "Advanced Usage" section
for more details)

In "development mode", views are not cached.

### Layouts

Layouts are the content that is shared between many views. Like views, it has
access to all loaded partials and helpers. The `{{{@body}}}` local is set as the
content of the corresponding view.

The simplest usage is to have a flat `layouts/` directory that contains `.hbs`
files. (although other patterns are possible, see the "Advanced Usage" section
for more details)

In "development mode", layouts are not cached.

### Partials

[Partials](https://github.com/wycats/handlebars.js/#partials) are sub-templates
that you can use to render smaller bits within layouts/views.

There are 2 main types of partials. First, global partials are registered
during init. (see `options.partials`) These will not be dynamically updated,
not even during "development mode". (thus, you will need to restart your server
when these globals change)

Secondly, partials residing in the directory specified by `options.partialsDir`
will be dynamically loaded on each render call. When caching is enabled, that
overhead is reduced substantially, and further optimization will be done in the
future.

### Helpers

[Helpers](http://handlebarsjs.com/#helpers) are functions that any of your
templates can call upon.

Currently, helpers can only be defined globally and must be declared during
initialization. (see `options.helpers`) This requires a server restart after
any changes, but this will be improved upon in the future.

### Development

To enable "development mode" in your server, simply set `cache: false` in your
middleware configuration.

In addition, this library uses
[visionmedia/debug](https://github.com/visionmedia/debug), so you can enable
debug output via `DEBUG=koa-handlebars` in the terminal.

### Special Variables

When rendering templates, koa-handlebars will add 3 special private variables
to your templates:

 * `@body`: in layouts, this is the contents of the rendererd view
 * `@view`: the name of the view that is being rendered
 * `@layout`: the name of the layout that is being rendered
 * `@koa`: the koa `ctx` of the current request

You can add more variables of your own via the `beforeRender` option. (see
configuration options section for more details)

Generally speaking, avoid injecting data directly into `locals` from middleware,
instead focus on adding things to `options.data` or using the koa context to
grab data from there. (eg: `{{@koa.request.length}}`)

## Configuration Options

### root

The base directory to use when resolving paths.

**Default:** `process.cwd()`

### cache

Enables or disables the view cache. This is basically the flag for "development
mode".

**Default:**: `true`

```js
app.use(handlebars({
  cache: app.env !== "development"
}));
```

### extension

The file extension used by templates. Your files must be named consistently
throughout the project at this time.

**Default:** `".hbs"`

### viewsDir

The location of your view templates (relative to `root`)

**Default:** "views"

### viewPath(id)

Translates an `id` passed to `render()` and returns an absolute path to the
template. For example: `"home" => "/path/to/root/views/home.hbs"`

This function is run with the renderer as it's context (ie: `this`) so you can
access `this.options` within your custom functions.

### defaultLayout

If you are using layouts, then this can be used to bypass requiring each call
to `render()` to specify a layout manually. Otherwise, leaving it empty will
not render a layout at all unless otherwise specified.

### layoutsDir

The location of your layout templates (relative to `root`)

**Default:** "layouts"

### layoutPath(id)

Translates an `id` passed to `render()` and returns an absolute path to the
template. For example: `"main" => "/path/to/root/layouts/main.hbs"`

This function is run with the renderer as it's context (ie: `this`) so you can
access `this.options` within your custom functions.

### partialsDir

The location of your non-global partial templates (relative to `root`)

**Default:** "partials"

### partialId(file)

This function is a little backwards compared to layouts and views, but it takes
a path for a partial template file. (relative to `partialsDir`) and converts it
into a handlebars-friendly identifier.

For example: `"navigation.hbs" => "navigation"`

By default, it will camel-case your partial if it is in a nested directory.

For example: `"nav/main.hbs" => "navMain"`

### helpers

Allows you to define global helpers during initialization, this should be a
shallow object where each key is a helper name and the value is a function.

### partials

Allows you to define global partials during initialization, this should be a
shallow object where each key is a partial name and the value is a function.

### beforeRender(locals, options)

This function is around to give you a hook in before rendering is performed
to make last-minute modifications to either the view `locals` or the handlebars
`options` (see [docs](http://handlebarsjs.com/execution.html) for more info)

*Generally-speaking*, you should avoid modifying `locals`. If you have further
data you want your templates to access, use `options.data` instead.
