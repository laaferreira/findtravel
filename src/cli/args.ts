/**
 * Parser mínimo de argumentos CLI (sem dependências).
 * Suporta:
 *   --dry-run
 *   --destination="Porto Seguro"  (repetível)
 *   --max=NN
 */
export interface CliArgs {
  dryRun: boolean;
  destinations: string[];
  max?: number;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, destinations: [] };

  for (const raw of argv) {
    if (raw === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    const match = raw.match(/^--([^=]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    const clean = value!.replace(/^["']|["']$/g, '');
    if (key === 'destination') args.destinations.push(clean);
    else if (key === 'max') args.max = Number.parseInt(clean, 10);
  }
  return args;
}
