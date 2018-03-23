"use strict";

const _ = require("lodash");
const path = require("path");
const Promise = require("bluebird");
const yamlHandler = require("../util/yaml-handler");
const resourceHandler = require("../util/resource-handler");
const fse = require("fs-extra");
const fseCopy = Promise.promisify(fse.copy);
const fseMkdirs = Promise.promisify(fse.mkdirs);
const fseReadFile = Promise.promisify(fse.readFile);

/**
 * Creates the cluster directory if it already does not exist - async operation.
 * @param	{string} path to directory to create
 */
function createClusterDirectory(clusterPath) {
  // Try to make directory if it doesn't exist yet
  return yamlHandler.exists(clusterPath).then(exists => {
    if (!exists) {
      fseMkdirs(clusterPath);
    }
  });
}

/**
 * Returns the file informtion including type based on ext and name.
 * @param	{[type]} file string containing the file name and ext.
 * @return {{extension, name}}			extention of the file indicating type.
 */
function fileInfo(file) {
  return path.parse(file);
}

/**
 * Manages generation of files for a given cluster definition.
 */
class Generator {
  /**
	 * Configuration options for Generator
	 * @param	{[type]} clusterDef				Cluster Definition for a given cluster
	 * @param	{[type]} imageResourceDefs All Image Resources
	 * @param	{[type]} basePath					Base Path to load Resources from
	 * @param	{[type]} exportPath				Where to save files
	 * @param	{[type]} save							Save or not
	 * @param	{[type]} configPlugin			Plugin to use for loading configuration information
	 * @param	{[type]} resource 				resource to process
	 * @param	{[type]} eventHandler 		to log events to
	 * @param	{[type]} deployId								deployId to use when generating manifests, switch to uuid from elroy
	 * @param	{[type]} fastRollback			determines if fastRollback support is enabled. used by manifest generation
	 */
  constructor(
    clusterDef,
    imageResourceDefs,
    basePath,
    exportPath,
    save,
    configPlugin,
    resource,
    eventHandler,
    deployId,
    fastRollback,
    branch
  ) {
    this.options = {
      clusterDef: clusterDef,
      imageResourceDefs: imageResourceDefs,
      basePath: basePath,
      exportPath: path.join(exportPath, clusterDef.name()),
      save: save || false,
      resource: resource || undefined,
      deployId: deployId || undefined,
      fastRollback: fastRollback || false,
      branch: branch || undefined
    };
    this.configPlugin = configPlugin;
    this.eventHandler = eventHandler;
  }

  /**
	 * Processes a given Cluster Definition, creating all the required files by
	 *	 rendering the resource and service templates.
	 *
	 * Returns a Promise fulfilled after saving file(s)
	 */
  process() {
    this.eventHandler.emitInfo(
      `Calling process for ${this.options.clusterDef.name()}`
    );
    return Promise.coroutine(function*() {
      // Create the output directory if it already does not exist.
      yield createClusterDirectory(this.options.exportPath);
      const resources = this.options.clusterDef.resources();
      if (_.isNil(resources)) {
        this.eventHandler.emitWarn(
          `No Resources defined in cluster ${this.options.clusterDef.name()}`
        );
        return;
      }
      if (this.options.resource) {
        // processing single resource
        let resource = resources[this.options.resource];
        if (!resource) {
          this.eventHandler.emitWarn(
            `Resource requested ${this.options
              .resource} was not found in cluster ${this.options.clusterDef.name()}`
          );
        } else {
          yield this.processSingleResource(this.options.resource, resource);
        }
      } else {
        // processing all resources
        const keys = Object.keys(resources);
        for (let i = 0; i < keys.length; i++) {
          const resourceName = keys[i];
          let resource = resources[resourceName];
          yield this.processSingleResource(resourceName, resource);
        }
      }
      return;
    }).bind(this)();
  }

