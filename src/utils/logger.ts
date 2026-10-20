/**
 * Logger estruturado simples por "escopo" (tag).
 * Formato: [SCOPE] mensagem
 *
 * Nunca registrar: password, API key, service role key, token.
 * As funções abaixo apenas formatam; a responsabilidade de não passar
 * segredos é de quem chama, mas `redact()` ajuda a sanitizar objetos.
 */

export type LogScope =
  | 'SEARCH'
  | 'DECOLAR'
  | 'MOCK'
  | 'DATABASE'
  | 'ANALYZER'
  | 'OPPORTUNITY'
  | 'ORCHESTRATOR'
  | 'CLI'
  | 'DATES';

const SENSITIVE_KEYS = [
  'password',
  'apikey',
  'api_key',
  'servicerole',
  'service_role',
  'service_role_key',
  'token',
  'secret',
  'authorization',
];

export function redact<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => redact(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEYS.some((s) =>
      k.toLowerCase().includes(s.replace(/_/g, '')),
    );
    out[k] = isSensitive ? '***REDACTED***' : redact(v);
  }
  return out as T;
}

function emit(scope: LogScope, level: 'info' | 'warn' | 'error', message: string): void {
  const line = `[${scope}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function log(scope: LogScope, message: string): void {
  emit(scope, 'info', message);
}

export function warn(scope: LogScope, message: string): void {
  emit(scope, 'warn', message);
}

export function error(scope: LogScope, message: string): void {
  emit(scope, 'error', message);
}
