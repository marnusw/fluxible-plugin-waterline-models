/**
 * Copyright 2015, Marnus Weststrate
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file for terms.
 */
'use strict';
var _ = require('lodash');
var Promise = require('es6-promise').Promise;

var orm = require('./orm');


/**
 * Creates a new Waterline Models Plugin instance by providing an array of hash of adapters to use on the client.
 * It is important that these adapters be required statically when building this collection so the adapters may be
 * included in the JS bundle sent to the client.
 *
 * Adapters for use on the server may be provided here if the ORM will be built via this plugin.
 *
 * @param {Object|Array} clientAdapters An array of adapters for use on the client or an object indexed by identity.
 * @param {Object|Array} [serverAdapters] An array of adapters for use on the server or an object indexed by identity.
 * @returns {Object} The plugin instance.
 */
module.exports = function waterlineModelsPlugin(clientAdapters, serverAdapters) {

  var _connections = {};
  var _modelDefs = {};

  var waterlineCollections = {};
  var initialized;

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
          actionContext.models = waterlineCollections;
        },
        /**
         * Adds the `getModelConstructor(identity)` method to the store context which can be used
         * to create a record instance with instance methods from a simple record data object.
         *
         * @param {Object} storeContext
         */
        plugStoreContext: function(storeContext) {
          storeContext.getModelConstructor = function(identity) {
            if (!waterlineCollections[identity]) {
              throw new Error('Attempting to retrieve a constructor for unknown identity: ' + identity);
            }
            return waterlineCollections[identity]._model;
          };
        }
      };
    },

    /**
     * Register model definitions with the ORM. This is only allowed before the ORM is initialised.
     * See the [Waterline ORM documentation](https://github.com/balderdashy/waterline-docs) for more
     * info on model definition syntax.
     *
     * Required properties:
     *
     *  - identity: The key that will be used to retrieve the model from `actionContext.models`.
     *  - connection: The connection to use for this model, a key matching one of the added connections.
     *  - attributes: An object specifying the model prototype properties and methods.
     *
     * @param {Array|Object} modelDefs An array or hash of model definition objects.
     */
    addModelDefs: function(modelDefs) {
      if (initialized) {
        throw new Error('Attempted to add model definitions after initializing the ORM.');
      }
      _.each(modelDefs, function(modelDef) {
        _modelDefs[modelDef.identity] = modelDef;
      });
      return this;
    },
    /**
     * Add connection configuration options for the connections used in the model definitions. Subsequent
     * calls with the same connection keys will overwrite configurations on previous calls.
     *
     * @param {Object} connections A hash of connection configurations indexed by connection identity.
     */
    addConnections: function(connections) {
      if (initialized) {
        throw new Error('Attempted to add connections after initializing the ORM.');
      }
      _.assign(_connections, connections);
      return this;
    },

    /**
     * Once the ORM is built it will be marked as initialised and no further model definitions or
     * connection configurations may be added until a call to `tearDownOrm`.
     *
     * @param {Object} [adapters] Adapters to use when building the ORM. If not provided, the `serverAdapters`.
     * @param {Function} [cb] A Node.js style callback to signal the end of the async ORM building process.
     *  provided to the plugin constructor will be used.
     * @returns {Promise} Resolving to the initialised models.
     */
    initialize: function(adapters, cb) {
      if (!adapters || _.isFunction(adapters)) {
        cb = adapters;
        adapters = serverAdapters;
      }

      var promise = new Promise(function(resolve, reject) {
        orm.build(_modelDefs, _connections, adapters, function(err, ormModels) {
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
      if (initialized) {
        waterlineCollections = {};
        initialized = false;
        orm.tearDown(cb);
      }
    },

    /**
     * If the Waterline ORM is initialised elsewhere the initialised Waterline Collections can be set on the
     * context without building a new ORM instance. Models are indexed by `identity` and `globalId` which is
     * the camel cased version. This method may be called multiple times which will merge the provided
     * models with those of previous calls.
     *
     * Once models have been provided the ORM is marked as initialised and no further model definitions or
     * connection configurations may be added until a call to `tearDownOrm`.
     *
     * @param {Array|Object} models An array or object containing initialised Waterline Collections.
     */
    setExternalModels: function(models) {
      _.each(models, function(model) {
        waterlineCollections[model.identity] = model;
        if (model.globalId) {
          waterlineCollections[model.globalId] = model;
        }
      });
      initialized = true;
    },

    /**
     * Dehydrate the connection and model definition settings to send them to the client.
     */
    dehydrate: function() {
      return {
        connections: _connections,
        modelDefs: _modelDefs
      };
    },
    /**
     * Retrieve the connection and model definition settings and then build a new ORM with
     * the client adapters.
     *
     * @param state {Object}
     */
    rehydrate: function(state, cb) {
      _connections = state.connections;
      _modelDefs = state.modelDefs;
      this.initialize(clientAdapters, cb);
    }
  };

  return WaterlineModelsPlugin;
};
