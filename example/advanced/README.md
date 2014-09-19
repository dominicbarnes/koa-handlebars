# Advanced Example

This example uses a custom `Renderer` in order to support a different filesystem
structure. Instead of the typical `views/index.hbs`, this instead gives each
view/layout/partial it's own directory. Instead, there would be a
`views/index/template.hbs`, where the directory also contains related assets
like images, stylesheets, etc.

This takes cues from [Component](https://github.com/componentjs/component) and
[Duo](http://duojs.org/), given their focus on isolated packages.

To use this example:

```sh
$ git clone git@github.com:dominicbarnes/koa-handlebars.git
$ cd koa-handlebars
$ npm install
$ cd examples/advanced
$ DEBUG=koa-handlebars node --harmony app.js
```
