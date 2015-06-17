var assert = require('assert');
var WaterlineModelsPlugin = require('../lib/plugin');

var User = require('./fixtures/User');
var Car = require('./fixtures/Car');

var connections = {inMemoryDb: {adapter: 'sails-memory'}};
var adapters = {'sails-memory': require('sails-memory')};

describe('fluxible-plugin-waterline-models', function() {

  ////////////////////////////////////////////////////
  // TEST SETUP
  ////////////////////////////////////////////////////

  var plugin;

  afterEach(function(done) {
    plugin.tearDown(done);
  });


  /////////////////////////////////////////////////////
  // TEST METHODS
  ////////////////////////////////////////////////////

  it('should initialize the ORM and respond with a promise resolving to the models', function(done) {
    plugin = new WaterlineModelsPlugin({
      common: {
        models: [User, Car],
        connections: connections
      }
    });
    plugin
      .initialize(adapters)
      .then(function(models) {
        assert(models, 'Respond with models');
        assert(models.user, 'Created the User model');
        assert(models.car, 'Created the Car model');
        assert(typeof models.user.beforeValidate == 'function', 'Maintained static model definition methods');
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should respond via callback if one is provided and plug the action and store contexts', function(done) {
    plugin = new WaterlineModelsPlugin();
    plugin
      .configure({
        common: {
          models: [User, Car],
          connections: connections
        }
      })
      .initialize(adapters, function(err, models) {
        if (err) {
          done(err);
        }
        assert(models, 'Respond with models');
        assert(models.user, 'Created the User model');

        var plug = plugin.plugContext();
        var actionContext = {};
        var storeContext = {};

        plug.plugActionContext(actionContext);
        plug.plugStoreContext(storeContext);

        assert.deepEqual(actionContext.models, models, 'Models are available on the action context');

        var UserConstructor = storeContext.getModelConstructor('user');
        assert(typeof UserConstructor == 'function', 'Model constructors can be retrieved');

        var user = new UserConstructor({
          username: 'marnusw',
          firstName: 'Marnus',
          lastName: 'Weststrate'
        });

        assert.equal(user.username, 'marnusw', 'Data attributes are set');
        assert.equal(user.getFullName(), 'Marnus Weststrate', 'Prototype methods are set');

        done();
      });
  });

});
