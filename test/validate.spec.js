const assert = require('assert');
const { List } = require('immutable');
const { validate } = require('../src/validate');

const schema = {
  username: {
    allowNull: false,
    validate: {
      isString: true,
      is: ['^[a-zA-Z0-9]+$', 'i'],
      len: [5, 50],
    },
  },
  random: {
    allowNull: true,
  },
  email: {
    allowNull: false,
    validate: {
      isString: true,
      isEmail: true,
    },
  },
  roles: {
    type: 'array',
    allowNull: true,
    validate: {
      size: [1, 9999],
    },
    schema: {
      $: {
        validate: {
          isString: true
        }
      }
    }
  },
};

const nestedSchema = {
  settings: {
    type: 'object',
    schema: {
      locale: {
        validate: {
          isString: true,
          equals: 'fr',
        },
      },
    },
  },
};

const nestedArraySchema = {
  roles: {
    type: 'array',
    schema: {
      name: {
        validate: {
          len: [3, 10],
          matches: ['^[A-Z]+$'],
        },
      },
      until: {
        allowNull: true,
        validate: {
          isDate: true,
        },
      },
      $: {
        validate: {
          allowedKeys: ['name', 'until'],
        },
      },
    },
  },
};

describe('validate', () => {
  it('should throw if object or schema is nullsy', () => {
    assert.throws(
      () => {
        assert.equal(validate(null, {}), true);
      }, {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'object to validate should be an object or an array',
      },
    );
    assert.throws(
      () => {
        assert.equal(validate({}, null), true);
      }, {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'schema should be valid',
      },
    );
  });

  it('should pass if schema and/or data are empty objects', () => {
    assert.equal(validate({}, {}), true);
  });

  it('should fail for invalid object', () => {
    assert.throws(
      () => validate({}, schema), (errs) => {
        assert.equal(errs.errors.length, 2);
        assert.equal(errs.errors[0].path, 'username');
        assert.equal(errs.errors[0].validatorName, 'required');
        assert.equal(errs.errors[1].path, 'email');
        assert.equal(errs.errors[1].validatorName, 'required');
        return true;
      },
    );
    assert.throws(
      () => validate({ username: 'c', email: 'cyppan@email.com' }, schema), (errs) => {
        assert.equal(errs.errors.length, 1);
        assert.equal(errs.errors[0].path, 'username');
        assert.equal(errs.errors[0].validatorName, 'len');
        return true;
      },
    );
    assert.throws(
      () => validate({
         username: 'cyppan',
         email: 'cyppan@email.com',
         roles: [1],
      }, schema), (errs) => {
        assert.equal(errs.errors.length, 1);
        assert.equal(errs.errors[0].path, 'roles.0');
        assert.equal(errs.errors[0].validatorName, 'isString');
        return true;
      },
    );
  });

  it('should pass for valid object', () => {
    assert.equal(validate({
      username: 'cyppan',
      email: 'cyppan@email.com',
      roles: ["ADMIN"],
    }, schema), true);
  });

  it('should fail for invalid nested', () => {
    assert.throws(
      () => validate({ settings: { locale: 'en' } }, nestedSchema), (errs) => {
        assert.equal(errs.errors.length, 1);
        assert.equal(errs.errors[0].path, 'settings.locale');
        assert.equal(errs.errors[0].validatorName, 'equals');
        return true;
      },
    );
  });

  it('should fail for invalid array of scalars', () => {
    assert.throws(
      () => validate(
        { roles: [] },
        { roles: schema.roles },
      ), (errs) => {
        assert.equal(errs.errors.length, 1);
        assert.equal(errs.errors[0].path, 'roles');
        assert.equal(errs.errors[0].validatorName, 'size');
        assert(List(errs.errors[0].validatorArgs).equals(List([1, 9999])));
        return true;
      },
    );
  });

  it('should pass for valid array of scalars', () => {
    assert.equal(validate(
      { roles: ['ADMIN'] },
      { roles: schema.roles },
    ), true);
  });

  it('should fail for invalid array of objects', () => {
    assert.throws(
      () => validate(
        {
          roles: [
            { name: 'ADMIN' },
            { name: 'lowercaseandtoolong', extra: 'unallowed' },
          ],
        },
        nestedArraySchema,
      ), (errs) => {
        assert.equal(errs.errors.length, 2);
        assert.equal(errs.errors[0].path, 'roles.1.name');
        assert.equal(errs.errors[0].validatorName, 'len');
        assert.equal(errs.errors[1].path, 'roles.1');
        assert.equal(errs.errors[1].validatorName, 'allowedKeys');
        return true;
      },
    );
  });

  it('should pass for valid array of objects', () => {
    assert.equal(validate(
      { roles: [{ name: 'ADMIN' }] },
      nestedArraySchema,
    ), true);
  });
});
