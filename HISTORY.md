
1.0.0 / 2016-10-31
==================

  * Update some dependencies to fix 4 known security vulnerabilities (#26)

0.5.7 / 2015-07-22
==================

  * fixing errors caused by missing partials dir

0.5.5 / 2015-06-12
==================

  * allowing front-matter data to be used in layout

0.5.4 / 2015-06-09
==================

  * Added ability to set local layout to null to render view w/out layout (when defaultLayout is set).

0.5.3 / 2015-04-01
==================

  * fixing nasty data clobbering bug caused by not using clean objects

0.5.2 / 2015-03-10
==================

  * merging in `ctx.state` during rendering as well

0.5.1 / 2015-02-25
==================

  * upgrading to `handlebars@3`

0.5.0 / 2015-01-08
==================

  * adding support for injecting locals as yaml front-matter on views and layouts

0.4.1 / 2014-12-18
==================

  * simplified pre-rendering by just using `options.body` instead of changing the signature of `.render()`

0.4.0 / 2014-12-18
==================

  * added ability to pre-render views external to koa-handlebars

0.3.1 / 2014-10-21
==================

  * added `options.data` for adding private render data

0.3.0 / 2014-10-10
==================

  * massive internal overhaul
  * many more configuration options, no longer encouraging custom `Renderer` (although it's still available)
  * no longer injecting data to `locals` (using handlebars' `options.data` instead)
  * default `options.partialId` now camel-cases by default
  * 100% test coverage :)
  * probably more... just read current readme

0.2.0 / 2014-10-02
==================

  * adding custom error message
  * adding `options.beforeRender` fn to make last-minute adjustments before rendering

0.1.4 / 2014-09-22
==================

  * adding `_view` and `_layout` to locals during render
  * cloning `locals` before modifying so we don't clobber the original

0.1.3 / 2014-09-21
==================

  * merging app.locals during rendering

0.1.2 / 2014-09-19
==================

  * adding unit tests (fixes #1)
  * adding inline docs (fixes #3)
  * a couple small bugfixes

0.1.1 / 2014-09-19
==================

  * correcting the spelling of path options internally (oops)

0.1.0 / 2014-09-18
==================

  * took ownership of the `koa-handlebars` name on npm (needed to use a previously unpublished version number)

0.0.1 / 2014-09-18
==================

  * initial release
