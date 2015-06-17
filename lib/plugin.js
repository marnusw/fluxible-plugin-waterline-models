/**
 * Copyright 2015, Marnus Weststrate
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file for terms.
 */
'use strict';
var _ = require('lodash');
var Waterline = require('waterline');
var Promise = require('es6-promise').Promise;

var buildOrm = require('./buildOrm');


/**
 * Creates a new Waterline Models Plugin instance by providing an array of hash of adapters to use on the client.
 * It is important that these adapters be required statically when building this collection so the adapters may be
 * included in the JS bundle sent to the client.
 *
 * Adapters for use on the client may be provided here.
 *
 * @param {Object} options ORM configuration options. See the main README.md for details.
 * @param {Object|Array} clientAdapters An array of adapters for use on the client or an object indexed by identity.
 * @returns {Object} The plugin instance.
 */
module.exports = function waterlineModelsPlugin(options, clientAdapters) {

  /**
   * The current final configuration to use when initializing the ORM.
   * @type {{modelDefaults: Object, models: Object|Array, connections: Object}}
   */
  var config = {};

  var common = {};
  var server = {};
  var client = {};

  // ORM

  var waterlineModels = {};
  var waterline;

  // Handle constructor options

  if (options) {
    if (!clientAdapters && !options.common && !options.server && !options.client) {
      clientAdapters = options;
    } else {
      processOptions(options);
    }
  }

  /**
   * A handler for processing a combined options object.
   *
   * @param {Object} options
   */
  function processOptions(options) {
    _.merge(common, options.common);
    _.merge(server, options.server);
    _.merge(client, options.client);

    config = _.merge({}, common, server);
  }

  /**
   * @class WaterlineModelsPlugin
   */
  var WaterlineModelsPlugin = {
    name: 'WaterlineModelsPlugin',
    /**
     * Called to plug the FluxContext.
     * @method plugContext
     * @returns {Object}
     */
    plugContext: function() {
      return {
        /**
         * Provides the `models` dictionary on the action context. This can be used to initiate async
         * updates to models on the server.
         *
         * @param {Object} actionContext
         */
        plugActionContext: function(actionContext) {
          actionContext.models = waterlineModels;
        },
        /**
         * Adds the `getModelConstructor(identity)` method to the store context which can be used
         * to create a record instance with instance methods from a simple record data object.
         *
         * @param {Object} storeContext
         */
        plugStoreContext: function(storeContext) {
          storeContext.getModelConstructor = function(identity) {
            if (!waterlineModels[identity]) {
              throw new Error('Attempting to retrieve a constructor for unknown identity: ' + identity);
            }
            return waterlineModels[identity]._model;
          };
        }
      };
    },

    /**
     * Register model definitions with the ORM. This is only allowed before the ORM is initialized.
     * See the [Waterline ORM documentation](https://github.com/balderdashy/waterline-docs) for more
     * info on model definition syntax.
     *
     * Add connection configuration options for the connections used in the model definitions. Subsequent
     * calls with the same connection keys will overwrite configurations on previous calls.
     *
     * @param {Object} options
     * @returns {WaterlineModelsPlugin} this
     */
    configure: function(options) {
      if (!_.isEmpty(waterlineModels)) {
        throw new Error('Attempted to configure an initialized ORM.');
      }
      processOptions(options);
      return this;
    },

    /**
     * Once the ORM is built it will be marked as initialized and no further model definitions or
     * connection configurations may be added until a call to `tearDownOrm`.
     *
     * @param {Object} adapters Adapters used to initialize the ORM.
     * @param {Function} [cb] Optional Node style callback receiving initialized models: `function(err, ormModels) {}`
     * @returns {Promise} Resolving to the initialized models.
     */
    initialize: function(adapters, cb) {
      var promise = new Promise(function(resolve, reject) {
        waterline = new Waterline();
        buildOrm(waterline, config, adapters, function(err, ormModels) {
          if (err) {
            return reject(err);
          }
          WaterlineModelsPlugin.setExternalModels(ormModels);
          resolve(ormModels);
        });
      });

      if (cb) {
        promise.then(function(ormModels) {
          cb(null, ormModels);
        }, function(err) {
          cb(err);
        });
      }

      return promise;
    },
    /**
     * Closes all open connection and destroys the ORM and collection instances.
     *
     * @param {Function} cb A Node style cb possibly returning an error.
     */
    tearDown: function(cb) {
      waterline ? waterline.teardown(cb) : cb();
    },

    /**
     * If the Waterline ORM is initialized elsewhere the initialized Waterline Collections can be set on the
     * context without building a new ORM instance. Models are indexed by `identity` and `globalId` which is
     * the camel cased version. This method may be called multiple times which will merge the provided
     * models with those of previous calls.
     *
     * Once models have been provided the ORM is marked as initialized and no further model definitions or
     * connection configurations may be added until a call to `tearDownOrm`.
     *
     * @param {Array|Object} models An array or object containing initialized Waterline Collections.
     */
    setExternalModels: function(models) {
      _.each(models, function(model) {
        if (!model.identity) {
          throw new Error('Attempting to set a model without an \'identity\' attribute.');
        }

        waterlineModels[model.identity] = model;
        if (model.globalId) {
          waterlineModels[model.globalId] = model;
        }
      });
    },


    /**
     * Dehydrate the connection and model definition settings to send them to the client.
     */
    dehydrate: function() {
      return {client: _.merge({}, common, client)};
    },
    /**
     * Retrieve the client configuration and if set use it to initialize a new ORM with the client adapters.
     *
     * @param {Object} state
     * @param {Function} cb A callback, marking the rehydrate operation as async.
     */
    rehydrate: function(state, cb) {
      if (!_.isEmpty(state.client)) {
        config = state.client;
        if (clientAdapters) {
          this.initialize(clientAdapters, cb);
        }
      }
    }
  };

  return WaterlineModelsPlugin;
};
