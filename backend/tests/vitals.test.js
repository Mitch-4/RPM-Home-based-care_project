// tests/vitals.test.js
const request = require("supertest");
const app = require("../index"); // assuming index.js exports the app

describe("Vitals API", () => {
  it("should reject unauthenticated device", async () => {
    const res = await request(app)
      .post("/api/v1/vitals/123")
      .send({ heartRate: 80, breathingRate: 18 });
    expect(res.statusCode).toBe(401);
  });
});
