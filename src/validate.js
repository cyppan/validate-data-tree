const assert = require('assert');
const { Set, getIn } = require('immutable');
const { validator } = require('./validator-extras');

class ValidationErrorItem extends Error {
  constructor(message, type, path, value, inst, validatorKey, fnName, fnArgs) {
    super(message);
    this.message = message || '';
    this.type = null;
    this.path = path || null;
    this.value = value !== undefined ? value : null;
    this.origin = null;
    this.instance = inst || null;
    this.validatorKey = validatorKey || null;
    this.validatorName = fnName || null;
    this.validatorArgs = fnArgs || [];
  }
}

class ValidationErrors extends Error {
  constructor(errors) {
    super();
    this.name = 'ValidationErrors';
    this.errors = errors;
  }
}

const allowedKeys = (o, ...keys) => {
  const extraKeys = Set(Object.keys(o)).subtract(keys);
  return extraKeys.size === 0;
};

const size = (o, min, max) => Array.isArray(o)
  && o.length >= min
  && (!max || o.length <= max);

const isString = o => typeof o === 'string';

const extraValidators = {
  allowedKeys,
  size,
  isString,
};

/**
 * Given an array of validator functions,
 * return a single composed one returning when the first has failed
 */
const composeValidators = ([v1, v2, ...vs]) => {
  if (!v1) return () => true;
  if (!v2) return v1;
  const v = (o) => {
    const r1 = v1(o);
    return (r1 instanceof ValidationErrorItem) ? r1 : v2(o);
  };
  return composeValidators([v, ...vs]);
};

/**
 * Given an object definition of validators like `{isEmail: true, len: [1, 50]}`
 * return an array of validator functions
 * (to be composed then with composeValidators)
 */
const schemaToValidators = (field, schema) => Object.keys(schema).map((k) => {
  const isStringValidator = validator[k];
  const isCustom = !validator[k] && !extraValidators[k];
  const predicate = validator[k] || extraValidators[k] || schema[k];
  const validatorArgs = ((isCustom || schema[k] === true) && [])
    || (Array.isArray(schema[k]) && schema[k])
    || [schema[k]];
  const sanitize = o => (!isStringValidator ? o : ((o && String(o)) || ''));
  return o => (predicate.apply(validator, [sanitize(o), ...validatorArgs])
    || new ValidationErrorItem(
      `Validation ${k} on ${field} failed`,
      'Validation error',
      field,
      sanitize(o),
      null,
      k,
      k,
      validatorArgs,
    ));
});

/**
 * "username" => ["username"]
 * "settings.notifyMe" => ["settings", "notifyMe"]
 * "roles.[].name" => ["roles", [], "name"]
 */
const mapKeyToPath = key => key.split('.').map(k => ((k === '[]' || k === '$') ? [] : k));

/**
 * The opposite
 * if removeArray is specified, filter the [] parts
 * used when formatting path on object error path because
 * it already contains the array indice (ex: roles.0)
 */
const mapPathToKey = (path, removeArrays) => path.map(p => (
  (Array.isArray(p) && p.length === 0)
    ? ((path.length === 1 && '$') || '[]')
    : p
)).filter(p => !(removeArrays && p === '[]')).join('.');

const flattenSchema = (schema, prefix = []) => {
  let flat = {};
  Object.entries(schema).forEach(([field, fieldSchema]) => {
    const path = [
      ...prefix,
      ...((field === '$' && prefix.length) ? [] : [field]),
    ];
    if (['object', 'array'].includes(fieldSchema.type) && fieldSchema.schema) {
      flat = {
        ...flat,
        ...flattenSchema(
          fieldSchema.schema,
          [...path, ...(fieldSchema.type === 'object' ? [] : [[]])],
        ),
      };
    }
    if (fieldSchema.validate) {
      flat[mapPathToKey(path)] = fieldSchema;
    }
  });
  return flat;
};

/**
 * The internal validate function, it takes the object to validate,
 * a **flat** schema and run validations against it.
 * If the object contains arrays at any level and corresponding schema definitions
 * it will run those schemas against each array element and aggregate errors.
 * See the examples to have a better idea on how to use.
 * Use the public validate function below
 */
const validateFn = (obj, schema, prefix = []) => {
  const [fieldsSchemas, fieldSchemasToRecur] = [[], []];
  Object.entries(schema).forEach(([key, fieldSchema]) => {
    const path = mapKeyToPath(key);
    if (path.find(
      el => Array.isArray(el) && el.length === 0 && path.length > 1,
    )
    ) {
      fieldSchemasToRecur.push([path, fieldSchema]);
    } else {
      fieldsSchemas.push([path, fieldSchema]);
    }
  });
  let errs = [];
  fieldsSchemas.forEach(([path, fieldSchema]) => {
    const fieldvalidator = fieldSchema.validate
      ? composeValidators(
        schemaToValidators(
          mapPathToKey([...prefix, ...path], true),
          fieldSchema.validate,
        ),
      )
      : () => true;

    const value = (Array.isArray(path[0]) && path[0].length === 0) ? obj : getIn(obj, path);
    let result;
    if (!fieldSchema.allowNull && value == null) {
      result = new ValidationErrorItem(
        `Validation required on ${path} failed`,
        'Validation error',
        path,
        value,
        null,
        'required',
        'required',
        null,
      );
    } else {
      result = (fieldSchema.allowNull && value == null) || fieldvalidator(value);
    }
    if (result instanceof ValidationErrorItem) {
      errs = [...errs, result];
    }
  });
  fieldSchemasToRecur.forEach(([path, fieldSchema]) => {
    const arrIndex = path.findIndex(el => Array.isArray(el) && el.length === 0);
    const pathBeforeArr = path.slice(0, arrIndex);
    const pathAfterArr = path.slice(arrIndex + 1);
    const arr = getIn(obj, pathBeforeArr);
    if (arr && arr.length) {
      arr.forEach((el, i) => {
        const arrErrs = validateFn(
          el,
          { [mapPathToKey(pathAfterArr) || '$']: fieldSchema },
          [...prefix, ...pathBeforeArr, i],
        );
        if (arrErrs.length > 0) {
          errs = [...errs, ...arrErrs];
        }
      });
    }
  });
  return errs;
};

/**
 * The exposed validate function.
 * It takes the object to validate and the schema with optional nested definitions
 * for objects and arrays and returns true of throw a errors map.
 */
const validate = (obj, schema = {}, prefix = []) => {
  assert(
    obj && typeof obj === 'object',
    'object to validate should be an object or an array',
  );
  assert(schema && typeof schema === 'object', 'schema should be valid');
  const errors = validateFn(obj, flattenSchema(schema), prefix);
  if (errors.length) throw new ValidationErrors(errors);
  return true;
};

module.exports = {
  ValidationErrors,
  ValidationErrorItem,
  allowedKeys,
  mapPathToKey,
  mapKeyToPath,
  validate,
};
