"use strict";

const os = require("os");
const path = require("path");
const expect = require("chai").expect;
const Promise = require("bluebird");
const yamlHandler = require("../../../src/util/yaml-handler");

describe("YamlLoading", () => {
  describe("File not found", () => {
    it("should not find file", done => {
      Promise.coroutine(function*() {
        yield yamlHandler.loadFile("/test/fixture/doNotExistclusters");
        done(new Error("Should have thrown error"));
      })().catch(err => {
        done();
      });
    });
  });

  describe("invalid yaml syntax", () => {
    it("should throw error about invalid syntax", done => {
      Promise.coroutine(function*() {
        yield yamlHandler.loadFile("/test/fixture/util/invalid.yaml");
        done(new Error("Should have thrown error"));
      })().catch(err => {
        done();
      });
    });
  });

  describe("when passing valid file", () => {
    it("should return the contents of the included file in json format", done => {
      Promise.coroutine(function*() {
        const clusterNamespace = yield yamlHandler.loadFile(
          "/test/fixture/util/sample.yaml"
        );
        expect(clusterNamespace.kind).to.equal("ClusterNamespace");
        done();
      })().catch(err => {
        done(err);
      });
    });
  });
});

describe("YamlSaving", () => {
  describe("Save simple JSON object", () => {
    it("should be successful", done => {
      const content = `
        kind: ClusterNamespace
        metadata:
          name: example-1
          branch: master
        resources:
          auth:
            branch: develop
      `;
      Promise.coroutine(function*() {
        yield yamlHandler.saveResourceFile(os.tmpdir(), "example-1", content);
        const loadedFile = yield yamlHandler.loadFile(
          path.join(os.tmpdir(), "example-1.yaml")
        );
        expect(loadedFile).to.exist;
        expect(loadedFile.resources.auth).to.exist;
        expect(loadedFile.resources.auth.branch).to.equal("develop");
        done();
      })().catch(err => {
        done(err);
      });
    });
  });
});

describe("Loading Resources", () => {
  describe("Loading images", () => {
    it("should be successful", done => {
      Promise.coroutine(function*() {
        const imageResources = yield yamlHandler.loadImageDefinitions(
          "/test/fixture/images"
        );
        console.log("%j", imageResources);
        expect(imageResources).to.exist;
        expect(imageResources["invision/node-auth"]).to.exist;
        expect(imageResources["invision/node-auth"].develop).to.exist;
        expect(imageResources["invision/node-auth"].master).to.exist;
        expect(imageResources["invision/node-auth"].release).to.exist;
        expect(imageResources["invision/node-activity"].develop.image).to.exist;
        expect(imageResources["other/console"].develop).to.exist;
        expect(imageResources["other/console"].master).to.exist;
        expect(imageResources["other/console"].release).to.exist;
        done();
      })().catch(err => {
        done(err);
      });
    });
  });

  describe("Loading type defs", () => {
    it("should be successful", done => {
      Promise.coroutine(function*() {
        const typeDefs = yield yamlHandler.loadTypeDefinitions(
          "/test/fixture/type"
        );
        expect(typeDefs).to.exist;
        expect(typeDefs["develop"]).to.exist;
        expect(typeDefs["production"]).to.exist;
        expect(typeDefs["test"]).to.exist;

        expect(typeDefs["develop"].env).to.exist;
        expect(typeDefs["develop"].env.length).to.equal(1);
        expect(typeDefs["develop"].env[0].name).to.equal("EXAMPLE_TYPE_VAR");
        expect(typeDefs["develop"].env[0].value).to.equal("type-var-value");
        done();
      })().catch(err => {
        done(err);
      });
    });
  });
});
