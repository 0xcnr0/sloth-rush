#!/usr/bin/env node
/**
 * Meshy üzerinden 3D model üretir. Kredi bütçesi zorunlu, varsayılanı yok.
 *
 * generate.ts ile aynı sözleşme: para (burada kredi) harcayan bir araç,
 * tavan her zaman elle söylenir, --dry-run her zaman ücretsizdir.
 *
 * Harcama TAHMİN EDİLMEZ, ÖLÇÜLÜR: her koşunun başında ve sonunda Meshy
 * bakiyesi okunur, rapor edilen sayı ikisinin farkıdır.
 *
 *   npx tsx scripts/meshy.ts balance
 *
 *   npx tsx scripts/meshy.ts pipeline \
 *     --prompt-file scripts/prompts/tinbot-t1-nearmint-3d.txt \
 *     --texture-file scripts/prompts/tinbot-t1-nearmint-3d-texture.txt \
 *     --name tinbot-t1-nearmint --budget 40 --dry-run
 *
 * Adımlar ayrı ayrı da çalıştırılabilir (preview / refine / rig / status / download).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENV_PATH = `${ROOT}scripts/.env`;
const OUT_ROOT = `${ROOT}scripts/generated/3d/`;

// -- generate.ts ile aynı minik .env yukleyici --
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

const API = 'https://api.meshy.ai';

// Meshy'nin resmi MCP sunucusunun ilan ettiği kredi tablosu (@meshy-ai/meshy-mcp-server 0.4.0).
// Aralık verilen yerlerde bütçe kontrolü ÜST sınıra göre yapılır — bütçe aşılmasın diye
// kötümser davranıyoruz. Gerçek harcama koşu sonunda bakiyeden ölçülüp yazdırılıyor.
const COST = {
  preview: { min: 5, max: 20, label: 'text-to-3d (preview mesh)' },
  refine: { min: 10, max: 10, label: 'text-to-3d refine (doku)' },
  rig: { min: 5, max: 5, label: 'rig (+ ücretsiz walk/run animasyonu)' },
  refimage: { min: 9, max: 9, label: 'text-to-image (nano-banana-pro, çok görünüşlü)' },
  image: { min: 3, max: 9, label: 'text-to-image (tek görsel)' },
  // MCP sunucusunun şeması "meshy-6 = 20 kredi" diyor ama ölçtük: 2026-08-05'te
  // 9 + 20 beklenirken 39 kredi düştü. Gerçek maliyet 30'a kadar çıkıyor
  // (kredi tablosunun image_to_3d için verdiği 5-30 aralığıyla uyumlu).
  // Bütçe koruyucusu ölçülen üst sınırı kullanmalı, ilan edileni değil.
  image3d: { min: 20, max: 30, label: 'multi-image-to-3d (meshy-6, dokulu)' },
} as const;

const argv = process.argv.slice(2);
const command = argv[0];
const value = (name: string): string | undefined => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};
const dryRun = argv.includes('--dry-run');

function die(message: string, code = 2): never {
  console.error(`REFUSED — ${message}`);
  process.exit(code);
}

function usage(): never {
  console.error('usage: npx tsx scripts/meshy.ts <komut> [seçenekler]');
  console.error('');
  console.error('  balance                                   kredi bakiyesi (ücretsiz)');
  console.error('  status   --task <id> [--kind text|rig]    görev durumu (ücretsiz)');
  console.error('  refpipeline --prompt-file <p> --name <ad> --budget <kredi>   [ÖNERİLEN]');
  console.error('           referans görsel → multi-image-to-3d → rig');
  console.error('           [--no-rig] [--polycount <n>] [--dry-run]');
  console.error('  pipeline --prompt-file <p> --name <ad> --budget <kredi> [--texture-file <p>]');
  console.error('           metinden doğrudan 3D — anahtar/anten sorunları var, refpipeline tercih et');
  console.error('           [--no-rig] [--polycount <n>] [--dry-run]');
  console.error('  preview  --prompt-file <p> --name <ad> --budget <kredi> [--dry-run]');
  console.error('  refine   --task <id> --name <ad> --budget <kredi> [--texture-file <p>] [--dry-run]');
  console.error('  rig      --task <id> --name <ad> --budget <kredi> [--height <m>] [--dry-run]');
  console.error('');
  console.error('--budget varsayılan almaz — kredi harcayan bir araç, tavan her zaman elle söylenir.');
  process.exit(2);
}

function requireKey(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key) die('ortamda MESHY_API_KEY yok. scripts/.env dosyasını kontrol et.');
  return key;
}

async function meshy<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new Error(`meshy ${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function balance(): Promise<number> {
  const { balance } = await meshy<{ balance: number }>('/openapi/v1/balance');
  return balance;
}

interface Task {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress?: number;
  task_error?: { message?: string };
  model_urls?: Record<string, string | undefined>;
  image_urls?: string[];
  thumbnail_url?: string;
  result?: {
    rigged_character_glb_url?: string;
    rigged_character_fbx_url?: string;
    basic_animations?: Record<string, string | undefined>;
  };
}

const ENDPOINT = {
  text: '/openapi/v2/text-to-3d',
  rig: '/openapi/v1/rigging',
  image: '/openapi/v1/text-to-image',
  image2image: '/openapi/v1/image-to-image',
  multi: '/openapi/v1/multi-image-to-3d',
} as const;

/** Bir görev bitene kadar bekler. Meshy tarafında 3D üretimi dakikalar sürebiliyor. */
async function waitFor(kind: keyof typeof ENDPOINT, id: string, label: string): Promise<Task> {
  const deadline = Date.now() + 20 * 60_000;
  let last = -1;
  while (Date.now() < deadline) {
    const task = await meshy<Task>(`${ENDPOINT[kind]}/${id}`);
    if (task.progress !== undefined && task.progress !== last) {
      last = task.progress;
      process.stdout.write(`\r  ${label}  %${String(task.progress).padStart(3)}   `);
    }
    if (task.status === 'SUCCEEDED') {
      process.stdout.write(`\r  ${label}  %100  tamam\n`);
      return task;
    }
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      process.stdout.write('\n');
      throw new Error(`${label} ${task.status}: ${task.task_error?.message ?? 'sebep bildirilmedi'}`);
    }
    await sleep(5000);
  }
  throw new Error(`${label} 20 dakikada bitmedi (görev id: ${id})`);
}

