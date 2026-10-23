import { BlockList, isIP } from "node:net";

// Is this IP address on the public internet? The recipe importer only ever connects to
// public addresses, so a link can't make our server reach private networks, the machine
// itself, or cloud-internal services (server-side request forgery, SSRF).

const BLOCKED = new BlockList();
const v4 = (net: string, prefix: number) => BLOCKED.addSubnet(net, prefix, "ipv4");
const v6 = (net: string, prefix: number) => BLOCKED.addSubnet(net, prefix, "ipv6");

v4("0.0.0.0", 8); // "this network"
v4("10.0.0.0", 8); // private
v4("100.64.0.0", 10); // carrier-grade NAT
v4("127.0.0.0", 8); // loopback (this machine)
v4("169.254.0.0", 16); // link-local, incl. cloud metadata 169.254.169.254
v4("172.16.0.0", 12); // private
v4("192.0.0.0", 24); // IETF protocol assignments
v4("192.0.2.0", 24); // documentation
v4("192.88.99.0", 24); // 6to4 relay
v4("192.168.0.0", 16); // private (home networks)
v4("198.18.0.0", 15); // benchmarking
v4("198.51.100.0", 24); // documentation
v4("203.0.113.0", 24); // documentation
v4("224.0.0.0", 4); // multicast
v4("240.0.0.0", 4); // reserved, incl. broadcast 255.255.255.255

v6("::", 128); // unspecified
v6("::1", 128); // loopback
v6("64:ff9b::", 96); // NAT64 (embeds an IPv4 address)
v6("64:ff9b:1::", 48); // local NAT64
v6("100::", 64); // discard
v6("2001::", 23); // IETF protocol assignments (incl. Teredo)
v6("2001:db8::", 32); // documentation
v6("2002::", 16); // 6to4 (embeds an IPv4 address)
v6("fc00::", 7); // unique local (private)
v6("fe80::", 10); // link-local
v6("ff00::", 8); // multicast

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return !BLOCKED.check(address, "ipv4");
  if (version === 6) {
    // An IPv4 address written as IPv6 (::ffff:10.0.0.1) is judged as that IPv4 address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return isPublicAddress(mapped[1]!);
    return !BLOCKED.check(address, "ipv6");
  }
  return false; // not an IP address at all
}
