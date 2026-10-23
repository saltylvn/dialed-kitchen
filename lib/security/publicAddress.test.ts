import { describe, expect, it } from "vitest";
import { isPublicAddress } from "./publicAddress";

describe("isPublicAddress", () => {
  it("allows ordinary public addresses", () => {
    for (const ip of [
      "8.8.8.8",
      "151.101.1.69",
      "104.16.0.1",
      "2606:4700::6810:84e5",
      "2a00:1450:4001::200e",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it("refuses private, local, cloud-internal and reserved addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata service
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "::",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "2001:db8::1",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("isn't fooled by an IPv4 address written as IPv6", () => {
    expect(isPublicAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicAddress("::ffff:10.0.0.1")).toBe(false);
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicAddress("64:ff9b::7f00:1")).toBe(false); // NAT64 form of 127.0.0.1
    expect(isPublicAddress("2002:7f00:1::")).toBe(false); // 6to4 form of 127.0.0.1
  });

  it("refuses anything that isn't an IP address", () => {
    for (const value of ["localhost", "example.com", "", "1.2.3", "01.02.03.04"]) {
      expect(isPublicAddress(value), value).toBe(false);
    }
  });
});
