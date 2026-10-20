import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { loadEnv } from '../config/env.js';
import { DECOLAR_PACKAGES_URL, selectors } from '../providers/decolar/selectors.js';
import { log, warn, error } from '../utils/logger.js';

/**
 * Diagnóstico de acesso à Decolar.
 *
 * Objetivo: confirmar se conseguimos ACESSAR a página de pacotes (sem bloqueio
 * anti-bot) ANTES de investir no mapeamento de seletores.
 *
 * Este script NÃO tenta burlar CAPTCHA/anti-bot. Ele apenas:
 *   - usa um contexto de navegador realista (locale/UA/viewport);
 *   - reporta se caiu na tela de bloqueio;
 *   - se acessível, lista a presença dos campos esperados (origem, destino,
 *     datas, viajantes, botão de busca) para apoiar o mapeamento;
 *   - salva screenshot + HTML em artifacts/ para inspeção manual.
 *
 * Uso:
 *   HEADLESS=false npm run inspect:decolar
 */

const REALISTIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

async function anyText(content: string): Promise<string | null> {
  for (const pattern of selectors.antiBotText) {
    if (pattern.test(content)) return pattern.source;
  }
  return null;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const artifactsDir = env.artifactsDir;
  await mkdir(artifactsDir, { recursive: true });

  log('DECOLAR', `Iniciando diagnóstico (headless=${env.headless})`);
  const browser = await chromium.launch({ headless: env.headless });
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent: REALISTIC_UA,
    viewport: { width: 1366, height: 900 },
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(env.navigationTimeoutMs);

  let blocked = false;
  try {
    const target = process.env.DECOLAR_URL || DECOLAR_PACKAGES_URL;
    log('DECOLAR', `Abrindo ${target}`);
    const response = await page.goto(target, {
      waitUntil: 'domcontentloaded',
    });
    const status = response?.status() ?? 0;
    log('DECOLAR', `HTTP status: ${status}`);

    // Status HTTP de bloqueio/erro já é sinal definitivo de acesso negado.
    if (status === 403 || status === 429 || status >= 500) {
      blocked = true;
      warn('DECOLAR', `BLOQUEIO por HTTP status ${status}`);
    }

    // Dá um tempo para scripts/frames carregarem.
    await page.waitForTimeout(3000);

    // Coleta texto da página + frames.
    const contents: string[] = [];
    try {
      contents.push(await page.content());
    } catch {
      // ignora
    }
    for (const frame of page.frames()) {
      try {
        contents.push(await frame.content());
      } catch {
        // frame cross-origin
      }
    }

    for (const c of contents) {
      const hit = await anyText(c);
      if (hit) {
        blocked = true;
        warn('DECOLAR', `BLOQUEIO anti-bot detectado (padrão: ${hit})`);
        break;
      }
    }

    // Salva artefatos.
    const stamp = Date.now();
    const shot = join(artifactsDir, `inspect-decolar-${stamp}.png`);
    const html = join(artifactsDir, `inspect-decolar-${stamp}.html`);
    const summary = join(artifactsDir, 'inspect-summary.txt');
    await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
    await writeFile(html, contents[0] ?? '', 'utf8').catch(() => undefined);
    await writeFile(
      summary,
      [
        `url=${target}`,
        `http_status=${status}`,
        `blocked=${blocked}`,
        `headless=${env.headless}`,
        `timestamp=${new Date().toISOString()}`,
      ].join('\n'),
      'utf8',
    ).catch(() => undefined);
    log('DECOLAR', `Screenshot: ${shot}`);
    log('DECOLAR', `HTML: ${html}`);
    log('DECOLAR', `Resumo: ${summary}`);

    if (blocked) {
      warn('DECOLAR', 'RESULTADO: acesso BLOQUEADO. Não seguir com scraping.');
      process.exitCode = 2;
      return;
    }

    // Acesso parece OK — reporta presença dos campos esperados.
    log('DECOLAR', 'RESULTADO: acesso aparentemente LIBERADO. Checando campos...');
    await reportField(page, 'origem', selectors.originInput);
    await reportField(page, 'destino', selectors.destinationInput);
    await reportField(page, 'datas', selectors.datePickerTrigger);
    await reportField(page, 'viajantes', selectors.travelersTrigger);
    await reportField(page, 'botão buscar', selectors.searchButton);
    log('DECOLAR', 'Use o HTML/screenshot salvos para ajustar selectors.ts.');
  } catch (err) {
    error('DECOLAR', `Falha no diagnóstico: ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function reportField(
  page: Page,
  label: string,
  candidates: string[],
): Promise<void> {
  for (const sel of candidates) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) {
        log('DECOLAR', `  [OK] ${label}: "${sel}" (${count} elemento(s))`);
        return;
      }
    } catch {
      // próximo candidato
    }
  }
  warn('DECOLAR', `  [FALTA] ${label}: nenhum candidato encontrado`);
}

main();
