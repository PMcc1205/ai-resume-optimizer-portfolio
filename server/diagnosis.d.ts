import type { Plugin } from 'vite'

export function createDiagnosisPlugin(env: Record<string, string>): Plugin
export function validateDiagnosisInput(input: unknown): any
export function validateDiagnosisPayload(payload: unknown, input: any): unknown[]
export function parseDiagnosisJson(content: string): unknown
