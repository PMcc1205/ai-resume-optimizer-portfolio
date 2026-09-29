import type { Plugin } from 'vite'
export function createRewriteValidationPlugin(env: Record<string, string>): Plugin
export function readRewriteValidationConfig(env: Record<string, string | undefined>): { apiUrl:string|undefined;apiKey:string|undefined;model:string|undefined;timeoutMs:number;maxRetries:number;maxOutputTokens:number|null }
