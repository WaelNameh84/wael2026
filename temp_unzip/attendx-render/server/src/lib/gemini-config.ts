import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const CONFIG_PATH = path.resolve(process.cwd(), "gemini-config.json");

interface GeminiConfig {
  apiKey?: string;
  appName?: string;
  appLogo?: string;
  workStartTime?: string;
  lateGraceMinutes?: number;
}

function readConfig(): GeminiConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config: GeminiConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

export function getGeminiApiKey(): string | undefined {
  const config = readConfig();
  return config.apiKey || process.env.GEMINI_API_KEY;
}

export function getGeminiKeySource(): "file" | "env" | "none" {
  const config = readConfig();
  if (config.apiKey) return "file";
  if (process.env.GEMINI_API_KEY) return "env";
  return "none";
}

export function saveGeminiApiKey(key: string): void {
  const config = readConfig();
  writeConfig({ ...config, apiKey: key });
}

export function clearGeminiApiKey(): void {
  const config = readConfig();
  const { apiKey: _, ...rest } = config;
  writeConfig(rest);
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••••••••••" + key.slice(-4);
}

export function getAppName(): string {
  return readConfig().appName ?? "AttendX";
}

export function saveAppName(name: string): void {
  const config = readConfig();
  writeConfig({ ...config, appName: name });
}

export function getAppLogo(): string {
  return readConfig().appLogo ?? "";
}

export function saveAppLogo(logo: string): void {
  const config = readConfig();
  writeConfig({ ...config, appLogo: logo });
}

/** workStartTime stored as "HH:MM" UTC, default "09:00" */
export function getWorkStartTime(): string {
  return readConfig().workStartTime ?? "09:00";
}

export function saveWorkStartTime(time: string): void {
  const config = readConfig();
  writeConfig({ ...config, workStartTime: time });
}

/** Grace period in minutes after work start before marking late, default 15 */
export function getLateGraceMinutes(): number {
  return readConfig().lateGraceMinutes ?? 15;
}

export function saveLateGraceMinutes(minutes: number): void {
  const config = readConfig();
  writeConfig({ ...config, lateGraceMinutes: minutes });
}

/** Returns the late threshold in total minutes from midnight UTC */
export function getLateThresholdMinutes(): number {
  const [hh, mm] = getWorkStartTime().split(":").map(Number);
  return hh * 60 + mm + getLateGraceMinutes();
}
