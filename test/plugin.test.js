var assert = require('assert');
var WaterlineModelsPlugin = require('../lib/plugin');

var User = require('./fixtures/User');
var Car = require('./fixtures/Car');


describe('fluxible-plugin-waterline-models', function() {

  ////////////////////////////////////////////////////
  // TEST SETUP
  ////////////////////////////////////////////////////

  var connections;
  var adapters;
  var plugin;

  beforeEach(function(done) {
    plugin = null;
    connections = {inMemoryDb: {adapter: 'sails-memory'}};
    adapters = {'sails-memory': require('sails-memory')};
    done();
  });

  afterEach(function(done) {
    plugin ? plugin.tearDown(done) : done();
  });


  /////////////////////////////////////////////////////
  // TEST METHODS
  ////////////////////////////////////////////////////

  it('should merge server and client configuration with the common options', function(done) {
    // TODO
    done();
  });

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

  it('should allow setting external models and still tear down the plugin', function(done) {
    var user = {
      identity: 'user',
      connection: 'foo',
      attributes: {
        value1: {type: 'string'},
        value2: {type: 'number'}
      }
    };

    plugin = new WaterlineModelsPlugin();
    plugin.setExternalModels({user: user});

    var actionContext = {};
    plugin.plugContext().plugActionContext(actionContext);

    assert.deepEqual(actionContext.models.user, user, 'External models set directly.');
    done();
  });

  it('should dehydrate the client options and initialize with client adapters on rehydration', function(done) {
    // TODO
    done();
  });

});
