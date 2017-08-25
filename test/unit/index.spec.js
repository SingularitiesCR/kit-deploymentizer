"use strict";

const expect = require("chai").expect;

describe("KitDeploymentizer", () => {
  describe("when required", () => {
    let KitDeploymentizer;
    beforeEach(() => {
      KitDeploymentizer = require("../../src/index");
    });
    it("should have Deploymentizer class", () => {
      expect(KitDeploymentizer.Deploymentizer).to.be.equal(
        require("../../src/lib/deploymentizer")
      );
    });
  });
});
