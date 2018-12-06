# Validate data tree

This library aims to validate data structures (input object, possibly with nested objects and arrays), by the mean of data structures (the schema).

Usable in the server and the browser seamlessly (as long as you use a compiler like babel)

## Get started

Because "un exemple vaut mille mots":

```js
const { validate } = require('validate-data-tree')

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

=>
{ path: '$',
  value:
   { roles:
      [ { name: 'ADMIN', until: '2019-12-05T16:42:40.069Z' },
        { name: 'toolongandlowercase', extraKey: 'aïe' } ],
     settings: { optinNewsletter: 'should be a boolean' } },
  message: 'Validation oneOf on $ failed',
  validatorName: 'oneOf',
  validatorArgs: [] }
{ path: 'settings.optinNewsletter',
  value: 'should be a boolean',
  message: 'Validation isBoolean on settings.optinNewsletter failed',
  validatorName: 'isBoolean',
  validatorArgs: [] }
{ path: 'roles.1',
  value: { name: 'toolongandlowercase', extraKey: 'aïe' },
  message: 'Validation allowedKeys on roles.1 failed',
  validatorName: 'allowedKeys',
  validatorArgs: [ 'name', 'until' ] }
{ path: 'roles.1.name',
  value: 'toolongandlowercase',
  message: 'Validation matches on roles.1.name failed',
  validatorName: 'matches',
  validatorArgs: [ '^[A-Z]+$' ] }
```

## Available validators

This library is inspired from the npm packages `validator.js` and the extensions provided by `sequelize` (the DSL is compliant)

Then you can refer to their docs:
- https://www.npmjs.com/package/validator#validators
- https://github.com/sequelize/sequelize/blob/master/lib/utils/validator-extras.js

Added validators:

| validator key | arguments |
| --- | --- |
| allowedKeys | array of keys (ex: `['k1', 'k2']`) |
| size | `[min, optional max]` (ex: `[1, 5]` or `[1]` for unbound maximum size) |
