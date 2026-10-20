import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  chromium,
  type Browser,
  type Page,
  type Locator,
} from 'playwright';
import type { SearchCriteria, TravelPackage, MealPlan } from '../../models/index.js';
import type { TravelProvider } from '../TravelProvider.js';
import { log, warn, error } from '../../utils/logger.js';
import { parseBrlToCents } from '../../utils/money.js';
import {
  DECOLAR_PACKAGES_URL,
  selectors,
} from './selectors.js';

export interface DecolarOptions {
  headless: boolean;
  navigationTimeoutMs: number;
  artifactsDir: string;
}

/** Erro específico para situações de bloqueio anti-bot/CAPTCHA. */
export class AntiBotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AntiBotError';
  }
}

/**
 * DecolarProvider
 * ---------------
 * Scraper da Decolar via Playwright + Chromium headless.
 *
 * Princípios:
 *  - Seletores centralizados em selectors.ts (tenta candidatos em ordem).
 *  - Timeouts configuráveis e tratamento de erro com screenshot.
 *  - Detecta CAPTCHA/anti-bot e encerra com segurança (AntiBotError).
 *  - NÃO tenta burlar CAPTCHA, autenticação ou rate limit.
 *
 * Observação honesta: os seletores reais da Decolar mudam e exigem validação
 * em runtime contra o site. Esta implementação fornece a estrutura completa,
 * fallback de seletores e diagnóstico; ajustes finos de DOM podem ser
 * necessários na primeira execução real. Enquanto isso, o modo mock cobre
 * todo o fluxo de ponta a ponta.
 */
export class DecolarProvider implements TravelProvider {
  readonly name = 'decolar';
  private browser?: Browser;

  constructor(private readonly options: DecolarOptions) {}

