
# 0.3.0 / 10-10-2014
 * massive internal overhaul
 * many more configuration options, no longer encouraging custom `Renderer` (although it's still available)
 * no longer injecting data to `locals` (using handlebars' `options.data` instead)
 * default `options.partialId` now camel-cases by default
 * 100% test coverage :)
 * probably more... just read current readme

# 0.2.0 / 10-02-2014
 * adding custom error message
 * adding `options.beforeRender` fn to make last-minute adjustments before rendering

# 0.1.4 / 09-22-2014
 * adding `_view` and `_layout` to locals during render
 * cloning `locals` before modifying so we don't clobber the original

# 0.1.3 / 09-21-2014
 * merging app.locals during rendering

# 0.1.2 / 09-19-2014
 * adding unit tests (fixes #1)
 * adding inline docs (fixes #3)
 * a couple small bugfixes

# 0.1.1 / 09-19-2014
 * correcting the spelling of path options internally (oops)

# 0.1.0 / 09-18-2014
 * took ownership of the `koa-handlebars` name on npm (needed to use a previously unpublished version number)

# 0.0.1 / 09-18-2014
 * initial release
