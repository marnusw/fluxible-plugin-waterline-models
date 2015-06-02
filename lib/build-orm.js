/**
 * Copied and modified from the Sails.js project which is released under the MIT license.
 * For more info see the [Sails.js repo](https://github.com/balderdashy/sails).
 */
'use strict';
var _ = require('lodash');
var Waterline = require('waterline');


/**
 *
 */
module.exports = function buildORM(waterline, adapters, options, cb) {

  var connections = options.connections;
  var modelDefs = options.modelDefs;

  if (_.isArray(adapters)) {
    var obj = {};
    _.each(adapters, function(adapter) {
      obj[adapter.identity] = adapter;
    });
    adapters = obj;
  }

  // Create a Waterline Collection for each model and register it with the ORM.
  _.each(modelDefs, function loadModelsIntoWaterline(modelDef) {
    waterline.loadCollection(Waterline.Collection.extend(modelDef));
  });

  // -> "Initialize" ORM
  //    : This performs tasks like managing the schema across associations,
  //    : hooking up models to their connections, and auto-migrations.
  waterline.initialize({
      adapters: adapters,
      connections: connections
    },
    function then(err, orm) {
      if (err) {
        return cb(err);
      }

      var modelInstances = {};

      _.each(orm.collections || [], function eachInstantiatedModel(thisModel, modelID) {

        // Bind context for models
        // (this (breaks?)allows usage with tools like `async`)
        _.bindAll(thisModel);

        // Derive information about this model's associations from its schema
        // and attach/expose the metadata as `SomeModel.associations` (an array)
        thisModel.associations = _.reduce(thisModel.attributes, function(associatedWith, attrDef, attrName) {
          if (typeof attrDef === 'object' && (attrDef.model || attrDef.collection)) {
            var assoc = {
              alias: attrName,
              type: attrDef.model ? 'model' : 'collection'
            };
            if (attrDef.model) {
              assoc.model = attrDef.model;
            }
            if (attrDef.collection) {
              assoc.collection = attrDef.collection;
            }
            if (attrDef.via) {
              assoc.via = attrDef.via;
            }

            associatedWith.push(assoc);
          }
          return associatedWith;
        }, []);

        /**
         * Merge previously serialized data back into the ORM as models, i.e. add all the instance methods.
         *
         * @param {Object} data An object with id keys and record data values.
         * @returns {Object} The transformed object containing merge models.
         */
        thisModel.mergeData = function(data) {
          Object.keys(data).forEach(function(id) {
            data[id] = new thisModel._model(data[id]);
          });
          return data;
        };

        // Set `context.models.*` reference to the instantiated Collection
        modelInstances[thisModel.globalId] = modelInstances[modelID] = thisModel;
      });

      // Success
      cb(null, modelInstances);
    });
};
