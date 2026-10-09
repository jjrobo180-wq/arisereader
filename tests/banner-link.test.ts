// A site banner can carry a link to a page on this site, so tapping it opens that page.
// Run with: npx tsx --test tests/banner-link.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BANNER_LINK_MAX, bannerHref, cleanBannerLink, withBannerLink } from "../shared/banners";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("a banner's link is a page on this site, however it was typed", () => {
  for (const typed of ["/fall-break", "fall-break", "#/fall-break", "/#/fall-break", "  /fall-break  ", "https://www.arisereader.com/#/fall-break", "http://arisereader.com/#/fall-break", "HTTPS://WWW.ARISEREADER.COM/#/fall-break"]) assert.equal(cleanBannerLink(typed), "/fall-break", typed);
  assert.equal(cleanBannerLink("/competition"), "/competition");
  assert.equal(cleanBannerLink("/parent-signup?code=AB12-CD34"), "/parent-signup?code=AB12-CD34");
  assert.equal(cleanBannerLink("/reads/42"), "/reads/42");
  assert.equal(bannerHref("https://www.arisereader.com/#/fall-break"), "#/fall-break");
  assert.equal(bannerHref(""), "");
});

test("anything that is not a page on this site is not a link", () => {
  for (const bad of ["", "   ", null, undefined, "https://example.com/win", "//example.com", "/a//b", "javascript:alert(1)", "/javascript:alert(1)", "https://www.arisereader.com.evil.example/#/x", "/fall break", "/<script>", "/x\"onclick=\"y", "mailto:a@b.com", "/" , `/${"a".repeat(BANNER_LINK_MAX)}`]) {
    assert.equal(cleanBannerLink(bad), "", String(bad));
    assert.equal(bannerHref(bad), "", String(bad));
  }
});

test("a banner is saved with its link only when it has a real one", () => {
  const banner = { text: "Fall Break Competition", bgColor: "#22c55e", textColor: "#ffffff", active: true };
  assert.deepEqual(withBannerLink(banner, "https://www.arisereader.com/#/fall-break"), { ...banner, link: "/fall-break" });
  assert.deepEqual(withBannerLink(banner, ""), banner);
  assert.deepEqual(withBannerLink(banner, "https://example.com"), banner, "a link to another site is dropped, and the banner is still saved");
  assert.equal("link" in withBannerLink(banner, undefined), false);
});

test("every banner can be tapped, and the admin can set where it goes", () => {
  const routes = read("server/routes.ts"), tap = read("client/src/components/BannerTap.tsx"), admin = read("client/src/pages/Admin.tsx");
  assert.equal(routes.split("withBannerLink({ text: text || ''").length - 1, 3, "the login, student and teacher banners all keep a link");
  for (const part of ["bannerHref(link)", 'data-testid="banner-link"', "<a href={href}", "Open ›"]) assert.ok(tap.includes(part), part);
  assert.ok(read("client/src/pages/Login.tsx").includes("<BannerTap link={loginBanner.link}"));
  const library = read("client/src/pages/Library.tsx");
  assert.ok(library.includes("<BannerTap link={studentBanner.link}") && library.includes("<BannerTap link={teacherBanner.link}"));
  assert.equal(library.split("</BannerTap>").length - 1, 2);
  assert.ok(read("client/src/pages/TeacherDashboard.tsx").includes("<BannerTap link={teacherBanner.link}"));
  for (const name of ["studentBanner", "teacherBanner", "loginBanner"]) assert.ok(admin.includes(`data-testid="${name}-link"`), name);
});
