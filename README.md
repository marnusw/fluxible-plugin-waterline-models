# Waterline Models Plugin for Fluxible

A plugin for [Fluxible](http://fluxible.io) applications to use the 
[Waterline ORM](https://github.com/balderdashy/waterline) on the client and server isomorphically.

## Summary

The plugin exposes a `models` property on the Fluxible ActionContext for performing Waterline queries in
action creators, and the `getModelConstructor(identity)` method on the StoreContext so plain JavaScript 
record data objects can be converted to record instances within a store.

This plugin wat built to allow using [Sails.js](http://sailsjs.org) model definitions isomorphically 
in Fluxible applications, but the plugin can also be used to initialize and interface with the Waterline 
ORM as a stand-alone component without Sails.

The only difference from the `sails.models` object and the models object exposed on the context
is that this version has models indexed according to the all lowercase `identity` as well as, if
applicable, the `globalID` where capitalisation is maintained. This allows using 
`actionContext.models.ModelName` which may be preferred over `modelname`.

*If you are using this with Sails.js and aren't interested in all the details you can skip to 
the [Use with Sails.js](#use-with-sailsjs) example at the end.*


## Usage

Because the plugin will be used on the server and client configuration must be provided for both.
The option to set models initialised externally is also provided which will simply expose these models 
on the context, this will be the case when the plugin is used alongside Sails.js on the server.

It is assumed that the three de facto standard isomorphic startup scripts `app.js`, `server.js` and 
`client.js` are used.


### Configuration Options

Options for configuring Waterline and registering models are shown below. Since the configuration may,
and probably will, be different on the `client` and `server` options can be specified for either, and
jointly using the `common` options where there is overlap. The specific options will be merge with the
common options to reach the final configuration. None of the three keys are required at any time.

```javascript
var options = {
  common: {
    // Options to used on the server and client.
    modelDefaults: {
      // All model definitions will be merged with these defaults.
      connection: 'inMemoryDb' // e.g. set a default connection for models, then override below
    },
    models: {
      modelIdentity: {
        identity: '',   // Required: The key that will be used to retrieve the model 
                        // from `actionContext.models`.
        connection: '', // Required: The connection to use for persistence; 
                        // must match one of the connections.
        attributes: ''  // Required: An object specifying the prototype 
                        // properties and methods.
      }
    },
    connections: {
      inMemoryDb: {
        adapter: 'sails-memory' // Required: The adapter used for this connection.
        // Additional connection settings.
      }
    }
  },
  server: {
    // Options merged with the common options for use on the server.
  },
  client: {
    // Options merged with the common options for use on the client.
  }
};
```

The model definitions on `models` can be provided as an array or object.

The minimum configuration required before the ORM can be initialized is:

 * **For models:** the `identity`, `connection`, and `attributes` properties.
 * **For connections:** a Waterline `adapter` property.

For more details see the code example above and look at the 
[Waterline-](https://github.com/balderdashy/waterline) and 
[Sails.js](http://sailsjs.org/#!/documentation/concepts/ORM) documentation.

If models will be initialised externally and set on the plugin using the `setExternalModels()` method
the configuration for that particular case (server or client) needn't be provided at all.


### Configuring the ORM

Configuration options can be provided to the plugin constructor or set later using the `configure()` 
method. Options can be provided multiple times and will be merged.

```javascript
import WaterlineModelsPlugin from 'fluxible-plugin-waterline-models';

app.plug(WaterlineModelsPlugin(options));


// More configuration later.
app.getPlugin('WaterlineModelsPlugin').configure(moreOptions);
```

The `configure()` method returns the plugin instance to allow fluent chaining.


### Initialize/tearDown the ORM

Before using the models on the action context the ORM must be initialized. Once initialized the 
configuration may not be changed anymore.

#### Server Side Initialization

```javascript
import sailsMemory from 'sails-memory';

var adapters = [sailsMemory];

app.getPlugin('WaterlineModelsPlugin')
  .configure(options)
  .initialize(adapters, (err, ormModels) => {
    // ORM is initialized and ready for use on the server.
  });
```

or if you prefer using promises you can do

```javascript
app.getPlugin('WaterlineModelsPlugin')
  .configure(options)
  .initialize(adapters)
  .then(ormModels => {
    // ORM is initialized and ready for use.
  })
  .catch(error => {});
```

The `adapters` can be provided as an array or object.

#### Client Side Initialization

If a client configuration and **client adapters have been provided** the ORM will be initialized 
automatically when the Fluxible Context is rehydrated (see below).

If, however, client adapters have not been provided initialization can still be done in the 
`client.js` script:
  
```javascript
import sailsMemory from 'sails-memory';

const modelsPlugin = app.getPlugin('WaterlineModelsPlugin');

// Configure the plugin before rehydration
modelsPlugin.configure({client: options});

app.rehydrate(dehydratedState, (err, context) => {
  modelsPlugin.initialize([sailsMemory])
    then(models => {
      // Continue rendering the app etc.
    });
});
```

#### Tear Down

Before the plugin goes out of scope be sure to call

```javascript
app.getPlugin('WaterlineModelsPlugin').tearDown();
```

to close the connections to all adapters.


### Set Client Adapters via the Plugin Constructor

Since the same adapters will likely not be used on the client and server especially the server adapters 
should not be set in the common `app.js` script since they would be bundled with the client side code 
increasing the bundle size. 

However, loading the client adapters on the server is less of an issue since they are loaded once when
the Node.js process is started, and then don't affect server operation in any noteworthy way. 
 
The plugin constructor therefore supports setting the client adapters early which can keep the `client.js`
script cleaner by avoiding the need to access the plugin there at all.

```javascript
// app.js

import WaterlineModelsPlugin from 'fluxible-plugin-waterline-models';
import someClientAdapter from 'some-client-adapter';

var clientAdapters = {
  'some-client-adapter': someClientAdapter
};

// Set the client options and adapters.
app.plug(WaterlineModelsPlugin(options, clientAdapters));


// server.js

import someServerAdapter from 'some-server-adapter';

app.getPlugin('WaterlineModelsPlugin').initialize([someServerAdapter])
  .then(ormModels => { ... });


// client.js

// Nothing to do here!
```

Again the `clientAdapters` can be provided as an array or object.

Providing options is still optional even when client adapters are passed to the constructor:

```javascript
app.plug(WaterlineModelsPlugin(clientAdapters));
```


### Use with Sails.js

When using the plugin with Sails.js the model definitions will already be loaded and the server ORM 
initialized. In this case the initialized models can be set directly and only the client configuration
needs to be provided. Importing the client adapters in the shared `app.js` script means it will be
included in the client JS bundle.

```javascript
// app.js

import egSomeRestAdapter from 'sails-rest-adapter';

const clientAdapters = [egSomeRestAdapter];

// Initialize with client adapters here.
app.plug(WaterlineModelsPlugin(clientAdapters));


// server.js

// Get the model definitions (you might do this once at start-up and reuse this).
sails.modules.loadModels(function(err, models) {

  // Update the model defs for the client as necessary here (again this could be reused).
  // For example, change the connection properties:
  _.each(models, model => model.connection = 'egSomeRestConnection');

  app.getPlugin('WaterlineModelsPlugin')
    .configure({
      // No server config necessary since we're setting the models from sails
      client: {
        models: models,
        connections: {
          egSomeRestConnection: sails.config.connections.egSomeRestConnection
        }
      }
    })
    .setExternalModels(sails.models); // The plugin is now "initialized".

});


// client.js

// Nothing to do here!
```

#### waterline-sails.io.js adapter

A client adapter that might be useful is [waterline-sails.io.js](https://github.com/marnusw/waterline-sails.io.js)
which allows Waterline to communicate with the server using the 
[sails.io.js](http://sailsjs.org/#!/documentation/reference/websockets/sails.io.js) web-socket client.


## Tests

```
npm install
npm test
```


## Contributing

PRs are welcome. Please add tests for any changes.


## License

This software is free to use under the MIT license.
See the [LICENSE file](/LICENSE.md) for license text and copyright information.