  async init(): Promise<void> {
    log('DECOLAR', 'Launching Chromium');
    this.browser = await chromium.launch({ headless: this.options.headless });
  }

  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      log('DECOLAR', 'Browser closed');
    }
  }

  async searchPackages(criteria: SearchCriteria): Promise<TravelPackage[]> {
    if (!this.browser) await this.init();
    const context = await this.browser!.newContext({
      locale: 'pt-BR',
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(this.options.navigationTimeoutMs);
    page.setDefaultTimeout(this.options.navigationTimeoutMs);

    try {
      log('DECOLAR', 'Opening search page');
      await page.goto(DECOLAR_PACKAGES_URL, { waitUntil: 'domcontentloaded' });

      await this.detectAntiBot(page);
      await this.acceptCookies(page);

      await this.fillAutocomplete(page, selectors.originInput, criteria.origin);
      await this.fillAutocomplete(page, selectors.destinationInput, criteria.destination);
      await this.selectDates(page, criteria.checkIn, criteria.checkOut);
      await this.configureTravelers(page, criteria);

      log('DECOLAR', 'Submitting search');
      await this.clickFirst(page, selectors.searchButton);

      await this.detectAntiBot(page);
      await this.waitForResults(page);
      log('DECOLAR', 'Results loaded');

      const packages = await this.extractResults(page, criteria);
      log('DECOLAR', `${packages.length} packages found`);
      return packages;
    } catch (err) {
      if (err instanceof AntiBotError) {
        warn('DECOLAR', `Bloqueio anti-bot detectado — encerrando busca com segurança: ${err.message}`);
        await this.capture(page, 'antibot');
        return [];
      }
      error('DECOLAR', `Erro durante a busca: ${(err as Error).message}`);
      await this.capture(page, 'error');
      throw err;
    } finally {
      await context.close();
    }
  }

  // --------------------------------------------------------------------------
  // Helpers de interação (tolerantes a múltiplos candidatos de seletor)
  // --------------------------------------------------------------------------

  private async firstVisible(page: Page, candidates: string[]): Promise<Locator | null> {
    for (const sel of candidates) {
      const loc = page.locator(sel).first();
      try {
        if (await loc.isVisible({ timeout: 2000 })) return loc;
      } catch {
        // tenta o próximo candidato
      }
    }
    return null;
  }

  private async clickFirst(page: Page, candidates: string[]): Promise<void> {
    const loc = await this.firstVisible(page, candidates);
    if (!loc) throw new Error(`Nenhum seletor clicável encontrado: ${candidates.join(' | ')}`);
    await loc.click();
  }

  private async acceptCookies(page: Page): Promise<void> {
    const loc = await this.firstVisible(page, selectors.cookieAccept);
    if (loc) {
      await loc.click().catch(() => undefined);
      log('DECOLAR', 'Cookie banner handled');
    }
  }

  private async fillAutocomplete(
    page: Page,
    candidates: string[],
    value: string,
  ): Promise<void> {
    const input = await this.firstVisible(page, candidates);
    if (!input) throw new Error(`Campo não encontrado: ${candidates.join(' | ')}`);
    await input.click();
    await input.fill('');
    await input.type(value, { delay: 60 });
    const option = await this.firstVisible(page, selectors.autocompleteOption);
    if (option) await option.click();
  }

  private async selectDates(page: Page, checkIn: string, checkOut: string): Promise<void> {
    const trigger = await this.firstVisible(page, selectors.datePickerTrigger);
    if (trigger) await trigger.click().catch(() => undefined);
    await this.clickFirst(page, selectors.dayCell(checkIn));
    await this.clickFirst(page, selectors.dayCell(checkOut));
  }

  private async configureTravelers(page: Page, criteria: SearchCriteria): Promise<void> {
    const trigger = await this.firstVisible(page, selectors.travelersTrigger);
    if (trigger) await trigger.click().catch(() => undefined);

    // Adultos: assume default 2 em muitos sites; incrementa se necessário.
    const adultsInc = await this.firstVisible(page, selectors.adultsIncrement);
    if (adultsInc) {
      for (let i = 2; i < criteria.adults; i++) await adultsInc.click();
    }

    // Crianças: incrementa e define idade.
    const childrenInc = await this.firstVisible(page, selectors.childrenIncrement);
    if (childrenInc) {
      for (let i = 0; i < criteria.children.length; i++) await childrenInc.click();
    }
    const ageSelect = await this.firstVisible(page, selectors.childAgeSelect);
    if (ageSelect && criteria.children[0]) {
      await ageSelect.selectOption(String(criteria.children[0].age)).catch(() => undefined);
    }
  }

  private async waitForResults(page: Page): Promise<void> {
    for (const sel of selectors.resultCard) {
      try {
        await page.locator(sel).first().waitFor({ state: 'visible', timeout: 15000 });
        return;
      } catch {
        // tenta o próximo
      }
    }
    throw new Error('Resultados não carregaram dentro do timeout');
  }

  private async extractResults(page: Page, criteria: SearchCriteria): Promise<TravelPackage[]> {
    const cardSel = selectors.resultCard.join(', ');
    const cards = page.locator(cardSel);
    const count = Math.min(await cards.count(), 30);
    const now = new Date().toISOString();
    const packages: TravelPackage[] = [];

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const name = await this.textFrom(card, selectors.resultHotelName);
      const priceText = await this.textFrom(card, selectors.resultPrice);
      const mealText = await this.textFrom(card, selectors.resultMealPlan);
      if (!name || !priceText) continue;

      const totalPrice = parseBrlToCents(priceText);
      if (totalPrice === null) continue;

      packages.push({
        provider: this.name,
        hotel: { name: name.trim() },
        destination: criteria.destination,
        checkIn: criteria.checkIn,
        checkOut: criteria.checkOut,
        nights: criteria.nights,
        adults: criteria.adults,
        children: criteria.children.length,
        mealPlan: this.inferMealPlan(mealText),
        totalPrice,
        currency: 'BRL',
        flightIncluded: true, // pacotes geralmente incluem voo
        departureAirport: criteria.origin,
        collectedAt: now,
        isMock: false,
      });
    }

    // Prioriza All Inclusive conforme solicitado.
    packages.sort((a, b) => {
      const ai = (p: TravelPackage) => (p.mealPlan === 'ALL_INCLUSIVE' ? 0 : 1);
      return ai(a) - ai(b);
    });
    return packages;
  }

  private inferMealPlan(text: string | null): MealPlan {
    const t = (text ?? '').toLowerCase();
    if (t.includes('all inclusive') || t.includes('tudo incluído')) return 'ALL_INCLUSIVE';
    if (t.includes('pensão completa')) return 'FULL_BOARD';
    if (t.includes('meia pensão')) return 'HALF_BOARD';
    if (t.includes('café')) return 'BREAKFAST';
    return 'UNKNOWN';
  }

  private async textFrom(scope: Locator, candidates: string[]): Promise<string | null> {
    for (const sel of candidates) {
      const loc = scope.locator(sel).first();
      try {
        if (await loc.count()) {
          const txt = await loc.innerText({ timeout: 1500 });
          if (txt) return txt;
        }
      } catch {
        // próximo candidato
      }
    }
    return null;
  }

  /**
   * Detecta bloqueio anti-bot / CAPTCHA e encerra com segurança.
   *
   * A Decolar costuma renderizar o bloqueio dentro de um <iframe> com a
   * mensagem "O acesso está temporariamente restrito". Por isso varremos:
   *   1. seletores estruturais (iframes de captcha, #px-captcha);
   *   2. o texto da página principal;
   *   3. o texto de CADA frame.
   *
   * NUNCA tentamos resolver o desafio — apenas registramos e lançamos
   * AntiBotError para que a busca termine sem agredir o site.
   */
  private async detectAntiBot(page: Page): Promise<void> {
    // 1. Sinais estruturais.
    for (const sel of selectors.antiBotSignals) {
      try {
        if (await page.locator(sel).first().isVisible({ timeout: 1000 })) {
          throw new AntiBotError(`Sinal estrutural detectado: ${sel}`);
        }
      } catch (err) {
        if (err instanceof AntiBotError) throw err;
      }
    }

    // 2. + 3. Texto da página principal e de cada frame.
    const texts: string[] = [];
    try {
      texts.push((await page.content()) ?? '');
    } catch {
      // ignora: página pode estar em transição
    }
    for (const frame of page.frames()) {
      try {
        texts.push((await frame.content()) ?? '');
      } catch {
        // frame cross-origin ou destacado — ignora
      }
    }

    for (const haystack of texts) {
      for (const pattern of selectors.antiBotText) {
        if (pattern.test(haystack)) {
          throw new AntiBotError(`Mensagem de bloqueio detectada: ${pattern}`);
        }
      }
    }
  }

  private async capture(page: Page, tag: string): Promise<void> {
    try {
      await mkdir(this.options.artifactsDir, { recursive: true });
      const file = join(
        this.options.artifactsDir,
        `decolar-${tag}-${Date.now()}.png`,
      );
      await page.screenshot({ path: file, fullPage: true });
      warn('DECOLAR', `Screenshot de diagnóstico salvo: ${file}`);
    } catch (err) {
      warn('DECOLAR', `Falha ao capturar screenshot: ${(err as Error).message}`);
    }
  }
}