  processSingleResource(resourceName, resource) {
    let _self = this;
    return Promise.coroutine(function*() {
      if (resource.disable === true) {
        this.eventHandler.emitDebug(
          `Resource ${resourceName} is disabled in cluster ${this.options.clusterDef.name()}, skipping...`
        );
      } else {
        let localConfig = yield this._createLocalConfiguration(
          this.options.clusterDef.configuration(),
          resourceName,
          resource
        );
        if (resource.file) {
          this.eventHandler.emitDebug(
            `Processing Resource ${resourceName} for cluster ${this.options.clusterDef.name()}`
          );
          const fileStats = fileInfo(resource.file);
          switch (fileStats.ext) {
            case ".yaml":
              // YAML files do not need any processing - copy file to output directory
              yield this.processCopyResource(resource, fileStats);
              break;
            case ".mustache":
              // process and render template
              yield this.processResource(resource, localConfig, fileStats);
              break;
            default:
              throw new Error(`Unknown file type: ${fileStats.ext}`);
          }
        }
        if (resource.svc) {
          this.eventHandler.emitDebug(
            `Processing Service ${resource.svc
              .name} for cluster ${this.options.clusterDef.name()}`
          );
          // Create local config for each resource, includes local envs, svc info and image tag
          yield this.processService(resource, localConfig);
        }
      }
    }).bind(this)().catch(err => {
      if (_self.options.clusterDef.allowFailure()) {
        _self.eventHandler.emitWarn(
          err.message ||
            `Error processing ${resourceName} in cluster ${this.options.clusterDef.name()}`
        );
      } else {
        throw err;
      }
    });
  }

