const { validate } = require('./lib/validate.js');

const badUserInput = {
  // missing an email or a phone
  roles: [
    // this one is ok
    { name: 'ADMIN', until: '2019-12-05T16:42:40.069Z' },
    { name: 'toolongandlowercase', extraKey: 'aïe' },
  ],
  settings: {
    optinNewsletter: 'should be a boolean',
  },
};

const schema = {
  email: {
    // if allowNull is enabled and the input is null, validators are not called
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  phone: {
    allowNull: true,
  },
  settings: {
    type: 'object',
    schema: {
      optinNewsletter: {
        type: 'string',
        validate: {
          isBoolean: true,
        },
      },
    },
  },
  roles: {
    type: 'array',
    schema: {
      $: {
        validate: {
          allowedKeys: ['name', 'until'],
        },
      },
      name: {
        type: 'string',
        validate: {
          len: [3, 50],
          matches: '^[A-Z]+$',
        },
      },
      until: {
        allowNull: true,
        validate: {
          isDate: true,
        },
      },
    },
  },
  $: {
    validate: {
      // custom predicate, name it the way you want (here "oneOf")
      // and it will be called with the value of the input
      // at the path corresponding to the key
      // (here $ corresponds to the whole object)
      oneOf: ({ email, phone }) => email || phone,
      // disallow extra keys
      allowedKeys: ['email', 'phone', 'settings', 'roles'],
    },
  },
};

try {
  validate(badUserInput, schema);
} catch (e) {
  // e is an instance of ValidationErrors
  e.errors.forEach((err) => { // instance of ValidationErrorItem
    const {
      path, value, message, validatorName, validatorArgs,
    } = err;
    console.log({
      path, value, message, validatorName, validatorArgs,
    });
  });
}
