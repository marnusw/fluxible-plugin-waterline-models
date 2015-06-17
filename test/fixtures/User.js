module.exports = {

  identity: 'user',
  globalId: 'User',

  connection: 'inMemoryDb',

  attributes: {
    username: {
      type: 'string',
      required: true,
      index: true
    },

    firstName: {
      type: 'string'
    },

    lastName: {
      type: 'string'
    },

    getFullName: function() {
      return this.firstName + ' ' + this.lastName;
    }
  },

  beforeValidate: function(user, next) {
    next();
  }
};
