"use strict";

const Promise = require("bluebird");
const rp = require("request-promise");
const logger = require("log4js").getLogger();

/**
 * Class for accessing the EnvApi Service.
 */
class EnvApiClient {

	/**
	 * Requires the apiUrl and apiToken to be set included as parameters.
	 * @param  {[type]} options
	 */
	constructor(options) {
		if (!options.apiUrl || !options.apiToken) {
			throw new Error("Both apiToken and apiUrl are required configuration values.")
		}
		this.apiUrl = options.apiUrl;
		this.apiToken = options.apiToken;
		this.timeout = (options.timeout || 15000);
		this.k8sBranch = ( (options.k8sBranch === true) || false);
		this.request = rp;
	}

	/**
	 * The annotation name to look for
	 */
	static get annotationServiceName() {
		return "kit-deploymentizer/env-api-service";
	}

	static get annotationBranchName() {
		return "kit-deploymentizer/env-api-branch";
	}
	/**
	 * The provided service resource needs to contain an annotation specifiying the service name
	 * to use when invoking the env-api service. If this annotation is not present the request
	 * is skipped. The annotation is `kit-deploymentizer/env-api-service: [GIT-HUB-PROJECT-NAME]`
	 *
	 * Another, optional, annotation sets the branch to use by the env-api service. This annotation
	 * is `kit-deploymentizer/env-api-branch: [GIT-HUB-BRANCH-NAME]`
	 *
	 * Expects JSON results in the format of:
	 * {
	 *   env: {
	 *   		ENV_NAME_ONE: ENV_VALUE_ONE,
	 *   		ENV_NAME_TWO: ENV_VALUE_TWO,
	 *   		...
	 *   },
	 *   k8s: {
	 *     other: value,
	 *     ...
	 *   }
	 * }
	 *
	 * @param  {[type]} service     Resource to get envs for  -- checks for correct annotation
	 * @param  {[type]} cluster     the service is running in
	 * @return {[type]}             envs and configuration information
	 */
	fetch( service, cluster ) {
		return Promise.coroutine(function* () {
			if (!service.annotations || !service.annotations[EnvApiClient.annotationServiceName]) {
				logger.warn(`No env-api-service annotation found for ${service.name}`);
				return;
			}
			const uri = `${this.apiUrl}/${service.annotations[EnvApiClient.annotationServiceName]}`;
			let query = { env: cluster };
			// if a branch is specified pass that along
			if (service.annotations || service.annotations[EnvApiClient.annotationBranchName]) {
				query.branch = service.annotations[EnvApiClient.annotationBranchName]
			}
			let options = {
				uri: uri,
				qs: query,
				headers: { 'X-Auth-Token': this.apiToken },
				json: true,
				timeout: this.timeout
			};
			let config = yield this.request(options);
			let result = {};
			result = this.convertK8sResult(config, result);
			if (this.k8sBranch && result.branch && result.branch !== query.branch) {
				logger.debug(`Pulling envs from ${result.branch} branch`);
				options.qs.branch = result.branch;
				config = yield this.request(options);
			}
			result = this.convertEnvResult(config, result);
			return result;
		}).bind(this)().catch(function (err) {
			// API call failed...
			logger.fatal(`Unable to fetch or convert ENV Config ${JSON.stringify(err)}`);
			throw err;
		});
	}

	/**
	 * Converts the returned results from the env-api service into the expected format.
	 */
	convertK8sResult(config, result) {
		// move the k8s values to the base object
		if (config.k8s && typeof config.k8s === 'object') {
			let props = config.k8s;
			Object.keys(props).forEach( (key) => {
				result[key] = props[key];
			});
		}
		return result;
	}

	/**
	 * Converts the returned results from the env-api service into the expected format.
	 */
	convertEnvResult(config, result) {
		// convert env section to correct format
		result.env = []
		if ( config.env ) {
			Object.keys(config.env).forEach( (key) => {
				result.env.push({
					name: key,
					value: config.env[key]
				});
			});
		}
		return result;
	}

}

module.exports = EnvApiClient;
