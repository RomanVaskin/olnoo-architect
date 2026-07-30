import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRouterImages } from "./router-provider";

test("labels the primary edit target separately from reference-only views", () => {
  const images = buildRouterImages([
    { data: Buffer.from([1]), mimeType: "image/jpeg", role: "front", purpose: "primary" },
    { data: Buffer.from([2]), mimeType: "image/png", role: "side", purpose: "reference" },
  ]);

  assert.equal(images.length, 2);
  assert.match(images[0].label, /PRIMARY EDIT TARGET/);
  assert.match(images[1].label, /REFERENCE CONTEXT ONLY/);
  assert.match(images[1].label, /Do not use this camera angle/);
});

test("uses explicit correction labels verbatim when the correction route supplies them", () => {
  const labels = ["GENERATED CONCEPT", "ORIGINAL PRIMARY"];
  const images = buildRouterImages([
    { data: Buffer.from([1]), mimeType: "image/png", role: "other", purpose: "correction-target" },
    { data: Buffer.from([2]), mimeType: "image/png", role: "front", purpose: "primary" },
  ], labels);
  assert.equal(images[0].label, labels[0]);
  assert.equal(images[1].label, labels[1]);
});