/** Bir görevden çıkan tüm dosyaları scripts/generated/3d/<ad>/ altına indirir. */
async function download(task: Task, name: string, stage: string): Promise<string[]> {
  const dir = `${OUT_ROOT}${name}/`;
  mkdirSync(dir, { recursive: true });

  const targets: Array<[string, string]> = [];
  for (const [format, url] of Object.entries(task.model_urls ?? {})) {
    if (url) targets.push([`${stage}.${format}`, url]);
  }
  if (task.result?.rigged_character_glb_url) targets.push([`${stage}.glb`, task.result.rigged_character_glb_url]);
  if (task.result?.rigged_character_fbx_url) targets.push([`${stage}.fbx`, task.result.rigged_character_fbx_url]);
  // Anahtarlar `walking_glb_url` / `running_fbx_url` biçiminde geliyor —
  // dosya adına ham hâliyle yazmak "walking_glb_url.glb" gibi çirkin sonuç veriyor.
  for (const [key, url] of Object.entries(task.result?.basic_animations ?? {})) {
    if (!url) continue;
    const match = /^(.+?)_(glb|fbx|armature_glb)_url$/.exec(key);
    const [move, ext] = match ? [match[1], match[2] === 'fbx' ? 'fbx' : 'glb'] : [key, 'glb'];
    const suffix = match?.[2] === 'armature_glb' ? '-armature' : '';
    targets.push([`${stage}-${move}${suffix}.${ext}`, url]);
  }
  // text-to-image görevleri model değil görsel döndürüyor
  task.image_urls?.forEach((url, i) => targets.push([`${stage}-view${i + 1}.png`, url]));
  if (task.thumbnail_url) targets.push([`${stage}-thumb.png`, task.thumbnail_url]);

  const written: string[] = [];
  for (const [filename, url] of targets) {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  uyarı — indirilemedi ${filename}: ${response.status}`);
      continue;
    }
    const outPath = `${dir}${filename}`;
    writeFileSync(outPath, Buffer.from(await response.arrayBuffer()));
    written.push(outPath);
  }
  return written;
}

// Meshy sunucu tarafında reddediyor (400). Burada da kontrol ediyoruz ki hata
// ağa çıkmadan, net bir mesajla ve karakter sayısıyla birlikte görünsün.
const PROMPT_LIMIT = 800;

function readPrompt(flag: string, path: string | undefined, required: boolean): string | undefined {
  if (!path) {
    if (required) die(`eksik: ${flag} <path>`);
    return undefined;
  }
  if (!existsSync(path)) die(`prompt dosyası yok: ${path}`);
  const prompt = readFileSync(path, 'utf8').trim();
  if (prompt.length > PROMPT_LIMIT) {
    die(`${path} ${prompt.length} karakter — Meshy sınırı ${PROMPT_LIMIT}. ${prompt.length - PROMPT_LIMIT} karakter kısalt.`);
  }
  return prompt;
}

function checkBudget(steps: Array<keyof typeof COST>, budgetRaw: string | undefined): number {
  if (!budgetRaw || !Number.isFinite(Number(budgetRaw)) || Number(budgetRaw) <= 0) {
    die('eksik: --budget <kredi>');
  }
  const budget = Number(budgetRaw);
  const worst = steps.reduce((sum, step) => sum + COST[step].max, 0);
  const best = steps.reduce((sum, step) => sum + COST[step].min, 0);

  console.log('');
  console.log('plan');
  for (const step of steps) {
    const { min, max, label } = COST[step];
    console.log(`  ${label.padEnd(38)} ${min === max ? `${min}` : `${min}-${max}`} kredi`);
  }
  console.log(`  ${'toplam (en kötü ihtimal)'.padEnd(38)} ${best === worst ? `${best}` : `${best}-${worst}`} kredi`);
  console.log(`  ${'bütçe'.padEnd(38)} ${budget} kredi`);
  console.log('');

  if (worst > budget) {
    console.error(
      `REFUSED — en kötü ihtimalle ${worst} kredi, ${budget} kredi bütçesini aşıyor. ` +
        'Hiçbir şey üretilmedi, hiçbir kredi harcanmadı.',
    );
    process.exit(1);
  }
  return budget;
}

// -- komutlar ---------------------------------------------------------------

async function cmdBalance(): Promise<void> {
  console.log(`Meshy bakiyesi: ${await balance()} kredi`);
}

async function cmdStatus(): Promise<void> {
  const id = value('--task') ?? die('eksik: --task <id>');
  const kind = (value('--kind') ?? 'text') as keyof typeof ENDPOINT;
  const task = await meshy<Task>(`${ENDPOINT[kind]}/${id}`);
  console.log(`${task.id}  ${task.status}  %${task.progress ?? 0}`);
  if (task.task_error?.message) console.log(`hata: ${task.task_error.message}`);
  for (const [format, url] of Object.entries(task.model_urls ?? {})) {
    if (url) console.log(`  ${format}: ${url.slice(0, 90)}...`);
  }
}

async function cmdPipeline(): Promise<void> {
  const name = value('--name') ?? die('eksik: --name <ad>');
  const prompt = readPrompt('--prompt-file', value('--prompt-file'), true)!;
  const texturePrompt = readPrompt('--texture-file', value('--texture-file'), false);
  const polycount = Number(value('--polycount') ?? '30000');
  const withRig = !argv.includes('--no-rig');

  const steps: Array<keyof typeof COST> = withRig ? ['preview', 'refine', 'rig'] : ['preview', 'refine'];
  checkBudget(steps, value('--budget'));

  console.log(`--- geometri promptu (${value('--prompt-file')}) ---`);
  console.log(prompt);
  if (texturePrompt) {
    console.log(`--- doku promptu (${value('--texture-file')}) ---`);
    console.log(texturePrompt);
  }
  console.log('---');
  console.log('');

  if (dryRun) {
    console.log('dry run — hiçbir şey üretilmedi, hiçbir kredi harcanmadı');
    return;
  }

  const before = await balance();
  console.log(`başlangıç bakiyesi: ${before} kredi`);
  console.log('');

  // 1) preview mesh — dokusuz geometri
  console.log('1/3  preview mesh üretiliyor (text-to-3d)...');
  const preview = await meshy<{ result: string }>(ENDPOINT.text, {
    mode: 'preview',
    prompt,
    ai_model: 'meshy-6',
    topology: 'quad',
    target_polycount: polycount,
    should_remesh: true,
    pose_mode: 't-pose', // rig için şart — Meshy'nin kendi rig senaryosunun ilk kuralı
    target_formats: ['glb', 'fbx'],
    moderation: false,
  });
  const previewTask = await waitFor('text', preview.result, 'preview');
  console.log(`  preview task: ${preview.result}`);
  console.log(`  ${(await download(previewTask, name, '1-preview')).length} dosya indirildi`);

  // 2) refine — dokuyu bas. Rarity (Near Mint = krom) burada belirleniyor.
  console.log('');
  console.log('2/3  doku basılıyor (refine)...');
  const refine = await meshy<{ result: string }>(ENDPOINT.text, {
    mode: 'refine',
    preview_task_id: preview.result,
    ai_model: 'meshy-6',
    enable_pbr: true, // PBR = gerçek metal/roughness — krom'un ikna edici olmasının tek yolu
    hd_texture: true,
    ...(texturePrompt ? { texture_prompt: texturePrompt } : {}),
    target_formats: ['glb', 'fbx'],
  });
  const refineTask = await waitFor('text', refine.result, 'refine ');
  console.log(`  refine task: ${refine.result}`);
  const refineFiles = await download(refineTask, name, '2-textured');
  console.log(`  ${refineFiles.length} dosya indirildi`);

  // 3) rig — walk/run animasyonları bu adıma dahil, ayrıca ücretlendirilmiyor
  if (withRig) {
    console.log('');
    console.log('3/3  rig ediliyor...');
    const rig = await meshy<{ result: string }>(ENDPOINT.rig, {
      input_task_id: refine.result,
      height_meters: Number(value('--height') ?? '0.18'), // masaüstü oyuncak ölçeği
    });
    const rigTask = await waitFor('rig', rig.result, 'rig    ');
    console.log(`  rig task: ${rig.result}`);
    console.log(`  ${(await download(rigTask, name, '3-rigged')).length} dosya indirildi`);
  }

  const after = await balance();
  console.log('');
  console.log(`Tamamlandı: ${OUT_ROOT}${name}/`);
  console.log(`Harcanan: ${before - after} kredi (ölçüldü, tahmin değil). Kalan: ${after} kredi.`);
}

/**
 * Referans görselden 3D hattı. Metinden doğrudan 3D üretmek iki turda da battı
 * (anten çıkıyor, kurma anahtarı kayboluyor) — çünkü 3D modelinin "wind-up robot"
 * önyargısını prompt'la yenemiyoruz. Bu hat önce talimat takibi çok daha iyi olan
 * bir görsel modeliyle kontrollü bir referans üretiyor, geometriyi ondan çıkarıyor.
 */
async function cmdRefPipeline(): Promise<void> {
  const name = value('--name') ?? die('eksik: --name <ad>');
  const refPrompt = readPrompt('--prompt-file', value('--prompt-file'), true)!;
  const polycount = Number(value('--polycount') ?? '30000');
  const withRig = !argv.includes('--no-rig');

  const steps: Array<keyof typeof COST> = withRig
    ? ['refimage', 'image3d', 'rig']
    : ['refimage', 'image3d'];
  checkBudget(steps, value('--budget'));

  console.log(`--- referans görsel promptu (${value('--prompt-file')}) ---`);
  console.log(refPrompt);
  console.log('---');
  console.log('');

  if (dryRun) {
    console.log('dry run — hiçbir şey üretilmedi, hiçbir kredi harcanmadı');
    return;
  }

  const before = await balance();
  console.log(`başlangıç bakiyesi: ${before} kredi`);
  console.log('');

  // 1) referans görsel — ön/yan/arka, t-pose
  console.log('1/3  referans görsel üretiliyor (nano-banana-pro, çok görünüşlü)...');
  // aspect_ratio ile generate_multi_view birlikte gönderilemiyor — API 400 veriyor.
  const image = await meshy<{ result: string }>(ENDPOINT.image, {
    ai_model: 'nano-banana-pro',
    prompt: refPrompt,
    generate_multi_view: true,
    pose_mode: 't-pose',
  });
  const imageTask = await waitFor('image', image.result, 'görsel ');
  console.log(`  image task: ${image.result}`);
  console.log(`  ${(await download(imageTask, name, '0-ref')).length} dosya indirildi`);

  // 2) çok görünüşlü referanstan geometri + doku (tek adım, refine gerekmiyor)
  console.log('');
  console.log('2/3  görsellerden 3D üretiliyor (multi-image-to-3d)...');
  const model = await meshy<{ result: string }>(ENDPOINT.multi, {
    input_task_id: image.result,
    ai_model: 'meshy-6',
    topology: 'quad',
    target_polycount: polycount,
    pose_mode: 't-pose',
    enable_pbr: true,
    should_texture: true,
    target_formats: ['glb', 'fbx'],
    moderation: false,
  });
  const modelTask = await waitFor('multi', model.result, 'model  ');
  console.log(`  model task: ${model.result}`);
  console.log(`  ${(await download(modelTask, name, '1-model')).length} dosya indirildi`);

  // 3) rig
  if (withRig) {
    console.log('');
    console.log('3/3  rig ediliyor...');
    const rig = await meshy<{ result: string }>(ENDPOINT.rig, {
      input_task_id: model.result,
      height_meters: Number(value('--height') ?? '0.18'),
    });
    const rigTask = await waitFor('rig', rig.result, 'rig    ');
    console.log(`  rig task: ${rig.result}`);
    console.log(`  ${(await download(rigTask, name, '2-rigged')).length} dosya indirildi`);
  }

  const after = await balance();
  console.log('');
  console.log(`Tamamlandı: ${OUT_ROOT}${name}/`);
  console.log(`Harcanan: ${before - after} kredi (ölçüldü, tahmin değil). Kalan: ${after} kredi.`);
}

/**
 * Tek 2D görsel. Oyun içi asset'lerin ASIL üretim yolu bu (karar: 2D asıl, 3D
 * pazarlama). nano-banana-pro talimat takibinde fal.ai'daki flux-pro v1.1'i
 * açık ara geçiyor — anten/anahtar gibi kısıtlara gerçekten uyuyor.
 *
 * Taslak turlarında --model nano-banana (3 kredi) kullan, kilitlemeden önce
 * nano-banana-pro'ya (9 kredi) çık.
 */
async function cmdImage(): Promise<void> {
  const name = value('--name') ?? die('eksik: --name <ad>');
  const prompt = readPrompt('--prompt-file', value('--prompt-file'), true)!;
  const model = value('--model') ?? 'nano-banana-pro';
  const aspect = value('--aspect') ?? '1:1';

  // --ref ile var olan bir asset referans verilir. Aynı karakterin başka bir
  // açısını ya da kademesini üretirken şart: metinden üretmek stili, oranı ve
  // paleti her seferinde yeniden zar atıyor. Golden sample'ı referans vermek
  // tutarlılığı sağlayan tek yol (REBRAND_AND_VISUAL_PLAN §4, Adım 2).
  const refs = argv.flatMap((a, i) => (a === '--ref' ? [argv[i + 1]] : []));
  for (const ref of refs) if (!existsSync(ref)) die(`referans görsel yok: ${ref}`);
  const refData = refs.map((ref) => {
    const ext = ref.toLowerCase().endsWith('.jpg') || ref.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png';
    return `data:image/${ext};base64,${readFileSync(ref).toString('base64')}`;
  });

  checkBudget(['image'], value('--budget'));
  console.log(`model      ${model}`);
  console.log(`oran       ${aspect}`);
  if (refs.length > 0) console.log(`referans   ${refs.join(', ')}`);
  console.log('');
  console.log(`--- prompt (${value('--prompt-file')}) ---`);
  console.log(prompt);
  console.log('---');
  console.log('');

  if (dryRun) {
    console.log('dry run — hiçbir şey üretilmedi, hiçbir kredi harcanmadı');
    return;
  }

  const before = await balance();
  const task = await meshy<{ result: string }>(
    refs.length > 0 ? ENDPOINT.image2image : ENDPOINT.image,
    {
      ai_model: model,
      prompt,
      generate_multi_view: false,
      ...(refs.length > 0
        ? { reference_image_urls: refData }
        : { aspect_ratio: aspect }),
    },
  );
  console.log(`task: ${task.result}`);
  const done = await waitFor('image', task.result, 'görsel ');
  const files = await download(done, name, 'img');
  console.log(`${files.length} dosya → ${OUT_ROOT}${name}/`);

  const after = await balance();
  console.log(`Harcanan: ${before - after} kredi. Kalan: ${after} kredi.`);
}

async function cmdStep(step: 'preview' | 'refine' | 'rig'): Promise<void> {
  const name = value('--name') ?? die('eksik: --name <ad>');
  checkBudget([step], value('--budget'));
  if (dryRun) {
    console.log('dry run — hiçbir şey üretilmedi, hiçbir kredi harcanmadı');
    return;
  }
  const before = await balance();

  let taskId: string;
  let kind: keyof typeof ENDPOINT = 'text';

  if (step === 'preview') {
    const prompt = readPrompt('--prompt-file', value('--prompt-file'), true)!;
    taskId = (
      await meshy<{ result: string }>(ENDPOINT.text, {
        mode: 'preview',
        prompt,
        ai_model: 'meshy-6',
        topology: 'quad',
        target_polycount: Number(value('--polycount') ?? '30000'),
        should_remesh: true,
        pose_mode: 't-pose',
        target_formats: ['glb', 'fbx'],
        moderation: false,
      })
    ).result;
  } else if (step === 'refine') {
    const source = value('--task') ?? die('eksik: --task <preview-task-id>');
    const texturePrompt = readPrompt('--texture-file', value('--texture-file'), false);
    taskId = (
      await meshy<{ result: string }>(ENDPOINT.text, {
        mode: 'refine',
        preview_task_id: source,
        ai_model: 'meshy-6',
        enable_pbr: true,
        hd_texture: true,
        ...(texturePrompt ? { texture_prompt: texturePrompt } : {}),
        target_formats: ['glb', 'fbx'],
      })
    ).result;
  } else {
    const source = value('--task') ?? die('eksik: --task <textured-task-id>');
    kind = 'rig';
    taskId = (
      await meshy<{ result: string }>(ENDPOINT.rig, {
        input_task_id: source,
        height_meters: Number(value('--height') ?? '0.18'),
      })
    ).result;
  }

  console.log(`task: ${taskId}`);
  const task = await waitFor(kind, taskId, step.padEnd(7));
  const files = await download(task, name, step);
  console.log(`${files.length} dosya indirildi → ${OUT_ROOT}${name}/`);

  const after = await balance();
  console.log(`Harcanan: ${before - after} kredi. Kalan: ${after} kredi.`);
}

async function main(): Promise<void> {
  switch (command) {
    case 'balance':
      return cmdBalance();
    case 'status':
      return cmdStatus();
    case 'pipeline':
      return cmdPipeline();
    case 'refpipeline':
      return cmdRefPipeline();
    case 'image':
      return cmdImage();
    case 'preview':
    case 'refine':
    case 'rig':
      return cmdStep(command);
    default:
      usage();
  }
}

main().catch((error) => {
  console.error(`\nBAŞARISIZ: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
