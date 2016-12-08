"use strict";

var expect = require("chai").expect;
const Promise = require("bluebird");
const sinon = require("sinon");

describe("ENV API Client Configuration plugin", () =>  {

	describe("Load Client", () =>  {
		it("should fail with validation error", (done) => {
			try {
				const ApiConfig = require("../../../src/plugin/env-api-client-v2");
				const apiConfig = new ApiConfig();
				done(new Error("Should have failed"));
			} catch(err) {
				done();
			};
		});

		it("should fail with validation error", (done) => {
			try {
			const options = { api: "http://somehost/v2", Token: "SOME-TOKEN"}
			const ApiConfig = require("../../../src/plugin/env-api-client-v2");
			const apiConfig = new ApiConfig(options);
				done(new Error("Should have failed"));
			} catch(err) {
				done();
			};
		});

		it("should load plugin successfully", (done) => {
			const options = { apiUrl: "http://somehost/v2", apiToken: "SOME-TOKEN", timeout: 20000}
			const ApiConfig = require("../../../src/plugin/env-api-client-v2");
			const apiConfig = new ApiConfig(options);
			expect(apiConfig).to.exist;
			expect(apiConfig.apiToken).to.equal("SOME-TOKEN");
			expect(apiConfig.apiUrl).to.equal("http://somehost/v2");
			expect(apiConfig.timeout).to.equal(20000);
			done();
		});
		it("should load plugin successfully and default timeout", (done) => {
			const options = { apiUrl: "http://somehost/v2", apiToken: "SOME-TOKEN"}
			const ApiConfig = require("../../../src/plugin/env-api-client-v2");
			const apiConfig = new ApiConfig(options);
			expect(apiConfig).to.exist;
			expect(apiConfig.timeout).to.equal(15000);
			done();
		});
	});

	describe("Client calls", () =>  {

		it("should only call request to env-api once, and convert values", (done) => {
			Promise.coroutine(function* () {
				const responseOne = new Promise( (resolve, reject) => {
					resolve(
					{
						"status": "success",
						"message": "fetched env",
						"values": {
							"branch": "develop"
						}
					});
				});
				const responseTwo = new Promise( (resolve, reject) => {
					resolve(
					{
						"status": "success",
						"message": "fetched env",
						"values": {
							"GET_HOSTS_FROM": "dns",
							"MAX_RETRIES": "0",
							"MEMBER_HOSTS": "mongoreplica-01-svc:27017,mongoreplica-02-svc:27017,mongoreplica-03-svc:27017",
							"REPLICA_SET_NAME": "rs0",
							"WAIT_TIME": "60000"
						}
					});
				});
				var rp = sinon.stub();
				rp.onFirstCall().returns(responseOne);
				rp.onSecondCall().returns(responseTwo);
				const options = { apiUrl: "http://somehost/v2", apiToken: "SOME-TOKEN", k8sBranch: true };
				const ApiConfig = require("../../../src/plugin/env-api-client-v2");
				const apiConfig = new ApiConfig(options);
				apiConfig.request = rp;

				const service = {
					name: "mongo-init",
					annotations: {
						"kit-deploymentizer/env-api-service": "mongo-init",
						"kit-deploymentizer/env-api-branch": "develop"
					}
				}
				const envs = yield apiConfig.fetch(service, "example-cluster");
				expect(rp.callCount).to.equal(2);
				let calledWith = rp.getCall(0);
				// assert that the second call was to testing branch
				expect(calledWith.args[0].qs.branch).to.equal("develop");
				expect(calledWith.args[0].qs.env).to.equal("example-cluster");
				expect(envs.branch).to.equal("develop");
				expect(envs.env.length).to.equal(5);
				expect(envs.env[0].name).to.equal("GET_HOSTS_FROM");
				expect(envs.env[0].value).to.equal("dns");
				expect(envs.env[1].name).to.equal("MAX_RETRIES");
				expect(envs.env[1].value).to.equal("0");
				done();
			})().catch( (err) => {
				done(err);
			});
		});

		it("should call request to env-api twice, and get correct values", (done) => {
			Promise.coroutine(function* () {
				// ResponseOne is the k8s file and says use testing branch,
				// Request is invoked again passing in the branch testing
				// those values are used, but initial requests branch is kept.
				const responseOne = new Promise( (resolve, reject) => {
					resolve(
					{
						"status": "success",
						"message": "fetched env",
						"values": {
							"branch": "testing"
						}
					});
				});
				const responseTwo = new Promise( (resolve, reject) => {
					resolve(
					{
						"status": "success",
						"message": "fetched env",
						"values": {
							"GET_HOSTS_FROM": "dns",
							"MAX_RETRIES": "5",
							"WAIT_TIME": "10000"
						}
					});
				});
				var rp = sinon.stub();
				rp.onFirstCall().returns(responseOne)
					.onSecondCall().returns(responseTwo);
				const options = { apiUrl: "http://somehost/v2", apiToken: "SOME-TOKEN", k8sBranch: true };
				const ApiConfig = require("../../../src/plugin/env-api-client-v2");
				const apiConfig = new ApiConfig(options);
				apiConfig.request = rp;

				const service = {
					name: "mongo-init",
					annotations: {
						"kit-deploymentizer/env-api-service": "mongo-init",
						"kit-deploymentizer/env-api-branch": "develop"
					}
				}
				const envs = yield apiConfig.fetch(service, "example-cluster");
				// console.log("Resolved ENVS: %j", envs);
				expect(rp.callCount).to.equal(2);
				let calledWith = rp.getCall(1);
				// assert that the second call was to testing branch
				expect(calledWith.args[0].qs.branch).to.equal("testing");
				expect(envs.branch).to.equal("testing");
				expect(envs.env.length).to.equal(3);
				expect(envs.env[1].name).to.equal("MAX_RETRIES");
				expect(envs.env[1].value).to.equal("5");
				expect(envs.env[2].name).to.equal("WAIT_TIME");
				expect(envs.env[2].value).to.equal("10000");
				done();
			})().catch( (err) => {
				done(err);
			});
		});

		it("should call request to env-api once, k8sBranch disabled", (done) => {
			Promise.coroutine(function* () {
				// ResponseOne is returned that says use testing branch,
				// Request is invoked again passing in branch testing
				// those values are used, but initial requests branch is kept.
				const responseOne = new Promise( (resolve, reject) => {
					resolve(
					{
						"status": "success",
						"message": "fetched k8s",
						"values": {
							"branch": "testing"
						}
					});
				});
				const responseTwo = new Promise( (resolve, reject) => {
					resolve(
					{
						"status": "success",
						"message": "fetched env",
						"values": {
							"GET_HOSTS_FROM": "dns",
							"MAX_RETRIES": "0",
							"WAIT_TIME": "60000"
						}
					});
				});
				var rp = sinon.stub();
				rp.onFirstCall().returns(responseOne)
					.onSecondCall().returns(responseTwo);
				const options = { apiUrl: "http://somehost/v2", apiToken: "SOME-TOKEN" };
				const ApiConfig = require("../../../src/plugin/env-api-client-v2");
				const apiConfig = new ApiConfig(options);
				apiConfig.request = rp;

				const service = {
					name: "mongo-init",
					annotations: {
						"kit-deploymentizer/env-api-service": "mongo-init",
						"kit-deploymentizer/env-api-branch": "develop"
					}
				}
				const envs = yield apiConfig.fetch(service, "example-cluster");
				// console.log("Resolved ENVS: %j", envs);
				expect(rp.callCount).to.equal(2);
				expect(envs.branch).to.equal("testing");
				expect(envs.env.length).to.equal(3);
				expect(envs.env[1].name).to.equal("MAX_RETRIES");
				expect(envs.env[1].value).to.equal("0");
				expect(envs.env[2].name).to.equal("WAIT_TIME");
				expect(envs.env[2].value).to.equal("60000");
				done();
			})().catch( (err) => {
				done(err);
			});

		});


		it("should call request to env-api and get error", (done) => {
			Promise.coroutine(function* () {
				// ResponseOne is returned that says use testing branch,
				// Request is invoked again passing in branch testing
				// those values are used, but initial requests branch is kept.
				const responseOne = new Promise( (resolve, reject) => {
					resolve(
					{
						"status": "error",
						"message": "Failed to fetch for env: test-cluster",
						"errors": [
							"Unable to fetch SECRET-DOES-NOT-EXIST (/node-test-rosie/SOMETHING): S3FetchError"
						]
					});
				});
				var rp = sinon.stub();
				rp.onFirstCall().returns(responseOne);
				const options = { apiUrl: "http://somehost/v2", apiToken: "SOME-TOKEN" };
				const ApiConfig = require("../../../src/plugin/env-api-client-v2");
				const apiConfig = new ApiConfig(options);
				apiConfig.request = rp;

				const service = {
					name: "mongo-init",
					annotations: {
						"kit-deploymentizer/env-api-service": "mongo-init",
						"kit-deploymentizer/env-api-branch": "develop"
					}
				}
				const envs = yield apiConfig.fetch(service, "example-cluster");
				done(new Error("should have throw error"));
			})().catch( (err) => {
				expect(err.message).to.exist;
				expect(err.message).to.have.string("Failed to fetch for env: test-cluster");
				expect(err.message).to.have.string("Unable to fetch SECRET-DOES-NOT-EXIST");
				done();
			});

		});

	});

});
