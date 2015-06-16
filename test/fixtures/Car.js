module.exports = {

  identity: 'car',

  connection: 'inMemoryDb',

  attributes: {
    make: {
      type: 'string',
      required: true
    },

    model: {
      type: 'string'
    },

    year: {
      type: 'string'
    }
  }
};
