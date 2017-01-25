"use strict";

var expect = require("chai").expect;
const Promise = require("bluebird");
const PluginHandler = require("../../../src/util/plugin-handler");
const ClusterDefinition = require("../../../src/lib/cluster-definition");

describe("PluginHandler", () =>  {

	describe("Load", () =>  {

		it("Should load the pluginHandler", () => {
      const options = { configPath: "./test/fixture/config" }
			const handler = new PluginHandler("../../../src/plugin/file-config", options);
			expect(handler).to.exist;
		});

		it("should load configuration object", (done) => {
			Promise.coroutine(function* () {
				const cluster = {kind: "ClusterNamespace", metadata: {name: "example", type: "staging", environment: "staging", domain:"somewbesite.com"} };
				const clusterConfig = {kind: "ResourceConfig", env: [{name: "a", value: 1}, {name: "b", value: 2}]};
				const clusterDef = new ClusterDefinition(cluster, clusterConfig);

        const options = { configPath: "./test/fixture/config" }
  			const handler = new PluginHandler("../../../src/plugin/file-config", options);
				expect(handler).to.exist;
				const config = yield handler.fetch( { name: "service" }, clusterDef )
				expect(config).to.exist;
				expect(config.env).to.exist;
				expect(config.branch).to.exist;
				expect(config.branch).to.equal("develop");
				expect(config.env.length).to.equal(3);
				expect(config.env).to.include({name: "ENV_ONE", value: "value one"})
				expect(config.env).to.include({name: "ENV_TWO", value: "value two"})
				expect(config.env).to.include({name: "ENV_THREE", value: "value three"})
				done();
			})().catch( (err) => {
				done(err);
			});
		});

		it("should fail with file not found", (done) => {
			Promise.coroutine(function* () {
				const cluster = {kind: "ClusterNamespace", metadata: {name: "not-here", type: "staging", environment: "staging", domain:"somewbesite.com"} };
				const clusterConfig = {kind: "ResourceConfig", env: [{name: "a", value: 1}, {name: "b", value: 2}]};
				const clusterDef = new ClusterDefinition(cluster, clusterConfig);

        const options = { configPath: "./test/fixture/config" }
  			const handler = new PluginHandler("../../../src/plugin/file-config", options);
				expect(handler).to.exist;
				const config = yield handler.fetch( { name: "service" }, clusterDef )
				done(err);
			})().catch( (err) => {
				done();
			});
		});

	});

});
