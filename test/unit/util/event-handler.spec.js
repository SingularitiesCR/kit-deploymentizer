"use strict";

var expect = require("chai").expect;
const Promise = require("bluebird");


describe("EventHandler", () =>  {

  // Skip these, other tests log to events causing these to fail when run as a group
	describe.skip("Load", () =>  {

		it("Should load the handler", () => {
      const eventHandler = require("../../../src/util/event-handler");
			expect(eventHandler).to.exist;
		});

		it("should fire events", (done) => {
      const TEST_MSG = "Test my message";
      const EventHandler = require("../../../src/util/event-handler");
      expect(EventHandler.INFO).to.exist;
      expect(EventHandler.WARN).to.exist;
      expect(EventHandler.FATAL).to.exist;
			const eventHandler = new EventHandler();
      eventHandler.on(eventHandler.INFO, function(message) {
      	expect(message).to.equal(TEST_MSG);
        done();
      });
      eventHandler.emitInfo(TEST_MSG);
		});

		it("should fire any event", (done) => {
      const TEST_MSG = "Test my message 2";
      const EventHandler = require("../../../src/util/event-handler");
			const eventHandler = new EventHandler();
      eventHandler.on("myEvent", function(message) {
      	expect(message).to.equal(TEST_MSG);
        done();
      });
      eventHandler.emit("myEvent", TEST_MSG);
		})

		it("should remove any listeners registered", (done) => {
      const TEST_MSG = "Test my message";
      const EventHandler = require("../../../src/util/event-handler");
			const eventHandler = new EventHandler();
      eventHandler.on("myEvent", (message) => {
				console.log("Event Called: %s", message);
      });
      eventHandler.on("myEvent", (message) => {
				console.log("Another Event Called: %s", message);
      });
      eventHandler.on("myEvent2", (message) => {
				console.log("Event2 Called: %s", message);
      });

			expect(eventHandler.listenerCount("myEvent")).to.equal(2);
			expect(eventHandler.listenerCount("myEvent2")).to.equal(1);
			eventHandler.clearListeners();

			expect(eventHandler.listenerCount("myEvent")).to.equal(0);
			expect(eventHandler.listenerCount("myEvent2")).to.equal(0);
			done();
		});;

	});

});
