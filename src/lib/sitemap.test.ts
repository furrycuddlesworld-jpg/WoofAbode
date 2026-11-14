import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { expect, it } from "vitest";
import { sitemapStaticPaths, sitemapXML } from "./sitemap";

it("includes the public login but excludes redirects, recovery and private descendants", () => {
  const root = createRootRoute({ staticData: { sitemap: false } });
  const login = createRoute({ getParentRoute: () => root, path: "/login", staticData: { sitemap: true } });
  const index = createRoute({ getParentRoute: () => root, path: "/", staticData: { sitemap: false } });
  const reset = createRoute({ getParentRoute: () => root, path: "/reset-password", staticData: { sitemap: false } });
  const privateLayout = createRoute({ getParentRoute: () => root, id: "_authed", staticData: { sitemap: "exclude-subtree" } });
  const admin = createRoute({ getParentRoute: () => privateLayout, path: "/admin", staticData: { sitemap: true } });
  const router = createRouter({ routeTree: root.addChildren([login, index, reset, privateLayout.addChildren([admin])]) });
  expect(sitemapStaticPaths(router)).toEqual(["/login"]);
});

it("uses the public domain without invented last-modified timestamps", () => {
  expect(sitemapXML("https://woofabode.com", [{ path: "/login" }])).toBe('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://woofabode.com/login</loc></url></urlset>');
});