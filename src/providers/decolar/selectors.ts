/**
 * Seletores centralizados da Decolar.
 *
 * ATENÇÃO: seletores de sites mudam com frequência. Preferimos âncoras
 * estáveis (role, test-id, label, aria) e evitamos XPath absoluto.
 * Mantenha TUDO que é específico do DOM da Decolar aqui.
 *
 * Como os seletores reais exigem inspeção do site em runtime e podem mudar,
 * fornecemos múltiplos candidatos por campo; o provider tenta em ordem.
 */

export const DECOLAR_BASE_URL = 'https://www.decolar.com';
export const DECOLAR_PACKAGES_URL = 'https://www.decolar.com/pacotes/';

export const selectors = {
  cookieAccept: [
    'button:has-text("Aceitar")',
    'button:has-text("Aceito")',
    '[data-testid="cookie-accept"]',
  ],
  originInput: [
    '[data-testid="origin-input"]',
    'input[aria-label*="Origem" i]',
    'input[placeholder*="Origem" i]',
  ],
  destinationInput: [
    '[data-testid="destination-input"]',
    'input[aria-label*="Destino" i]',
    'input[placeholder*="Destino" i]',
  ],
  autocompleteOption: [
    '[data-testid="autocomplete-option"]',
    '[role="option"]',
    'ul[role="listbox"] li',
  ],
  datePickerTrigger: [
    '[data-testid="date-picker"]',
    'button[aria-label*="data" i]',
    'input[placeholder*="data" i]',
  ],
  dayCell: (iso: string): string[] => [
    `[data-date="${iso}"]`,
    `[aria-label*="${iso}"]`,
    `td[data-day="${iso}"]`,
  ],
  travelersTrigger: [
    '[data-testid="travelers"]',
    'button[aria-label*="passageiro" i]',
    'button[aria-label*="viajante" i]',
  ],
  adultsIncrement: [
    '[data-testid="adults-increment"]',
    'button[aria-label*="adultos" i][aria-label*="aument" i]',
  ],
  childrenIncrement: [
    '[data-testid="children-increment"]',
    'button[aria-label*="crianças" i][aria-label*="aument" i]',
  ],
  childAgeSelect: [
    '[data-testid="child-age-select"]',
    'select[aria-label*="idade" i]',
  ],
  searchButton: [
    '[data-testid="search-button"]',
    'button:has-text("Buscar")',
    'button[type="submit"]',
  ],
  resultCard: [
    '[data-testid="product-card"]',
    'article[data-testid*="result"]',
    '.cluster-container',
  ],
  resultHotelName: [
    '[data-testid="hotel-name"]',
    'h2',
    '.product-name',
  ],
  resultPrice: [
    '[data-testid="price-amount"]',
    '.price-amount',
    '[class*="price"]',
  ],
  resultMealPlan: [
    '[data-testid="meal-plan"]',
    '[class*="meal"]',
    '[class*="regime"]',
  ],
  // Sinais de bloqueio anti-bot / CAPTCHA — para encerrar com segurança.
  // Observação: a Decolar costuma renderizar o bloqueio dentro de um <iframe>,
  // portanto o detector varre também os frames da página (ver DecolarProvider).
  antiBotSignals: [
    'iframe[src*="captcha" i]',
    'iframe[title*="captcha" i]',
    '#px-captcha',
  ],

  /**
   * Trechos de texto (regex, case-insensitive) que indicam bloqueio/anti-bot.
   * Verificados no conteúdo da página E de cada frame.
   */
  antiBotText: [
    /o acesso está temporariamente restrito/i,
    /acesso (negado|restrito|bloqueado)/i,
    /verifique que você (não )?é um robô/i,
    /comportamento do seu navegador chamou nossa atenção/i,
    /há um robô na mesma rede/i,
    /unusual traffic/i,
    /access denied/i,
  ],
};
