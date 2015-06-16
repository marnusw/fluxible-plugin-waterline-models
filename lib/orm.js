/**
 * Copied and modified from the Sails.js project which is released under the MIT license.
 * For more info see the [Sails.js repo](https://github.com/balderdashy/sails).
 */
'use strict';
var _ = require('lodash');
var Waterline = require('waterline');

var waterline;

/**
 *
 */
module.exports = {
  /**
   * Create and initialize a new Waterline instance and add all model definitions
   * as collections on the ORM, for use with the provided adapters and connections.
   *
   * @param {Object|Array} modelDefs A collection of model definition object.
   * @param {Object} connections An object with connection configurations.
   * @param {Object|Array} adapters A collection of adapters loaded from npm modules.
   * @param {Function} cb `function(err, models) {...}`
   */
  build: function(modelDefs, connections, adapters, cb) {

    waterline = new Waterline();

    // Create a Waterline Collection for each model and register it with the ORM.
    _.each(modelDefs, function loadModelsIntoWaterline(modelDef) {
      waterline.loadCollection(Waterline.Collection.extend(modelDef));
    });

    var ormOptions = {
      adapters: ensureIdentityObject(adapters),
      connections: connections
    };

    // Initialize ORM: Create an initialized version of each Collection and auto-migrate
    // depending on the Collection configuration.
    // Resulting `orm` is {collections: {Object}, connections: {Object}}
    waterline.initialize(ormOptions, function(err, orm) {
      if (err) {
        return cb(err);
      }

      // Derive information about a model's association from the provided attributes as an array.
      // This is done by Sails.js, so while the need is not immediately apparent it may be that
      // some applications will depend on this.
      _.each(orm.collections, function(model) {
        model.associations = makeAssociationInfo(model.attributes);
      });

      cb(null, orm.collections);
    });
  },

  /**
   * Tear down all adapters and the Waterline instance itself.
   *
   * @param {Function} cb A Node type callback providing a possible error.
   */
  tearDown: function(cb) {
    waterline.teardown(cb);
  }
};

/**
 * Ensure an unknown object or array is an object indexed by item `identity`.
 *
 * @param {Object|Array} original
 * @returns {Object} An object indexed by the `identity` property of each item in the original object.
 */
function ensureIdentityObject(original) {
  var obj = {};
  _.each(original, function(item) {
    obj[item.identity] = item;
  });
  return obj;
}

/**
 * Derive information about a model's association from the provided attributes as an array.
 *
 * @param {Object} attributes A model's attributes property.
 * @returns {Array} The association info.
 */
function makeAssociationInfo(attributes) {
  _.reduce(attributes, function(associations, attrDef, attrName) {
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

      associations.push(assoc);
    }
    return associations;
  }, []);
}
