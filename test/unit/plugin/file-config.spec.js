"use strict";

var expect = require("chai").expect;
const Promise = require("bluebird");
const ClusterDefinition = require("../../../src/lib/cluster-definition");

describe("File Configuration plugin", () => {
  const FileConfig = require("../../../src/plugin/file-config");
  const fileConfig = new FileConfig({ configPath: "./test/fixture/config" });

  console.log(fileConfig);
  describe("Load", () => {
    it("should load configuration object", done => {
      const cluster = {
        kind: "ClusterNamespace",
        metadata: { name: "example", type: "staging", environment: "staging" }
      };
      const config = { kind: "ResourceConfig", env: [] };
      const clusterDef = new ClusterDefinition(cluster, config);

      Promise.coroutine(function*() {
        const config = yield fileConfig.fetch({ name: "service" }, clusterDef);
        expect(config).to.exist;
        expect(config.branch).to.exist;
        expect(config.branch).to.equal("develop");
        expect(config.env).to.exist;
        expect(config.env).to.include({ name: "ENV_ONE", value: "value one" });
        expect(config.env).to.include({ name: "ENV_TWO", value: "value two" });
        expect(config.env).to.include({
          name: "ENV_THREE",
          value: "value three"
        });
        done();
      })().catch(err => {
        done(err);
      });
    });

    it("should fail with file not found", done => {
      const cluster = {
        kind: "ClusterNamespace",
        metadata: { name: "not-here", type: "staging", environment: "staging" }
      };
      const config = { kind: "ResourceConfig", env: [] };
      const clusterDef = new ClusterDefinition(cluster, config);

      Promise.coroutine(function*() {
        const config = yield fileConfig.fetch({ name: "service" }, clusterDef);
        done(new Error("Should faile with file not found"));
      })().catch(err => {
        done();
      });
    });
  });
});
