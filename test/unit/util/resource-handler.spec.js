"use strict";

const expect = require("chai").expect;
const resourceHandler = require("../../../src/util/resource-handler");

describe("resourceHandler", () => {
  describe("Merginging", () => {
    const base = {
      resources: {
        "coldfusion-secret": {
          kind: "secret",
          file: "./resources/secrets/coldfusion-secret.yaml"
        },
        auth: {
          kind: "deployment",
          file: "./resources/auth/auth-deployment.mustache",
          image_tag: "node-auth",
          svc: {
            name: "auth-svc",
            labels: [
              {
                name: "app",
                value: "invisionapp"
              }
            ]
          },
          env: [
            { name: "one", value: "value-one" },
            { name: "two", value: "value-two" }
          ]
        }
      }
    };
    const sampleEmptyResources = { resources: {} };
    const sampleNullResources = { resources: null };
    const sampleResources = {
      resources: { auth: { disabled: true, kind: "overwrite" } }
    };
    const sampleArray = {
      resources: {
        auth: {
          disabled: true,
          kind: "overwrite",
          env: [
            { name: "two", value: "value-two-overwrite" },
            { name: "three", value: "value-three" }
          ]
        }
      }
    };
    it("Should merge empty resource", () => {
      const mergedObj = resourceHandler.merge(base, sampleEmptyResources);
      console.log("Merged Object: %j", mergedObj);
      expect(mergedObj).to.exist;
      expect(mergedObj.resources.auth).to.exist;
      expect(mergedObj.resources.auth.kind).to.equal("deployment");
    });

    it("Should merge with null resources", () => {
      const mergedObj = resourceHandler.merge(base, sampleNullResources);
      console.log("Merged Object: %j", mergedObj);
      expect(mergedObj).to.exist;
      expect(mergedObj.resources.auth).to.exist;
      expect(mergedObj.resources.auth.kind).to.equal("deployment");
    });

    it("Should merge resources", () => {
      const mergedObj = resourceHandler.merge(base, sampleResources);
      console.log("Merged Object: %j", mergedObj);
      expect(mergedObj).to.exist;
      expect(mergedObj.resources.auth).to.exist;
      expect(mergedObj.resources.auth.kind).to.equal("overwrite");
      expect(mergedObj.resources.auth.disabled).to.exist;
      expect(mergedObj.resources.auth.disabled).to.equal(true);
    });

    it("Should merge resources with envs", () => {
      const mergedObj = resourceHandler.merge(base, sampleArray);
      console.log("Merged Object: %j", mergedObj);
      expect(mergedObj).to.exist;
      expect(mergedObj.resources.auth).to.exist;
      expect(mergedObj.resources.auth.kind).to.equal("overwrite");
      expect(mergedObj.resources.auth.disabled).to.exist;
      expect(mergedObj.resources.auth.env.length).to.equal(3);
      expect(mergedObj.resources.auth.env).to.include({
        name: "three",
        value: "value-three"
      });
      expect(mergedObj.resources.auth.env).to.include({
        name: "two",
        value: "value-two-overwrite"
      });
    });
  });

  describe("Encoding", () => {
    it("should base64 encode string", () => {
      const strToEncode = "Encode Me";
      const encodedStr = resourceHandler.encode(strToEncode, "base64");
      expect(encodedStr).to.not.equal(strToEncode);
      const buf = new Buffer(encodedStr, "base64");
      expect(buf.toString("utf8")).to.equal(strToEncode);
    });

    it("Should default to utf8", () => {
      const strToEncode = "Encode Me";
      const encodedStr = resourceHandler.encode(strToEncode);
      expect(encodedStr).to.equal(strToEncode);
    });

    it("Should throw error with unsupport encoding type", () => {
      const fn = () => {
        resourceHandler.encode("SomeString", "UTF-32BE");
      };
      expect(fn).to.throw();
    });
  });

  describe("External ENV", () => {
    before(() => {
      process.env.EXTERNAL_ENV = "external";
      process.env.EXTERNAL_ENCODED_ENV = "encodeme";
    });
    it("should find and add external ENV defined", () => {
      let envs = [
        { name: "EXTERNAL_ENCODED_ENV", external: true, encoding: "base64" },
        { name: "EXTERNAL_ENV", external: true },
        { name: "INTERNAL_ENV", value: "myvalue" }
      ];

      let newEnvs = resourceHandler.loadExternalEnv(envs);
      expect(newEnvs).to.exist;
      expect(newEnvs).to.include({
        name: "EXTERNAL_ENV",
        value: "external",
        external: true
      });
      expect(newEnvs).to.include({ name: "INTERNAL_ENV", value: "myvalue" });

      const buf = new Buffer("encodeme", "utf8");
      let encodedValue = buf.toString("base64");
      expect(newEnvs).to.include({
        name: "EXTERNAL_ENCODED_ENV",
        value: encodedValue,
        external: true,
        encoding: "base64"
      });
    });
    after(() => {
      delete process.env.EXTERNAL_ENV;
      delete process.env.EXTERNAL_ENCODED_ENV;
    });
  });
});
