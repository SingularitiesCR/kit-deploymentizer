"use strict";

const expect = require("chai").expect;
const mockery = require("mockery");

let Deploymentizer;

describe("Deploymentizer", () =>  {
	before(function(done) {
		mockery.enable({
			warnOnReplace: false,
			warnOnUnregistered: false,
			useCleanCache: true
		});

		mockery.registerMock("request-promise", function() {
			expect(opt.body.name).not.to.be.empty;
			expect(opt.headers["X-Auth-Token"]).not.to.be.empty;
			return Promise.resolve();
		});
		Deploymentizer = require("../../../src/lib/deploymentizer");
		done();
	});
	describe("configuration", () =>  {
		it("should parse conf", () => {
			const conf = {
				base: { path: "/test/fixture"},
				output: { path: "/generated"},
				cluster: { path: "/test/fixture/clusters"},
				images: { path: "/test/fixture/images"},
				type: { path: "/test/fixture/type"},
				resources: { path: "/test/fixture/resources"},
			};
			const options = {
				elroyUrl: "http://elroy-svc.tools.svc.cluster.local/",
				elroySecret: "123abc",
				save: false,
				clean: true,
				conf: conf
			};
			const deploymentizer = new Deploymentizer(options);
			expect(deploymentizer.paths.base).to.equal("/test/fixture");
			expect(deploymentizer.paths.output).to.equal("/generated");
			expect(deploymentizer.paths.cluster).to.equal("/test/fixture/clusters");
			expect(deploymentizer.paths.images).to.equal("/test/fixture/images");
			expect(deploymentizer.paths.type).to.equal("/test/fixture/type");
			expect(deploymentizer.paths.resources).to.equal("/test/fixture/resources");
		});
		it("should map relative and absolute paths with workdir", () => {
			const conf = {
				base: { path: "/test/fixture"},
				output: { path: "/generated"},
				cluster: { path: "./fixture/clusters"},
				images: { path: "./fixture/images"},
				type: { path: "/test/fixture/type"},
				resources: { path: "/test/fixture/resources"},
			};
			const options = {
				elroyUrl: "http://elroy-svc.tools.svc.cluster.local/",
				elroySecret: "123abc",
				save: false,
				clean: true,
				workdir: "/sample",
				conf: conf
			};
			const deploymentizer = new Deploymentizer(options);
			expect(deploymentizer.paths.base).to.equal("/test/fixture");
			expect(deploymentizer.paths.output).to.equal("/generated");
			expect(deploymentizer.paths.cluster).to.equal("/sample/fixture/clusters");
			expect(deploymentizer.paths.images).to.equal("/sample/fixture/images");
			expect(deploymentizer.paths.type).to.equal("/test/fixture/type");
			expect(deploymentizer.paths.resources).to.equal("/test/fixture/resources");
		});
		it("should fail with invalid conf", (done) => {
			const options = {
				elroyUrl: "http://elroy-svc.tools.svc.cluster.local/",
				elroySecret: "123abc",
				save: false,
				clean: true,
				conf: "/test/fixture/bad-kit.yaml"
			};
			try {
				const deploymentizer = new Deploymentizer(options);
				done(new Error("Should have failed"));
			} catch (e) {
				done();
			}
		});
	});
	after(function(done) {
		mockery.disable();
		mockery.deregisterAll();
		done();
	});
});
