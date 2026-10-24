/** User-agent strings, parsed with ua-parser-js into plain data (browser, engine, OS, device, CPU). */
import { UAParser } from "ua-parser-js";
import { isAIAssistant, isAICrawler, isBot } from "ua-parser-js/bot-detection";
import {
  Bots,
  CLIs,
  Crawlers,
  Emails,
  ExtraDevices,
  Fetchers,
  InApps,
  Libraries,
  MediaPlayers,
} from "ua-parser-js/extensions";
import { isFrozenUA } from "ua-parser-js/helpers";

export interface ParsedUA {
  browser: { name: string; version: string; major: string; type: string };
  engine: { name: string; version: string };
  os: { name: string; version: string };
  device: { type: string; vendor: string; model: string };
  cpu: { architecture: string };
  bot: boolean;
  aiBot: boolean;
  /** Chrome's reduced UA: the OS version and device model are frozen placeholders. */
  frozen: boolean;
}

/** The extensions recognize crawlers, fetchers, CLIs (curl, wget), libraries, in-app browsers. */
const EXTENSIONS = [
  Bots,
  Crawlers,
  Fetchers,
  CLIs,
  Libraries,
  InApps,
  Emails,
  MediaPlayers,
  ExtraDevices,
].flat();

/** Parses a user-agent string. Fields ua-parser-js cannot tell are "" (never throws). */
export function parseUA(ua: string): ParsedUA {
  const s = ua.trim();
  const r = UAParser(s, EXTENSIONS);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  let bot = false;
  let aiBot = false;
  let frozen = false;
  try {
    bot = isBot(r);
    aiBot = isAICrawler(r) || isAIAssistant(r);
    frozen = s ? isFrozenUA(s) : false;
  } catch {}
  return {
    browser: {
      name: str(r.browser.name),
      version: str(r.browser.version),
      major: str(r.browser.major),
      type: str(r.browser.type),
    },
    engine: { name: str(r.engine.name), version: str(r.engine.version) },
    os: { name: str(r.os.name), version: str(r.os.version) },
    device: { type: str(r.device.type), vendor: str(r.device.vendor), model: str(r.device.model) },
    cpu: { architecture: str(r.cpu.architecture) },
    bot,
    aiBot,
    frozen,
  };
}

/** A few user agents to try the parser on (labels are product names, the same in every language). */
export const SAMPLES: { id: string; label: string; ua: string }[] = [
  {
    id: "chrome-windows",
    label: "Chrome · Windows",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  {
    id: "safari-iphone",
    label: "Safari · iPhone",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    id: "chrome-android",
    label: "Chrome · Android",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.81 Mobile Safari/537.36",
  },
  {
    id: "firefox-linux",
    label: "Firefox · Linux",
    ua: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  },
  {
    id: "safari-mac",
    label: "Safari · macOS",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  },
  {
    id: "edge-windows",
    label: "Edge · Windows",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  },
  {
    id: "samsung-tablet",
    label: "Samsung Internet · Galaxy Tab",
    ua: "Mozilla/5.0 (Linux; Android 13; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Safari/537.36",
  },
  {
    id: "googlebot",
    label: "Googlebot",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  },
  {
    id: "gptbot",
    label: "GPTBot",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  },
  { id: "curl", label: "curl", ua: "curl/8.7.1" },
];
