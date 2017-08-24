"use strict";

const _ = require("lodash");
const mustache = require("mustache");

/**
 * Contains resource utility methods. Currently supports merging of objects
 * and rendering of templates.
 *
 * Wrap public functions in a class for organization.
 */
class ResourceHandler {
  /**
	 * Handles Merging of JSON Objects. Returns new Object with merged values
	 * @param  {{}} baseObj   Initial Object
	 * @param  {{}} sourceObj Overwrites any duplicate values in the baseObject
	 * @return {{}}           New Object with merged values
	 */
  static merge(baseObj, sourceObj) {
    // Now we have both objects, Merge. The Merge command merges objects into a new Object.
    return _.mergeWith(
      {},
      _.cloneDeep(baseObj),
      sourceObj,
      (objValue, srcValue, key, object, source, stack) => {
        // Handle case where srcValue is null, DO NOT set merged value to null, use ObjValue
        if (srcValue === null) {
          return objValue;
        }
        // Process envs differently - defaults to using lodash merge.
        if (_.isArray(objValue) && key === "env") {
          return ResourceHandler.mergeEnvs(objValue, srcValue);
        }
      }
    );
  }

  /**
	 * Handles Merging of an Array of envs. Returns new Array with merged values
	 * @param  {[type]} objArray Initial array of ENVs
	 * @param  {[type]} srcArray of ENVs - Overwrites any duplicate values in the baseArray
	 * @return {[type]}          new Array with merged values
	 */
  static mergeEnvs(objArray, srcArray) {
    srcArray = srcArray || [];
    // insure objArray is a valid array.
    let baseArray = [];
    if (Array.isArray(objArray)) {
      baseArray = _.cloneDeep(objArray);
    }
    baseArray.forEach(baseNameValue => {
      const index = findIndexOfKeyMatch(srcArray, baseNameValue);
      if (index >= 0) {
        const srcNameValueArray = srcArray.splice(index, 1);
        // there should only ever be one element - ignore for now if more
        // Merge the src into the srcnameValue - srcnameValue is taking precedence
        mergeNameValues(baseNameValue, srcNameValueArray[0]);
      }
    });
    return baseArray.concat(srcArray);
  }

  /**
	 * Renders a template and returns the result. Synchronous operation.
	 * @param  {[type]} template To render
	 * @param  {[type]} view     data use when rendering
	 * @return {[type]}          String  containing the result.
	 */
  static render(template, view) {
    return mustache.render(template, view);
  }

  /**
	 * Encode a given string in the supplied format. defaults to `utf8`
	 * @param  {[type]} strToEncode
	 * @param  {[type]} encoding    type. defaults to utf8
	 * @return {[type]}             the encoded string
	 */
  static encode(strToEncode, encoding) {
    if (!encoding) {
      encoding = "utf8";
    } else if (
      _.indexOf(["utf8", "base64", "binary", "hex", "ascii"], encoding) < 0
    ) {
      throw new Error(`Unsupported Encoding type: ${encoding}`);
    }
    const buffer = new Buffer(strToEncode);
    return buffer.toString(encoding);
  }

  /**
	 * Looks for and loads any ENV values that are marked as external. These
	 * values are encoded as utf8 by default.
	 *
	 * Example:
	 *  - name: EXTERNAL_ENV
	 *    external: true
	 *    encoding: base64
	 *
	 * @param  {[type]} envs [description]
	 * @return {[type]}      [description]
	 */
  static loadExternalEnv(envs) {
    // make sure its an array.
    if (!Array.isArray(envs)) {
      envs = [envs];
    }
    let localEnvArray = _.cloneDeep(envs);
    localEnvArray.forEach(env => {
      if (env.external && env.external === true) {
        let value = process.env[env.name];
        if (!value) {
          throw new Error(
            `env ${env.name} was not available as an external ENV`
          );
        }
        env.value = ResourceHandler.encode(value, env.encoding);
      }
    });
    return localEnvArray;
  }
}

/**
 * Implement our own merge, lo-dash was introducing errors
 * Merges source into base overriding values in base
 * @param  {[type]} base   Base object to merg into
 * @param  {[type]} source Source, has precedence and will overwrite values in base
 * @return {{}}  the modified base object
 */
function mergeNameValues(base, source) {
  if (!base) {
    base = {};
  }
  if (!source) {
    throw new Error("Source cannot be null");
  }
  const srcKeys = Object.keys(source);
  srcKeys.forEach(key => {
    base[key] = source[key];
  });
  return base;
}

/**
 * Returns the index of the found item
 * @param  {[type]} objArray Array to search
 * @param  {[type]} nameValue nameValue object to search for, only the 'name' property is used in search
 * @return {[type]}          the index of the found item
 */
function findIndexOfKeyMatch(objArray, nameValue) {
  return objArray.findIndex(obj => {
    // if this obj is not in the format of name:"", value:""
    if (!obj.name) {
      return false;
    }
    return obj.name === nameValue.name;
  });
}

module.exports = ResourceHandler;
