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
		this.apiToken = process.env.ENVAPI_ACCESS_TOKEN;
		if (!this.apiToken) {
			throw new Error("The environment variable ENVAPI_ACCESS_TOKEN is required.")
		}
		if (!options.apiUrl) {
			throw new Error("The apiUrl is a required configuration value.")
		}
		this.apiUrl = options.apiUrl;
		this.apiToken = options.apiToken;
		this.timeout = (options.timeout || 15000);
		this.defaultBranch = (options.defaultBranch || "master");
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
	 * One call is made to retrieve the k8s values, then another is made for env values. If a branch
	 * is defined in the k8s values that branch is used for the request for the env values.
	 *
	 * Example Result for both ENV and k8s request:
	 * ```
	 * {
	 *  "status": "success",
	 *  "message": "fetched 'env.yaml' values for 'testing-cluster' env on 'env-test' branch",
	 *  "values": {
	 *    "GET_HOSTS_FROM": "dns",
	 *    "NAME": "Rosie",
	 *    "PORT": "80",
	 *    "TEAM": "Engineering",
	 *    "TEST": "NOV 11, 12:55PM"
	 *  }
	 * }
	 * ```
	 * All results (including errors) contain status and message values.
	 * Error Results Status Codes:
	 * 	cluster-not-found: 500
	 *  file not found: 404
	 *  secret value: 500
	 *
	 *
	 * @param  {[type]} service     Resource to get envs for  -- checks for correct annotation
	 * @param  {[type]} cluster     the service is running in
	 * @return {[type]}             envs and configuration information
	 */
	fetch( service, cluster ) {
		const _self = this;
		return Promise.coroutine(function* () {
			if (!service.annotations || !service.annotations[EnvApiClient.annotationServiceName]) {
				logger.warn(`No env-api-service annotation found for ${service.name}`);
				return;
			}
			if (typeof cluster === "string") {
				throw new Error("Invalid argument for 'cluster', requires cluster object not string.");
			}

			let branch = this.defaultBranch;

			if (service.annotations[EnvApiClient.annotationBranchName]) {
				branch = service.annotations[EnvApiClient.annotationBranchName]
			}
			let k8sResponse = yield this.callService(service, cluster.name(), branch, "k8s");

			let result = {};
			result = this.convertK8sResult(k8sResponse, result);
			// check to see if the
			if (result.branch && result.branch !== branch) {
				branch = result.branch;
			}

			let envResponse = yield this.callService(service, cluster.name(), branch, "env");
			result = this.convertEnvResult(envResponse, result);
			return result;

		}).bind(this)().catch(function (err) {
			logger.fatal(`Error calling env-api for ${service.name} :: ${JSON.stringify(err)}`);
			let errMsg = err.message || err;
			// API call failed, parse returned error message if possible...
			if (err.response && err.response.body && err.response.body.status === "error") {
				errMsg = _self.convertErrorResponse(err.response.body);
			}
			throw new Error(errMsg);
		});
	}

	/**
	 * Checks returned response for error status
	 */
	validateResponse(response) {
		if (response.status && response.status === "error") {
			const errMsg = this.convertErrorResponse(response);
			throw new Error(errMsg);
		}
	}

	/**
	 * Convert the custom error messages into a String
	 */
	convertErrorResponse(response) {
		logger.error(`Error in returned response ${response.message}`);
		let errMsg = response.message || "Received error";
		if (response.errors) {
			let errors = (Array.isArray(response.errors) ? response.errors.join("\n") : response.errors);
			errMsg += `\n ${errors}`;
		}
		return errMsg;
	}

	/**
	 * Fetchs the k8s or env values
	 */
	callService(service, cluster, branch, type) {
		const uri = `${this.apiUrl}/${type}/${service.annotations[EnvApiClient.annotationServiceName]}`;
		let query = { env: cluster, branch: branch };
		let options = {
			uri: uri,
			qs: query,
			headers: { 'X-Auth-Token': this.apiToken },
			json: true,
			timeout: this.timeout
		};
		return this.request(options).then( (data) => {
			this.validateResponse(data);
			return data;
		});
	}

	/**
	 * Converts the returned results from the env-api service into the expected format.
	 */
	convertK8sResult(config, result) {
		if (config.values && typeof config.values === 'object') {
			let props = config.values;
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
		result.env = []
		if ( config.values ) {
			Object.keys(config.values).forEach( (key) => {
				result.env.push({
					name: key,
					value: config.values[key]
				});
			});
		}
		return result;
	}

}

module.exports = EnvApiClient;
