import test from "node:test";
import assert from "node:assert/strict";
import { hasConservativePartialTitleMatch, normalizeTitleForMatch } from "./title-taxonomy";

test("normalizes approved punctuation-equivalent role-title forms", () => {
  assert.equal(normalizeTitleForMatch("Front-End Engineer"), normalizeTitleForMatch("Frontend Engineer"));
  assert.equal(normalizeTitleForMatch("Back End Engineer"), normalizeTitleForMatch("Backend Engineer"));
  assert.equal(normalizeTitleForMatch("Full-Stack Engineer"), normalizeTitleForMatch("Fullstack Engineer"));
  assert.equal(normalizeTitleForMatch("NodeJS Developer"), normalizeTitleForMatch("Node.js Developer"));
});

test("does not classify technology aliases as complete role-title aliases", () => {
  assert.notEqual(normalizeTitleForMatch("NodeJS"), normalizeTitleForMatch("Node.js Developer"));
});

test("blocks known unsafe title collisions", () => {
  assert.equal(hasConservativePartialTitleMatch("Java Engineer", "JavaScript Engineer"), false);
  assert.equal(hasConservativePartialTitleMatch("Product Manager", "Product Designer"), false);
  assert.equal(hasConservativePartialTitleMatch("Data Engineer", "Data Analyst"), false);
  assert.equal(hasConservativePartialTitleMatch("Frontend Engineer", "Full-stack Engineer"), false);
});

