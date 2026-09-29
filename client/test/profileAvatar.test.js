import test from "node:test";
import assert from "node:assert/strict";
import { getProfileInitial, getValidAvatarUrl, isProfileAvatarReady } from "../src/utils/profileAvatar.js";

test("accepts valid HTTP and HTTPS avatar URLs", () => {
  assert.equal(getValidAvatarUrl("https://images.example.com/omjee.png"), "https://images.example.com/omjee.png");
  assert.equal(getValidAvatarUrl("http://localhost:5000/riyuu.jpg"), "http://localhost:5000/riyuu.jpg");
});

test("missing, empty, and invalid avatar URLs use the fallback", () => {
  for (const value of [undefined, null, "", "   ", "not a URL", "javascript:alert(1)"]) {
    assert.equal(getValidAvatarUrl(value), "");
  }
  assert.equal(getProfileInitial("Omjee Shukla"), "O");
  assert.equal(getProfileInitial("Riyu"), "R");
});

test("broken images remain on the fallback, while loaded valid images render", () => {
  const url = getValidAvatarUrl("https://images.example.com/member.png");
  assert.equal(isProfileAvatarReady(url, url, ""), true);
  assert.equal(isProfileAvatarReady(url, "", ""), false);
  assert.equal(isProfileAvatarReady(url, url, url), false);
});
