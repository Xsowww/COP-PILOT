import type { IncomingMessage, ServerResponse } from 'node:http';

export function handlePush(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
export function startPushLoop(): void;
export function pushEndpointOk(endpoint: string): boolean;
export const pushStatus: { active: boolean; lastRun: string | null; lastError: string | null; sent: number };
