#!/usr/bin/env -S npx tsx

import { getInput } from "@actions/core";

const siteUrlInput = getInput("site-url", { required: true, trimWhitespace: true }) ?? process.env.SITE_URL;
const SITE_URL = siteUrlInput || "";
const wordpressInput = getInput("wordpress", { required: false, trimWhitespace: true }) ?? process.env.IS_WORDPRESS;
const IS_WORDPRESS = wordpressInput.toLowerCase() === "true";
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 5000;
const USER_AGENT = "CheckStatus-Monitor/2.0";

const wordpressErrors = [
  { pattern: /error establishing a database connection/i, message: "Database connection error" },
  { pattern: /briefly unavailable for scheduled maintenance/i, message: "Maintenance mode detected" },
  { pattern: /fatal error/i, message: "WordPress fatal error" }
];

if (!SITE_URL) {
  core.setFailed("SITE_URL not set");
  process.exit(1);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidError(err: unknown): err is { message: string } {
  return (!!err && typeof err === 'object' && ('message' in err) && err.message && typeof err.message === 'string')
}

async function fetchWithRetry(url: string): Promise<Response> {
  let delay = INITIAL_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.info(`Attempt ${attempt}/${MAX_RETRIES}...`);
      const res = await fetch(url, {  headers: { "User-Agent": USER_AGENT } });

      if (!res.ok) throw new Error(`Website is down. HTTP status code: ${res.status}`);
      return res;
    } catch (err: unknown) {
      if (!isValidError(err)) {
        throw new Error(`Unhandled Error: ${err}`)
      }
      const { message } = err
      if (message.includes("SSL") || message.includes("timeout") || message.includes("ETIMEDOUT")) {
        console.warn(`⚠️ Transient error (${message}) — retrying in ${delay / 1000}s`);
        await sleep(delay);
        delay *= 2;
      } else {
        throw new Error(`Non-retryable error: ${message}`);
      }
    }
  }
  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES} retries`);
}

const checkStatus = async () => {
  console.info(`Checking ${SITE_URL}...`);
  const res = await fetchWithRetry(SITE_URL);

  if (IS_WORDPRESS) {
    console.info("Checking for WordPress-specific errors...");
    const body = await res.text();
    for (const { pattern, message } of wordpressErrors) {
      if (pattern.test(body)) {
        throw new Error(message);
      }
    }
  }

  console.info(`✅ ${SITE_URL} is up! (HTTP ${res.status})`);
}

checkStatus().catch(err => {
  const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
  core.setFailed(message);
})
