import { Gunzip, Gzip } from "fflate";
it("gzip in slices round-trips with no Worker", () => {
    const data = new Uint8Array(1_000_000).map((_, i) => (i * 7) % 251);
    const parts: Uint8Array[] = [];
    const z = new Gzip(); z.ondata = (d) => { parts.push(d); };
    for (let at = 0; at < data.length; at += 262144) z.push(data.subarray(at, at + 262144), at + 262144 >= data.length);
    const packed = Buffer.concat(parts);
    const out: Uint8Array[] = [];
    const u = new Gunzip(); u.ondata = (d) => { out.push(d); };
    u.push(new Uint8Array(packed), true);
    expect(Buffer.concat(out).equals(Buffer.from(data))).toBe(true);
});
