import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const services = JSON.parse(
  await readFile(
    fileURLToPath(new URL("../config/service-pages.json", import.meta.url)),
    "utf8",
  ),
);
export function campaignUrl({ service, source = "google", campaign, content }) {
  if (!services.some((item) => item.slug === service))
    throw new Error("Choose an approved service slug.");
  const safe = (value) =>
    typeof value === "string" &&
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) &&
    value.length <= 80 &&
    !/email|phone|customer|person|@|\d{7,}/.test(value);
  if (!safe(source) || !safe(campaign) || (content && !safe(content)))
    throw new Error(
      "Use short lowercase campaign slugs; never names, emails, phone numbers or customer IDs.",
    );
  const url = new URL(
    `/services/${service}/`,
    "https://www.justinjindustries.com",
  );
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "cpc");
  url.searchParams.set("utm_campaign", campaign);
  if (content) url.searchParams.set("utm_content", content);
  return url.href;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , service, campaign, content] = process.argv;
  if (!service || !campaign)
    throw new Error(
      "Usage: npm run campaign:url -- website-development jji-web-redesign-boston-review [creative-a]. This only prints a URL; it launches nothing.",
    );
  console.log(campaignUrl({ service, campaign, content }));
}
