#!/usr/bin/env node
/**
 * fal.ai üzerinden görsel üretir. Bütçe zorunlu, varsayılanı yok.
 *
 * Model ve fiyat, ayrı bir projede kanıtlanmış: fal-ai/flux-pro/v1.1, $0.04/megapiksel.
 * Tahmin değil — bu proje o modeli 30+ kez gerçekten çalıştırıp ölçmüş.
 *
 *   npx tsx scripts/generate.ts --prompt-file scripts/prompts/tinbot-t1-nearmint.txt \
 *     --name tinbot-t1-nearmint --budget 1.00 --dry-run
 *
 *   npx tsx scripts/generate.ts --prompt-file scripts/prompts/tinbot-t1-nearmint.txt \
 *     --name tinbot-t1-nearmint --budget 1.00
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENV_PATH = `${ROOT}scripts/.env`;
const OUT_DIR = `${ROOT}scripts/generated/`;

// -- minik .env yukleyici — dotenv bagimliligi eklemeye gerek yok tek satir icin --
function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv(ENV_PATH);

const MODEL = 'fal-ai/flux-pro/v1.1';
const USD_PER_MEGAPIXEL = 0.04;

const argv = process.argv.slice(2);
const value = (name: string): string | undefined => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};
const dryRun = argv.includes('--dry-run');

const promptFile = value('--prompt-file');
const name = value('--name');
const budgetRaw = value('--budget');
const width = Number(value('--width') ?? '960');
const height = Number(value('--height') ?? '960');

const missing: string[] = [];
if (!promptFile) missing.push('--prompt-file <path>');
if (!name) missing.push('--name <cikti-adi>');
if (!budgetRaw || !Number.isFinite(Number(budgetRaw)) || Number(budgetRaw) <= 0) {
  missing.push('--budget <usd>');
}
if (missing.length > 0) {
  console.error(`REFUSED — eksik: ${missing.join(', ')}`);
  console.error('');
  console.error('usage: npx tsx scripts/generate.ts --prompt-file <path> --name <ad> --budget <usd> [--dry-run]');
  console.error('--budget varsayılan almaz — para harcayan bir araç, tavan her zaman elle söylenir.');
  process.exit(2);
}

const budget = Number(budgetRaw);
if (!existsSync(promptFile!)) {
  console.error(`REFUSED — prompt dosyası yok: ${promptFile}`);
  process.exit(2);
}
const prompt = readFileSync(promptFile!, 'utf8').trim();

const megapixels = Math.ceil((width * height) / 1_000_000);
const cost = megapixels * USD_PER_MEGAPIXEL;

console.log('');
console.log(`model      ${MODEL}`);
console.log(`boyut      ${width}x${height}  (${((width * height) / 1e6).toFixed(2)} MP, ${megapixels} MP olarak faturalanıyor)`);
console.log(`fiyat      $${cost.toFixed(3)}`);
console.log(`bütçe      $${budget.toFixed(2)}`);
console.log('');
console.log(`--- prompt (${promptFile}) ---`);
console.log(prompt);
console.log('---');
console.log('');

if (cost > budget) {
  console.error(`REFUSED — $${cost.toFixed(3)}, $${budget.toFixed(2)} bütçesini aşıyor. Hiçbir şey üretilmedi, hiçbir şey harcanmadı.`);
  process.exit(1);
}

if (dryRun) {
  console.log('dry run — hiçbir şey üretilmedi, hiçbir şey harcanmadı');
  process.exit(0);
}

if (!process.env.FAL_KEY) {
  console.error('REFUSED — ortamda FAL_KEY yok. scripts/.env dosyasını kontrol et.');
  process.exit(2);
}

interface FalImage { url: string; width: number; height: number }

async function fal<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new Error(`fal ${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(): Promise<void> {
  console.log('fal.ai kuyruğuna gönderiliyor...');
  const submitted = await fal<{ status_url: string; response_url: string }>(
    `https://queue.fal.run/${MODEL}`,
    { prompt, image_size: { width, height }, num_images: 1, output_format: 'png' },
  );

  for (let attempt = 0; attempt < 120; attempt++) {
    await sleep(2000);
    const status = await fal<{ status: string }>(submitted.status_url);
    if (status.status === 'COMPLETED') break;
    if (status.status !== 'IN_QUEUE' && status.status !== 'IN_PROGRESS') {
      throw new Error(`fal durumu: ${status.status}`);
    }
    if (attempt === 119) throw new Error('4 dakikada tamamlanmadı');
  }

  const result = await fal<{ images: FalImage[] }>(submitted.response_url);
  const image = result.images[0];
  if (!image) throw new Error('fal hiç görsel döndürmedi');

  mkdirSync(OUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = `${OUT_DIR}${name}-${timestamp}.png`;
  const imgResponse = await fetch(image.url);
  if (!imgResponse.ok) throw new Error(`indirme başarısız: ${imgResponse.status}`);
  writeFileSync(outPath, Buffer.from(await imgResponse.arrayBuffer()));

  console.log('');
  console.log(`Tamamlandı: ${outPath}`);
  console.log(`${image.width}x${image.height}, $${cost.toFixed(3)} harcandı`);
}

run().catch((error) => {
  console.error(`\nBAŞARISIZ: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
