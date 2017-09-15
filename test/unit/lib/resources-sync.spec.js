"use strict";

const expect = require("chai").expect;

let ElroySync;
let YamlHandler;
let ClusterDefinition;

describe("Sync Cluster Resources", () => {
  before(function(done) {
    ElroySync = require("../../../src/lib/elroy-sync");
    YamlHandler = require("../../../src/util/yaml-handler");
    ClusterDefinition = require("../../../src/lib/cluster-definition");

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

    it("should populate only active resources", () => {
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

    it("should populate all the properties for resources", () => {
      const cluster = {
        resources: {
          app: {
            disable: false,
            branch: "master"
          },
          cfprojects: {
            disable: false,
            branch: "master",
            containers: {
              cfprojects: {
                roleType: "default"
              }
            }
          },
          ingress: {
            kind: "ingress",
            file: "./ingress/ingress-internal.mustache"
          }
        }
      };
      const expected = {
        app: {
          config: {
            branch: "master"
          }
        },
        cfprojects: {
          config: {
            branch: "master",
            containers: {
              cfprojects: {
                roleType: "default"
              }
            }
          }
        },
        ingress: {
          config: {
            kind: "ingress",
            file: "./ingress/ingress-internal.mustache"
          }
        }
      };

      const result = ElroySync.populateResources(cluster.resources);
      expect(result).to.deep.equal(expected);
    });
  });

  it("should populate cluster with resources from cluster definition", () => {
    const baseConfig = {
      kind: "ResourceConfig",
      env: [{ name: "c", value: 4 }]
    };
    const resource = {
      auth: {
        branch: "develop",
        svc: {
          name: "auth-svc"
        },
        containers: {}
      }
    };

    const clusterBase = {
      kind: "ClusterNamespace",
      metadata: { name: "base", type: "develop" },
      resources: [resource]
    };
    const cluster = new ClusterDefinition(clusterBase, baseConfig);
    expect(cluster.resources()).to.deep.equal([resource]);

    const expectedResource = { config: resource };

    const result = ElroySync.populateCluster(cluster);
    expect(result.resources[0]).to.deep.equal(expectedResource);
  });
  after(function(done) {
    done();
  });
});
