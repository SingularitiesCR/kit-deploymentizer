"use strict";

const fse = require("fs-extra");
const Promise = require("bluebird");
const path = require("path");
const yaml = require("js-yaml");
const glob = require("glob-promise");
const ClusterDefinition = require("../lib/cluster-definition");
const fseWriteFile = Promise.promisify(fse.writeFile);
const fseReadFile = Promise.promisify(fse.readFile);
const fseReadDir = Promise.promisify(fse.readdir);
const fseStat = Promise.promisify(fse.stat);
const logger = require("log4js").getLogger();
const mustache = require("mustache");
const resourceHandler = require("../util/resource-handler");

// Static class for handling Files.
class YamlHandler {
  /**
   * loads a yaml file into a JSOn Object, returning the new Object.
   * @param  {[type]} file to load
   * @return {{}}     the yaml file as JSON object
   */
  static loadFile(file) {
    // Parse the yaml file to JSON,
    return fseReadFile(file, "utf8").then(fileContent => {
      return yaml.safeLoad(fileContent);
    });
  }

  /**
   * Loads all the image files into a set of nested objects
   * based on resource name and type:
   * {
	 *   node-auth: { develop: {}, test: {}, release: {} },
	 *   node-activity: { develop: {}, test: {}, release: {} },
	 *   ...
	 * }
   * @param  {[type]} basePath [description]
   * @return {{}}     complex object accessable by resource.type.image as Promise
   */
  static loadImageDefinitions(basePath) {
    return Promise.coroutine(function* () {
      const dirs = yield fseReadDir(basePath);
      let imageResourceDefs = {};
      for (let d = 0; d < dirs.length; d++) {
        // loop through the directories
        const dir = dirs[d];
        const files = yield glob(path.join(basePath, dir, "**/*.yaml"));
        // loop through the files adding by name
        for (let f = 0; f < files.length; f++) {
          // pull apart the path, we want to index on the path (excluding basePath)
          const parsedFile = path.parse(
            files[f].substring(files[f].indexOf(dir))
          );
          const name = parsedFile.name;
          const imageResourceName = parsedFile.dir;
          const image = yield YamlHandler.loadFile(files[f]);
          // make sure this value is set - but only once
          if (!imageResourceDefs[imageResourceName]) {
            imageResourceDefs[imageResourceName] = {};
          }
          imageResourceDefs[imageResourceName][name] = image;
        }
      }
      return imageResourceDefs;
    })();
  }

  /**
   * Loads the various Type definitions into an Associative Array.
   * @param  {[type]} loadPathPattern path/pattern to load type definitions from, uses glob pattern
   * @return {{type:definition}} Type Definitions as a Promise result
   */
  static loadTypeDefinitions(loadPathPattern) {
    return Promise.coroutine(function* () {
      const files = yield glob(`${loadPathPattern}/*-var.yaml`);
      let typeDefs = {};
      for (let i = 0; i < files.length; i++) {
        const def = yield YamlHandler.loadFile(files[i]);
        typeDefs[def.metadata.type] = def;
      }
      return typeDefs;
    })();
  }

  /**
   * Loads the base Cluster/Config definitions. Everything is based off these files.
   * @return {object} Holding base cluster and config values as a Promise
   */
  static loadBaseDefinitions(loadPath) {
    return Promise.coroutine(function* () {
      const config = yield YamlHandler.loadFile(
        path.join(loadPath, "base-var.yaml")
      );
      const clusterTemplate = yield fseReadFile(
        path.join(loadPath, "base-cluster.mustache"),
        "utf8"
      );
      const clusterRender = mustache.render(clusterTemplate, config);
      const cluster = yaml.load(clusterRender);
      const cDef = new ClusterDefinition(cluster, config);
      return cDef;
    })();
  }

  /**
   * Loads Cluster Definition Files.
   * @param  {[type]} basePath directory containing cluster files.
   * @param  {[type]} baseConfig base cluster configuration used to render templates.
   * @return {[type]}          Returns a Promise with cluster information.
   */
  static loadClusterDefinitions(basePath, baseConfig) {
    return Promise.coroutine(function* () {
      const dirs = yield fseReadDir(basePath);
      let clusters = [];
      for (let i = 0; i < dirs.length; i++) {
        let dir = dirs[i];
        logger.debug(`Found Cluster Dir: ${dir}`);
        // If there is not cluster file present, skip directory
        const yamlExists = yield YamlHandler.exists(
          path.join(basePath, dir, "cluster.yaml")
        );
        const mustacheExists = yield YamlHandler.exists(
          path.join(basePath, dir, "cluster.mustache")
        );
        if (!yamlExists && !mustacheExists) {
          logger.debug(`No Cluster file found for ${dir}, skipping...`);
          continue;
        }
        let cluster;
        let config = yield YamlHandler.loadFile(
          path.join(basePath, dir, "configuration-var.yaml")
        );
        const kubeconfig = yield YamlHandler.loadFile(
          path.join(basePath, dir, "kubeconfig.yaml")
        );
        if (yamlExists) {
          cluster = yield YamlHandler.loadFile(
            path.join(basePath, dir, "cluster.yaml")
          );
        } else if (mustacheExists) {
          const clusterTemplate = yield fseReadFile(
            path.join(basePath, dir, "cluster.mustache"),
            "utf8"
          );
          config = resourceHandler.merge(baseConfig, config);
          cluster = mustache.render(clusterTemplate, config);
        }
        clusters.push(new ClusterDefinition(cluster, config, kubeconfig));
      }
      return clusters;
    })();
  }

  /**
   * Saves a file out to the specified directory
   * @param  {[type]} dir     to save to
   * @param  {[type]} name    name of the file
   * @param  {[type]} content content to save
   * @return {[type]}         returns a Promise
   */
  static saveResourceFile(dir, name, content) {
    const fileName = path.join(dir, `${name}.yaml`);
    return fseWriteFile(fileName, content);
  }

  /**
   * Checks if a file exists
   * @param  {string} file to check for
   * @return {boolean}      boolean
   */
  static exists(file) {
    return fseStat(file)
      .then(stat => {
        return true;
      })
      .catch(err => {
        return false;
      });
  }
}

module.exports = YamlHandler;
