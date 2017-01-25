"use strict";

const resourceHandler = require("../util/resource-handler");

const CLUSTER_NAMESPACE = "ClusterNamespace";
const RESOURCE_CONFIG = "ResourceConfig";
const CLUSTER_DEFINITION = "ClusterDefinition";

/**
 * Holds Cluster Definition information. This is used to generate the cluster files.
 * The cluster object is required, the config object is optional.
 */
class ClusterDefinition {
	constructor(cluster, rsConfig) {
		if (!cluster || cluster.kind !== CLUSTER_NAMESPACE) {
			throw new Error("Cluster was invalid: " + ( cluster.kind || "null" ));
		}
		if (rsConfig && rsConfig.kind !== RESOURCE_CONFIG) {
			throw new Error("Config was invalid: " + ( rsConfig.kind || "null" ));
		}
		this.kind = CLUSTER_DEFINITION;
		this.cluster = cluster;
		this.rsConfig = ( rsConfig || { kind: RESOURCE_CONFIG } );
	}

	/**
	 * The name of this cluster.
	 * @return {string}
	 */
	name() {
		return this.cluster.metadata.name;
	}

	/**
	 * Helper method for accessing metadata
	 */
	metadata() {
		return this.cluster.metadata;
	}

	/**
	 * Type of this cluster
	 * @return {string} one of [develop, testing, production]
	 */
	type() {
		return this.cluster.metadata.type;
	}

	/**
	 * Return the branch of the cluster
	 * @return {string} branch name
	 */
	branch() {
		return this.cluster.metadata.branch;
	}

	/**
	 * Clusters can be disabled by adding a metadata.disable == true
	 * This will keep the cluster from being generated.
	 * @return {boolean} if a cluster has been marked disable === true
	 */
	disabled() {
		return (this.cluster.metadata.disable && this.cluster.metadata.disable === true);
	}

	/**
	 * If true, will not halt processing if a failure occures for a single resource.
	 */
	allowFailure() {
		return (this.cluster.metadata.allowFailure && this.cluster.metadata.allowFailure === true)
	}

	/**
	 * Resources for this cluster
	 * @return { "resource-name": data, ...} resource map by name
	 */
	resources() {
		return this.cluster.resources;
	}

	/**
	 * get specific resource for cluster
	 * @param  {string} resourceName name of resource
	 * @return {Resource}
	 */
	resource(resourceName) {
		return this.cluster.resources[resourceName];
	}
	/**
	 * Configuration information for cluster
	 * @return {ResourceConfig} ResourceConfig object
	 */
	configuration() {
		return this.rsConfig;
	}

	/**
	 * Applies the base Object to this Definition.
	 * Values in this definition take precedent.
	 * @param  {Object} base Object to be merged
	 */
	apply(base) {
		if (!base) return;

		switch (base.kind) {
			case CLUSTER_DEFINITION:
				this.cluster = resourceHandler.merge(base.cluster, this.cluster);
				this.rsConfig = resourceHandler.merge(base.rsConfig, this.rsConfig);
				break;
			case CLUSTER_NAMESPACE:
				this.cluster = resourceHandler.merge(base, this.cluster);
				break;
			case RESOURCE_CONFIG:
				this.rsConfig = resourceHandler.merge(base, this.rsConfig);
				break;
			default:
				throw new Error("Unknown Type");
		}
	}
}

module.exports = ClusterDefinition;
