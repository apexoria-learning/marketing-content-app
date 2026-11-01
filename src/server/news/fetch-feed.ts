import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList } from "node:net";

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(network, prefix, "ipv4");

export function validateFeedUrl(raw: string) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new Error("Feeds require public HTTPS endpoints on port 443.");
  return url;
}

export function isPublicFeedAddress(address: string) {
  return (
    /^\d+\.\d+\.\d+\.\d+$/.test(address) && !blocked.check(address, "ipv4")
  );
}

export type FeedValidators = { etag?: string; lastModified?: string };
export type FeedResponse = {
  xml: string | null;
  validators: FeedValidators;
};

function resolveAddresses(hostname: string) {
  return lookup(hostname, { family: 4, all: true });
}

async function fetchOnce(
  raw: string,
  validators: FeedValidators,
  signal: AbortSignal,
  redirects = 0,
): Promise<FeedResponse> {
  const url = validateFeedUrl(raw);
  // Pin the validated IPv4 result so DNS cannot change between check and connect.
  const addresses = await new Promise<
    Awaited<ReturnType<typeof resolveAddresses>>
  >((resolve, reject) => {
    function aborted() {
      reject(new Error("News feed DNS lookup timed out."));
    }
    if (signal.aborted) {
      aborted();
      return;
    }
    signal.addEventListener("abort", aborted, { once: true });
    resolveAddresses(url.hostname)
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener("abort", aborted);
      });
  });
  if (signal.aborted) throw new Error("News feed request timed out.");
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicFeedAddress(address))
  )
    throw new Error("News feed resolved to a non-public address.");
  const address = addresses[0]?.address;
  if (!address) throw new Error("News feed DNS returned no address.");

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        signal,
        family: 4,
        lookup: (_hostname, _options, callback) => callback(null, address, 4),
        headers: {
          "User-Agent": "ApexoriaContentCopilot/1.0",
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
          ...(validators.etag ? { "If-None-Match": validators.etag } : {}),
          ...(validators.lastModified
            ? { "If-Modified-Since": validators.lastModified }
            : {}),
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          const location = response.headers.location;
          response.destroy();
          if (!location || redirects >= 3) {
            reject(new Error("News feed redirect limit exceeded."));
            return;
          }

          // Do not forward conditional metadata to a different redirect target.
          fetchOnce(
            new URL(location, url).href,
            {},
            signal,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if (status === 304) {
          response.destroy();
          resolve({ xml: null, validators });
          return;
        }
        if (status !== 200) {
          response.destroy();
          reject(new Error(`News feed returned HTTP ${status}.`));
          return;
        }
        const limit = 2 * 1024 * 1024;
        if (Number(response.headers["content-length"]) > limit) {
          response.destroy();
          reject(new Error("News feed exceeds the body limit."));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit) {
            response.destroy(new Error("News feed exceeds the body limit."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            xml: Buffer.concat(chunks).toString("utf8"),
            validators: {
              ...(response.headers.etag ? { etag: response.headers.etag } : {}),
              ...(response.headers["last-modified"]
                ? { lastModified: response.headers["last-modified"] }
                : {}),
            },
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function fetchFeed(raw: string, validators: FeedValidators = {}) {
  validateFeedUrl(raw);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetchOnce(raw, validators, AbortSignal.timeout(10000));
    } catch (error) {
      if (attempt === 1) throw error;
      console.warn("News feed fetch failed; retrying once.");
    }
  }
  throw new Error("News feed fetch failed.");
}
