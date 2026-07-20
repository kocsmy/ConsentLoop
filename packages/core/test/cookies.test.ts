import { describe, it, expect, afterEach } from "vitest";
import { getCookie, setCookie, clearCookies } from "../src/cookies";
import { cleanup } from "./helpers";

afterEach(cleanup);

describe("cookies", () => {
  it("set / get roundtrip with encoding", () => {
    setCookie("cl_test", JSON.stringify({ a: ["x"], n: "semi;colon" }));
    expect(JSON.parse(getCookie("cl_test")!)).toEqual({ a: ["x"], n: "semi;colon" });
  });

  it("clearCookies matches exact names, regexes and objects", () => {
    document.cookie = "_ga=1; Path=/";
    document.cookie = "_ga_ABC123=1; Path=/";
    document.cookie = "_gid=1; Path=/";
    document.cookie = "keepme=1; Path=/";
    const cleared = clearCookies([/^_ga/, { name: "_gid" }]);
    expect(cleared.sort()).toEqual(["_ga", "_ga_ABC123", "_gid"]);
    expect(getCookie("keepme")).toBe("1");
    expect(getCookie("_ga")).toBeNull();
    expect(getCookie("_ga_ABC123")).toBeNull();
    expect(getCookie("_gid")).toBeNull();
  });

  it("clearCookies with no matchers is a no-op", () => {
    document.cookie = "x=1; Path=/";
    expect(clearCookies([])).toEqual([]);
    expect(getCookie("x")).toBe("1");
  });
});
