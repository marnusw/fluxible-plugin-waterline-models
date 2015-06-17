/**
 * Copyright 2015, Marnus Weststrate
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file for terms.
 */
var _ = require('lodash');
var Waterline = require('waterline');
var Promise = require('es6-promise').Promise;

var buildOrm = require('./buildOrm');


/**
 * Creates a new `WaterlineModelsPlugin` instance. Configuration options and/or client adapters modules
 * can optionally be provided. It is important that these adapters be required statically and included
 * in the JS bundle sent to the client.
 *
 * @param {{modelDefaults: Object, models: Object|Array, connections: Object}} options ORM configuration options.
 * @param {Object|Array} clientAdapters An object/array of adapter modules for use on the client.
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
         * queries or updates on models via the connections/adapters with the various Waterline methods.
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
            if (process.env.NODE_ENV !== "production") {
              if (!waterlineModels[identity]) {
                throw new Error('Attempting to retrieve a constructor for unknown identity: ' + identity);
              }
            }
            return waterlineModels[identity]._model;
          };
        }
      };
    },

    /**
     * Pass ORM configuration options. See the main README.md file for full detail on the possible
     * configuration options, and review the
     * [Waterline ORM documentation](https://github.com/balderdashy/waterline-docs) for info on model
     * definitions.
     *
     * Options passed will be merged with any previous configuration, include that done via the
     * plugin constructor parameters.
     *
     * @param {Object} options
     * @returns {WaterlineModelsPlugin} this
     */
    configure: function(options) {
      if (process.env.NODE_ENV !== "production") {
        if (!_.isEmpty(waterlineModels)) {
          throw new Error('Attempted to configure an initialized ORM.');
        }
      }
      processOptions(options);
      return this;
    },

    /**
     * Initializing the ORM creates a Waterline instance and Waterline Collection instances for the various
     * model definitions which are exposed on `actionContext.models`. The Collection/Model instances are
     * also returned via the Node style callback or returned promise.
     *
     * Before the `rehydrate()` method of the plugin is called the ORM will be initialized using the `server`
     * configuration. After rehydration the `client` configuration will be used; this means all configuration
     * must be completed before rehydrating the application state on the client. If `clientAdapters` were
     * passed to the plugin constructor the ORM is initialized automatically and the method needn't be called,
     * otherwise it should be called in the Fluxible `app.rehydrate()` function callback.
     *
     * All adapters used by the configured connections should be provided.
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
     * Closes all open connections/adapters.
     *
     * @param {Function} cb A Node style cb for the async operation, possibly returning an error.
     */
    tearDown: function(cb) {
      waterline ? waterline.teardown(cb) : cb();
    },

    /**
     * If the Waterline ORM is initialized externally the initialized Waterline Collections can be set on the
     * context without building a new ORM instance. Models are indexed by `identity` and `globalId`, which is
     * the camel cased version, if the `globalId` property is set. This method may be called multiple times,
     * models are merged with any previous models and will overwrite duplicates.
     *
     * @param {Array|Object} models An array or object containing initialized Waterline Collections.
     */
    setExternalModels: function(models) {
      _.each(models, function(model) {
        if (process.env.NODE_ENV !== "production") {
          if (!model.identity) {
            throw new Error('Attempting to set a model without an \'identity\' attribute.');
          }
        }

        waterlineModels[model.identity] = model;
        if (model.globalId) {
          waterlineModels[model.globalId] = model;
        }
      });
    },


    /**
     * Dehydrate the common and client configuration options.
     */
    dehydrate: function() {
      return {
        common: common,
        client: client
      };
    },
    /**
     * The local `common` config is merged with the config from the dehydrated state. The local `client`
     * config is handled similarly. Finally all these options are merged together to obtain the final
     * client config.
     *
     * If client adapters were provided to the constructor the ORM is initialized, otherwise a call
     * to `initialize()` with the client adapters is necessary.
     *
     * @param {Object} state
     * @param {Function} cb A callback, marking the rehydrate operation as async.
     */
    rehydrate: function(state, cb) {
      config = _.merge(state.common, common, state.client, client);
      clientAdapters ? this.initialize(clientAdapters, cb) : cb();
    }
  };

  return WaterlineModelsPlugin;
};
