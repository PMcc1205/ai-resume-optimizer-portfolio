import type { Plugin } from 'vite'

export function createRewritePlugin(env: Record<string, string>): Plugin
export function validateRewriteInput(input: unknown): any
export function parseRewriteJson(content: string): unknown
export function validateRewritePayload(payload: unknown, input: any): unknown[]
export function generateRewrites(config: any, input: any, invoke?: Function): Promise<unknown[]>
