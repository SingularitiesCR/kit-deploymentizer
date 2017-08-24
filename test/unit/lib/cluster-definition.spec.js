"use strict";

var expect = require("chai").expect;
var yamlHandler = require("../../../src/util/yaml-handler");
var ClusterDefinition = require("../../../src/lib/cluster-definition");
const Promise = require("bluebird");

describe("Cluster Definitions", () => {
  describe("Required files not found", () => {
    it("should not find files", done => {
      yamlHandler
        .loadClusterDefinitions("./test/fixture/doNotExistclusters")
        .then(clusterDefs => {
          done(new Error("Should have thrown exception"));
        })
        .catch(err => {
          done();
        });
    });
  });

  describe("Test Apply Method", () => {
    it("Should error with unknow type", () => {
      var fn = () => {
        new ClusterDefinition({}, {});
      };
      expect(fn).to.throw();
    });

    it("Should merge clusterNamespace", () => {
      const cluster = {
        kind: "ClusterNamespace",
        metadata: { name: "test-1", type: "develop" }
      };
      const config = {
        kind: "ResourceConfig",
        env: [{ name: "a", value: 1 }, { name: "b", value: 2 }]
      };
      const clusterDef = new ClusterDefinition(cluster, config);
      expect(clusterDef).to.exist;
      expect(clusterDef.name()).to.equal("test-1");

      const clusterBase = {
        kind: "ClusterNamespace",
        metadata: { name: "base", type: "develop" },
        resources: [{ auth: "service" }]
      };
      clusterDef.apply(clusterBase);
      expect(clusterDef.name()).to.equal("test-1");
      expect(clusterDef.cluster.resources.length).to.equal(1);
    });

    it("Should merge ResourceConfig", () => {
      const cluster = {
        kind: "ClusterNamespace",
        metadata: { name: "test-1", type: "develop" }
      };
      const config = {
        kind: "ResourceConfig",
        deployment: { replicaCount: 1 },
        env: [{ name: "a", value: 1 }, { name: "b", value: 2 }]
      };
      const clusterDef = new ClusterDefinition(cluster, config);
      expect(clusterDef).to.exist;
      expect(clusterDef.name()).to.equal("test-1");
      expect(clusterDef.rsConfig.env.length).to.equal(2);
      expect(clusterDef.rsConfig.deployment.replicaCount).to.equal(1);
      expect(clusterDef.rsConfig.env).to.include({ name: "a", value: 1 });

      const baseConfig = {
        kind: "ResourceConfig",
        deployment: { replicaCount: 3 },
        env: [
          { name: "a", value: 5 },
          { name: "b", value: 6 },
          { name: "c", value: 4 }
        ]
      };
      clusterDef.apply(baseConfig);
      expect(clusterDef.rsConfig.env.length).to.equal(3);
      expect(clusterDef.rsConfig.deployment.replicaCount).to.equal(1);
      expect(clusterDef.rsConfig.env).to.include({ name: "a", value: 1 });
      expect(clusterDef.rsConfig.env).to.include({ name: "c", value: 4 });
    });

    it("Should merge a ClusterDefinition", () => {
      const cluster = {
        kind: "ClusterNamespace",
        metadata: { name: "test-1", type: "develop" }
      };
      const config = {
        kind: "ResourceConfig",
        env: [{ name: "a", value: 1 }, { name: "b", value: 2 }]
      };
      const clusterDef = new ClusterDefinition(cluster, config);
      expect(clusterDef).to.exist;
      expect(clusterDef.name()).to.equal("test-1");
      expect(clusterDef.rsConfig.env.length).to.equal(2);
      expect(clusterDef.rsConfig.env).to.include({ name: "a", value: 1 });

      const baseConfig = {
        kind: "ResourceConfig",
        env: [
          { name: "a", value: 2 },
          { name: "b", value: 3 },
          { name: "c", value: 4 }
        ]
      };
      const clusterBase = {
        kind: "ClusterNamespace",
        metadata: { name: "base", type: "develop" },
        resources: [{ auth: "service" }]
      };
      const baseDef = new ClusterDefinition(clusterBase, baseConfig);
      clusterDef.apply(baseDef);
      expect(clusterDef.rsConfig.env.length).to.equal(3);
      expect(clusterDef.rsConfig.env).to.include({ name: "a", value: 1 });
      expect(clusterDef.rsConfig.env).to.include({ name: "c", value: 4 });
      expect(clusterDef.name()).to.equal("test-1");
      expect(clusterDef.cluster.resources.length).to.equal(1);
    });
  });

  describe("Successfully load cluter definition from file", () => {
    it("should have load values", done => {
      return Promise.coroutine(function*() {
        const clusterDefs = yield yamlHandler.loadClusterDefinitions(
          "./test/fixture/clusters"
        );
        expect(clusterDefs).to.exist;
        expect(clusterDefs.length).to.equal(4);
        const clusterDef = clusterDefs[3];
        expect(clusterDef).to.exist;
        expect(clusterDef.name()).to.equal("test-fixture");
        expect(clusterDef.type()).to.equal("test");
        expect(clusterDef.server).to.equal(
          "https://test-fixture.k8s-controller.example.com"
        );
        expect(clusterDef.rsConfig.deployment).to.exist;
        expect(clusterDef.rsConfig.deployment.replicaCount).to.equal(2);
        done();
      })().catch(err => {
        done(err);
      });
    });

    it("should load cluster definition and display merged content, keeping initial values", done => {
      return Promise.coroutine(function*() {
        const clusterDefs = yield yamlHandler.loadClusterDefinitions(
          "./test/fixture/clusters"
        );
        expect(clusterDefs).to.exist;
        expect(clusterDefs.length).to.equal(4);

        // Load Cluster Def
        const clusterDef = clusterDefs[3];
        expect(clusterDef).to.exist;
        expect(clusterDef.name()).to.equal("test-fixture");
        expect(clusterDef.server).to.equal(
          "https://test-fixture.k8s-controller.example.com"
        );
        expect(clusterDef.rsConfig.deployment).to.exist;
        expect(clusterDef.rsConfig.deployment.replicaCount).to.equal(2);
        expect(clusterDef.rsConfig.deployment.imagePullPolicy).to.not.exist;

        // Load the base definitions
        const baseDef = yield yamlHandler.loadBaseDefinitions("./test/fixture");
        expect(baseDef).to.exist;
        const authBase = baseDef.resource("auth");
        expect(authBase).to.exist;
        expect(authBase.containers["auth-con"].env.length).to.equal(1);
        expect(authBase.containers["auth-con"].env).to.include({
          name: "test",
          value: "testbase"
        });

        // Merge content
        clusterDef.apply(baseDef);
        // Should have combined data
        expect(clusterDef.rsConfig.deployment.imagePullPolicy).to.equal(
          "IfNotPresent"
        );
        expect(clusterDef.rsConfig.deployment.containerPort).to.equal(80);
        const authResource = clusterDef.resource("auth");
        expect(authResource).to.exist;
        expect(authResource.containers["auth-con"].env.length).to.equal(1);
        expect(authResource.containers["auth-con"].env).to.include({
          name: "test",
          value: "testvalue"
        });
        done();
      })().catch(err => {
        done(err);
      });
    });
  });
});
