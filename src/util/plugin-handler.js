"use strict";

const Promise = require("bluebird");
const logger = require("log4js").getLogger();

/**
 * Wraps the supplied plugin.
 */
class PluginHandler {

	/**
	 * Load the plugin defined
	 * @param  {[type]} pluginPath [description]
	 * @return {[type]}            [description]
	 */
	constructor(pluginPath, options) {
		const plugin = require(pluginPath)
		this.configService = new plugin(options);
	}

	/**
	 * Invoke the defined Configuration Service returning the result.
	 *
	 * The Object returned from the plugin must match :
	 *  {
	 * 	 env: [ {name: "ENV_NAME", value: "ENV_VALUE"},{name: "ENV_NAME", value: "ENV_VALUE"}, ...],
	 * 	 branch: "BRANCH-NAME",
	 * 	 ...
	 *  }
	 * other formats can be added later.
	 *
	 * @param  {[type]} service     object to get env values for, should contain the resource service object
	 * @param  {[type]} cluster     that the service will run on
	 * @return {[type]}             A promise fulfilled with the ENV values for the given service/env/cluster
	 */
	fetch( service, cluster ) {
		// Convert to a Bluebird Promise since we dont know what type we will get back.
		return Promise.resolve(
				this.configService.fetch( service, cluster )
			).catch( (err) => {
				logger.error(`Configuration could not be loaded for ${service.name} for cluster ${cluster}.`);
				throw err;
			});
	}
}

module.exports = PluginHandler;
