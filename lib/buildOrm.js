/**
 * Adapted from the Sails.js released under the MIT license. For more info see
 * the [Sails.js repo](https://github.com/balderdashy/sails).
 */
var _ = require('lodash');
var Waterline = require('waterline');


/**
 * Initialize a provided Waterline instance with the provided adapters and connections and add
 * all model definitions to the ORM as as Waterline Collections.
 *
 * @param {Object} waterline A new Waterline instance to configure.
 * @param {{modelDefaults: Object, models: Object|Array, connections: Object}} config Configuration options.
 * @param {Object|Array} adapters A collection of adapters loaded from npm modules.
 * @param {Function} cb `function(err, models) {...}` Returns the initialized models Node-style.
 */
module.exports = function buildOrm(waterline, config, adapters, cb) {

  // Create a Waterline Collection for each model and register it with the ORM.
  _.each(config.models, function loadModelsIntoWaterline(modelDef) {
    waterline.loadCollection(Waterline.Collection.extend(_.merge({}, config.modelDefaults, modelDef)));
  });

  var ormOptions = {
    adapters: ensureIdentityObject(adapters),
    connections: config.connections
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
};


/**
 * Ensure an unknown object or array is an object indexed by the item `identity`.
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
