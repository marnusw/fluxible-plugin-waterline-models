# Waterline Models Plugin for Fluxible

Provides isomorphic access to models and queries in your [Fluxible](https://github.com/yahoo/fluxible)
application using [Waterline ORM](https://github.com/balderdashy/waterline).

## Summary

Exposes a `models` object on the Action Context for performing Waterline queries. This plugin wat built
to allow using [Sails.js](http://sailsjs.org) app code isomorphically in Fluxible applications, but the
plugin can also be used with any other server-side framework where the Waterline ORM is used.

The only difference from the `sails.models` object and the models object exposed on the context
is that this version has models indexed according to the all lowercase identities as well as
their global ID where capitalisation is maintained. This allows using `context.models.ModelName`
which might be preferred over `modelname`.

## License

This software is free to use under the MIT license.
See the [LICENSE file][] for license text and copyright information.

[LICENSE file]: https://github.com/marnusw/fluxible-plugin-waterline-models/blob/master/LICENSE.md
