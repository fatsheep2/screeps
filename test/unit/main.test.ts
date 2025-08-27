import {assert} from "chai";

describe("main", () => {
  before(() => {
    // runs before all test in this block
  });

  beforeEach(() => {
    // runs before each test in this block
  });

  it("should have basic test setup", () => {
    assert.isTrue(true);
  });

  it("should be able to run simple tests", () => {
    const result = 1 + 1;
    assert.equal(result, 2);
  });
});
