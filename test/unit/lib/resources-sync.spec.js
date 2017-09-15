"use strict";

const expect = require("chai").expect;

let ElroySync;

describe("Sync Cluster Resources", () => {
  before(function(done) {
    ElroySync = require("../../../src/lib/elroy-sync");
    done();
  });
  describe("populate them", () => {
    it("should not populate empty resources object", () => {
      const cluster = {
        resources: {}
      };
      const result = ElroySync.populateResources(cluster.resources);
      expect(result).to.be.empty;
    });
    it("should not populate disable resources", () => {
      const cluster = {
        resources: {
          testDisable: {
            disable: true,
            branch: "develop"
          },
          testActive: {
            disable: false,
            branch: "master"
          },
          testActive2: {
            disable: false,
            branch: "test-pr"
          }
        }
      };
      const expected = {
        testActive: {
          config: {
            branch: "master"
          }
        },
        testActive2: {
          config: {
            branch: "test-pr"
          }
        }
      };

      const result = ElroySync.populateResources(cluster.resources);
      expect(result).to.deep.equal(expected);
    });
  });
  after(function(done) {
    done();
  });
});
