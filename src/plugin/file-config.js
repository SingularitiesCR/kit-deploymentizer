"use strict";

const fse = require("fs-extra");
const path = require("path");
const Promise = require("bluebird");

const readFilePromise = Promise.promisify(fse.readFile);

class FileConfig {
  constructor(options) {
    if (!options.configPath) {
      throw new Error("configPath is a required configuration value.");
    }
    this.configPath = options.configPath;
  }

  /**
	 * Example path for loading env configuration files:
	 *   /auth/cluster-env.yaml
	 *
	 * Requires a env called CONFIGURATION_PATH set with the base path to load
	 * the env files from.
	 *
	 * @param  {[type]} service     resource object (must have at least { service.name } property)
	 * @param  {[type]} cluster     name of cluster
	 * @return {[type]}             ENV values
	 */
  fetch(service, cluster) {
    return Promise.coroutine(function*() {
      if (!service.name || !cluster) {
        throw new Error("Missing argument, all values are required.");
      }

      let file = path.join(
        this.configPath,
        service.name,
        `${cluster.name()}-env.json`
      );
      const data = yield readFilePromise(file, "utf8");
      let config = JSON.parse(data);
      return config;
    }).bind(this)();
  }
}

module.exports = FileConfig;
