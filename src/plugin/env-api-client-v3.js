"use strict";

const Promise = require("bluebird");
const rp = require("request-promise");
const logger = require("log4js").getLogger();

/**
 * Class for accessing the EnvApi Service.
 */
class EnvApiClient {
  /**
	 * Requires the apiUrl to be set as parameters. The ENVAPI_ACCESS_TOKEN is required as a ENV var.
	 * @param  {[type]} options
	 */
  constructor(options) {
    this.apiToken = process.env.ENVAPI_ACCESS_TOKEN;
    if (!this.apiToken) {
      throw new Error(
        "The environment variable ENVAPI_ACCESS_TOKEN is required."
      );
    }
    if (!options.apiUrl) {
      throw new Error("The apiUrl is a required configuration value.");
    }
    this.apiUrl = options.apiUrl;
    this.timeout = options.timeout || 15000;
    this.defaultBranch = options.defaultBranch || "master";
    this.request = rp;
    this.supportFallback = false;
    if (
      options.supportFallback &&
      (options.supportFallback === "true" || options.supportFallback === true)
    ) {
      this.supportFallback = true;
    }
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
	 * Call is made to get environment varibles for a given service. Supports falling back to the
	 * v2 Endpoint if the v3 returns a 404.
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
  fetch(service, cluster) {
    const _self = this;
    return Promise.coroutine(function*() {
      if (
        !service.annotations ||
        !service.annotations[EnvApiClient.annotationServiceName]
      ) {
        logger.warn(`No env-api-service annotation found for ${service.name}`);
        return;
      }
      if (typeof cluster === "string") {
        throw new Error(
          "Invalid argument for 'cluster', requires cluster object not string."
        );
      }

      // Clean metadata so it does not have any booleans before we pass to envapi (booleans cause errors)
      const rawMetadata = cluster.metadata();
      const metadata = {};
      for (const key in rawMetadata) {
        if (
          rawMetadata[key] &&
          typeof rawMetadata[key].toString == "function"
        ) {
          metadata[key] = rawMetadata[key].toString();
        } else {
          metadata[key] = rawMetadata[key];
        }
      }

      let params = {
        service: service.annotations[EnvApiClient.annotationServiceName],
        environment: cluster.metadata().environment,
        cluster: cluster.name(),
        metadata: metadata
      };
      return this.callv3Api(params)
        .then(res => {
          if (res.status && res.status === "success") {
            let result = {};
            result = this.convertEnvResult(res.values, result);
            return result;
          } else {
            throw new Error(res.message || "No error message supplied");
          }
        })
        .catch(err => {
          // try v1 of API if supported and we receieved a 404 from v3 endpoint
          if (this.supportFallback && err.statusCode && err.statusCode == 404) {
            logger.warn(
              `Trying Fallback method with params ${this
                .defaultBranch}, ${service}, ${params.cluster}`
            );
            return this.callv1Api(this.defaultBranch, service, params.cluster)
              .then(result => {
                return result;
              })
              .catch(err => {
                logger.error("Fallback method error: " + JSON.stringify(err));
                throw err;
              });
          } else {
            logger.error(
              `Fallback not supported and/or wrong error code: ${err.statusCode ||
                err}`
            );
            throw err;
          }
        });
    }).bind(this)().catch(function(err) {
      let errMsg = err.message || err;
      // API call failed, parse returned error message if possible...
      if (
        err.response &&
        err.response.body &&
        err.response.body.status === "error"
      ) {
        errMsg = _self.convertErrorResponse(err.response.body);
      }
      throw new Error(errMsg);
    });
  }

  /**
	 * Calls the V3 Endpoint. This is a POST with all parameters in the body of the message
	 */
  callv3Api(payload) {
    const uri = `${this.apiUrl}/v3/vars`;
    let options = {
      method: "POST",
      uri: uri,
      headers: { "X-Auth-Token": this.apiToken },
      body: payload,
      json: true,
      timeout: this.timeout
    };
    return this.request(options);
  }

  /**
	 * Calls the v2 Endpoint. uses GET and query params
	 */
  callv1Api(branch, service, clusterName) {
    return Promise.coroutine(function*() {
      const uri = `${this.apiUrl}/v1/service/${service.annotations[
        EnvApiClient.annotationServiceName
      ]}`;
      let query = { env: clusterName };
      // if a branch is specified pass that along
      if (
        service.annotations ||
        service.annotations[EnvApiClient.annotationBranchName]
      ) {
        query.branch = service.annotations[EnvApiClient.annotationBranchName];
      }
      let options = {
        uri: uri,
        qs: query,
        headers: { "X-Auth-Token": this.apiToken },
        json: true,
        timeout: this.timeout
      };
      let config = yield this.request(options);
      let result = {};
      result = this.convertK8sResult(config.k8s, result);
      if (this.k8sBranch && result.branch && result.branch !== query.branch) {
        logger.debug(`Pulling envs from ${result.branch} branch`);
        options.qs.branch = result.branch;
        config = yield this.request(options);
      }
      result = this.convertEnvResult(config.env, result);
      return result;
    }).bind(this)();
  }

  /**
	 * Convert the custom error messages into a String
	 */
  convertErrorResponse(response) {
    logger.error(`Error in returned response ${response.message}`);
    let errMsg = response.message || "Received error";
    if (response.errors) {
      let errors = Array.isArray(response.errors)
        ? response.errors.join("\n")
        : response.errors;
      errMsg += `\n ${errors}`;
    }
    return errMsg;
  }

  /**
	 * Fetchs the envs
	 */
  /**
	 * Converts the returned results from the env-api service into the expected format.
	 */
  convertK8sResult(k8s, result) {
    if (k8s && typeof k8s === "object") {
      Object.keys(k8s).forEach(key => {
        result[key] = k8s[key];
      });
    }
    return result;
  }

  /**
	 * Converts the returned results from the env-api service into the expected format.
	 */
  convertEnvResult(values, result) {
    result.env = [];
    if (values) {
      Object.keys(values).forEach(key => {
        result.env.push({
          name: key,
          value: values[key]
        });
      });
    }
    return result;
  }
}

module.exports = EnvApiClient;
