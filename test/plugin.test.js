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

  beforeEach(function(done) {
    plugin = null;
    done();
  });

  afterEach(function(done) {
    plugin ? plugin.tearDown(done) : done();
  });


  /////////////////////////////////////////////////////
  // TEST METHODS
  ////////////////////////////////////////////////////

  it('should initialize the ORM and respond with a promise resolving to the models', function(done) {
    plugin = new WaterlineModelsPlugin({
      common: {
        models: [User, Car]
      },
      server: {
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
          return done(err);
        }

        assert(models, 'Respond with models');
        assert(models.user, 'Created the User model');

        var plug = plugin.plugContext();
        var actionContext = {};
        var storeContext = {};

        plug.plugActionContext(actionContext);
        plug.plugStoreContext(storeContext);

        assert.equal(actionContext.models, models, 'Models are available on the action context');

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
    plugin = new WaterlineModelsPlugin(adapters);
    plugin.configure({
      common: {
        models: [User, Car]
      },
      client: {
        connections: connections
      },
      server: {
        connections: {foo: {}} // Will break if used.
      }
    });

    var state = plugin.dehydrate();

    assert.equal(state.common.models.length, 2, 'Common config dehydrated');
    assert.deepEqual(state.client.connections, connections, 'Client config dehydrated');
    assert(!state.client.models, 'Unmerged client config');

    plugin.rehydrate(state, function(err) {
      if (err) {
        return done(err);
      }

      var actionContext = {};
      plugin.plugContext().plugActionContext(actionContext);

      assert(actionContext.models.user, 'Models were initialized');
      assert(actionContext.models.User, 'Models were initialized');
      assert(actionContext.models.car, 'Models were initialized');

      // If the above is successful common and client configs were merged properly.

      done();
    });
  });

  it('should allow client configuration before rehydration and manual initialization with adapters', function(done) {

    plugin = new WaterlineModelsPlugin({
      common: {
        models: [User, Car]
      },
      client: {
        connections: {inMemoryDb: {}} // Will break is used, client side config should overrule this.
      }
    });

    var state = plugin.dehydrate();

    // Now we're on the client...

    plugin.configure({
      client: {
        connections: connections
      },
      server: {
        connections: {foo: {}} // Will break if used.
      }
    });

    plugin.rehydrate(state, function(err) {
      if (err) {
        return done(err);
      }

      plugin.initialize(adapters, function(err, models) {
        if (err) {
          return done(err);
        }

        assert(models, 'Initialized models');

        var actionContext = {};
        plugin.plugContext().plugActionContext(actionContext);

        // If the user model is present common and client configs were merged properly.
        assert(actionContext.models.user, 'Models were initialized');

        done();
      });
    });
  });

});
