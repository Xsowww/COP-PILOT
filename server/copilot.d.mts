import type { IncomingMessage, ServerResponse } from 'node:http';
export function handleCopilot(req: IncomingMessage, res: ServerResponse, env?: Record<string, string | undefined>): Promise<boolean>;
export function copilotProvider(env?: Record<string, string | undefined>): { provider: string; label: string; model: string } | null;