  /**
	 * Creates a local clone of the configuration object for a given resource.
	 * Resources can contain more than one Container, configuration information is
	 * mapped to each container in the giver resource. So local config, will
	 * contain 1-n Container child objects.
	 *
	 * @param	{[type]} config			 Initial configuration object
	 * @param	{[type]} resourceName Name of the resource
	 * @param	{[type]} resource
	 * @return {{}}							cloned copy of the configuration with resource specific attributes added.
	 */
  _createLocalConfiguration(config, resourceName, resource) {
    return Promise.coroutine(function*() {
      // clone local copy
      let localConfig = _.cloneDeep(config);
      // if not not set at the resource level set it to the cluster default
      localConfig.branch = resource.branch || this.options.clusterDef.branch();
      // Add the ResourceName to the config object.
      localConfig.name = resourceName;
      if (this.options.deployId) {
        if (localConfig.deployment) {
          localConfig.deployment.id = this.options.deployId;
          localConfig.deployment.fastRollback = this.options.fastRollback;
        } else {
          localConfig.deployment = {
            id: this.options.deployId,
            fastRollback: this.options.fastRollback
          };
        }
      }

      // Map all containers into an Array
      let containers = [];
      if (resource.containers) {
        Object.keys(resource.containers).forEach(cName => {
          containers.push({
            name: cName,
            container: resource.containers[cName]
          });
        });
      } else {
        containers.push({ name: resourceName, container: resource });
      }

      // Process each container
      for (let i = 0; i < containers.length; i++) {
        // clone this so we dont affect the definition
        let artifact = _.cloneDeep(containers[i].container);
        let containerName = containers[i].name;
        // make sure the name is set
        artifact.name = artifact.name || resourceName;
        localConfig[containerName] = artifact;
        // If we have a plugin use it to load env and other config values
        if (this.configPlugin) {
          // get Configuration from plugin
          const envConfig = yield this.configPlugin.fetch(
            artifact,
            this.options.clusterDef
          );
          // merge these in --> At this point, envConfig will overwrite anything in the cluster def.
          localConfig[containerName] = resourceHandler.merge(
            artifact,
            envConfig
          );
        }

        // Check to see if the specific resource has its own envs and merge if needed.
        if (artifact.env) {
          // Process any external ENV values before merging.
          const env = resourceHandler.mergeEnvs(
            localConfig[containerName].env,
            resourceHandler.loadExternalEnv(artifact.env)
          );
          localConfig[containerName].env = env;
        }

        // If an image is not predefined, try to find the image tag
        //	 (this defines the name of the directory containing images based on branch),
        //	 if not defined skip
        if (!localConfig[containerName].image) {
          if (artifact.image_tag) {
            let artifactBranch =
              localConfig[containerName].branch ||
              localConfig.branch ||
              this.options.branch;
            artifactBranch = artifactBranch.replace(/\//, "-");
            if (
              !this.options.imageResourceDefs[artifact.image_tag] ||
              !this.options.imageResourceDefs[artifact.image_tag][
                artifactBranch
              ]
            ) {
              this.eventHandler.emitWarn(
                JSON.stringify(this.options.imageResourceDefs)
              );
              throw new Error(
                `Image ${artifact.image_tag} not found for defined branch (${artifactBranch})`
              );
            }
            localConfig[containerName].image = this.options.imageResourceDefs[
              artifact.image_tag][artifactBranch].image;
          } else {
            this.eventHandler.emitWarn(
              `No image tag found for ${artifact.name}`
            );
          }
        } else {
          this.eventHandler.emitWarn(
            `Image ${localConfig[containerName]
              .image} already defined for ${artifact.name}`
          );
        }
      }

      // if service info, append
      if (resource.svc) {
        localConfig.svc = resource.svc;
      }

      const reservedFields = ["branch", "file", "svc", "containers"];
      function objectWithoutProperties(obj, keys) {
        let target = {};
        for (let i in obj) {
          if (keys.indexOf(i) >= 0) continue;
          if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
          target[i] = obj[i];
        }
        return target;
      }
      return Object.assign(localConfig, objectWithoutProperties(resource, reservedFields));
    }).bind(this)();
  }

  /**
	 * Renders the resource file and saves to the output directory.
	 * @param	{[type]} resource		 to process
	 * @param	{[type]} localConfig	data to use when rendering templat
	 * @param	{[type]} fileStats		file information
	 * @return {[type]}					 [description]
	 */
  processResource(resource, localConfig, fileStats) {
    return Promise.coroutine(function*() {
      try {
        const resourceTemplate = yield fseReadFile(
          path.join(this.options.basePath, resource.file),
          "utf8"
        );
        const resourceYaml = resourceHandler.render(
          resourceTemplate,
          localConfig
        );
        if (this.options.save === true) {
          yield yamlHandler.saveResourceFile(
            this.options.exportPath,
            fileStats.name,
            resourceYaml
          );
        } else {
          this.eventHandler.emitDebug(
            `Saving is disabled, skipping ${fileStats.name}`
          );
        }
      } catch (e) {
        console.log(e);
      }
      return;
    }).bind(this)();
  }

  /**
	 * Copys the file from the current location to the output location
	 * @param	{[type]} resource	containing the file path to copy
	 * @param	{[type]} fileStats file information
	 * @return {[type]}					 [description]
	 */
  processCopyResource(resource, fileStats) {
    return Promise.coroutine(function*() {
      this.eventHandler.emitDebug(
        `Copying file from ${path.join(
          this.options.basePath,
          resource.file
        )} to ${path.join(this.options.exportPath, fileStats.base)}`
      );
      if (this.options.save === true) {
        return yield fseCopy(
          path.join(this.options.basePath, resource.file),
          path.join(this.options.exportPath, fileStats.base)
        );
      } else {
        this.eventHandler.emitDebug(
          `Saving is disabled, skipping ${fileStats.name}`
        );
        return;
      }
    }).bind(this)();
  }

  /**
	 * Process the Service File
	 * @param	{[type]} resource		[description]
	 * @param	{[type]} localConfig [description]
	 * @return {[type]}						 [description]
	 */
  processService(resource, config) {
    return Promise.coroutine(function*() {
      // There may not be a service associated with this
      const serviceTemplate = yield fseReadFile(
        path.join(this.options.basePath, "base-svc.mustache"),
        "utf8"
      );
      const svcYaml = resourceHandler.render(serviceTemplate, config);
      if (this.options.save === true) {
        yield yamlHandler.saveResourceFile(
          this.options.exportPath,
          resource.svc.name,
          svcYaml
        );
      } else {
        this.eventHandler.emitDebug(
          `Saving is disabled, skipping ${resource.svc.name}`
        );
      }
      return;
    }).bind(this)();
  }
}

module.exports = Generator;
