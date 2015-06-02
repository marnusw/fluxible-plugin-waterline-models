/**
 * Copyright 2015, Marnus Weststrate
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file for terms.
 */
'use strict';
var _ = require('lodash');
var Waterline = require('waterline');
var buildOrm = require('./build-orm');


/**
 * Creates a new Waterline Models Plugin instance by providing an array of hash of adapters to use on the client.
 * It is important that these adapters be required statically when building this collection so the adapters may be
 * included in the JS bundle sent to the client.
 *
 * Adapters for use on the server may be provided here if the ORM will be built via this plugin.
 *
 * @param clientAdapters {Object|Array} An array of adapters for use on the client or an object indexed by identity.
 * @param [serverAdapters] {Object|Array} An array of adapters for use on the server or an object indexed by identity.
 * @returns {{name: string, plugContext: Function, addModelDefs: Function, dehydrate: Function, rehydrate: Function}}
 */
module.exports = function waterlineModelsPlugin(clientAdapters, serverAdapters) {

  var options = {
    connections: {},
    modelDefs: {}
  };

  // Instantiate a new ORM in memory.
  var waterline = new Waterline();

  var waterlineCollections = {};
  var initialized;

  /**
   * @class WaterlineModelsPlugin
   */
  return {
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
            return waterlineCollections[identity]._model;
          };
        }
      };
    },

    /**
     * Add connection configuration options for the connections used in the model definitions. Subsequent
     * calls with the same connection keys will overwrite configurations on previous calls.
     *
     * @param connections {Object} A hash of connection configurations indexed by connection identity.
     */
    addConnections: function(connections) {
      if (!initialized) {
        _.assign(options.connections, connections);
      }
      return this;
    },
    /**
     * Register model definitions with the ORM. This is only allowed before the ORM is initialised.
     * See the [Waterline ORM documentation](https://github.com/balderdashy/waterline-docs) for more
     * info on model definition syntax.
     *
     * @param modelDefs {Array|Object} An array or hash of model definition objects.
     */
    addModelDefs: function(modelDefs) {
      if (!initialized) {
        _.each(modelDefs, function(modelDef) {
          options.modelDefs[modelDef.identity] = modelDef;
        });
      }
      return this;
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
     * @param models {Array|Object} An array or object containing initialised Waterline Collections.
     */
    setOrmModels: function(models) {
      _.each(models, function(model) {
        waterlineCollections[model.globalId] = waterlineCollections[model.identity] = model;
      });
      initialized = true;
    },
    /**
     * If the Waterline ORM is initialised elsewhere the initialised Waterline Collections can be set on the
     * context without building a new ORM instance. This method may be called multiple times which will merge
     * the provided models with those of previous calls.
     *
     * Once the ORM is built it will be marked as initialised and no further model definitions or
     * connection configurations may be added until a call to `tearDownOrm`.
     *
     * @param cb {Function} A Node.js style callback to signal the end of the async ORM building process.
     * @param adapters {Object} Adapters to use when building the ORM. If not provided the `serverAdapters`
     *  provided to the plugin constructor will be used.
     */
    buildOrm: function(cb, adapters) {
      var self = this;
      buildOrm(waterline, adapters || serverAdapters, options, function(err, ormModels) {
        if (err) {
          return cb(err);
        }
        self.setOrmModels(ormModels);
        cb(err, ormModels);
      });
    },

    /**
     * Closes all open connection and destroys the ORM and collection instances.
     */
    tearDownOrm: function(cb) {
      waterlineCollections = {};
      initialized = false;

      waterline.teardown(cb);
    },

    /**
     * Dehydrate the connection and model definition settings to send them to the client.
     */
    dehydrate: function() {
      return options;
    },
    /**
     * Set the options to the provided state and then build the ORM since we are now on the client.
     * @param state {Object}
     */
    rehydrate: function(state, cb) {
      options = state;
      this.buildOrm(cb, clientAdapters);
    }
  };
};
