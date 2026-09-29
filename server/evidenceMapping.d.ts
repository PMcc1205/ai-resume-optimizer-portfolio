import type { Plugin } from 'vite'

export function createEvidenceMappingPlugin(env: Record<string, string>): Plugin
export function isUsableEvidenceFact(fact: unknown): boolean
export function validateEvidenceMappingInput(input: unknown): { requirements: unknown[]; facts: unknown[]; usableFacts: unknown[] }
export function validateMappingsPayload(payload: unknown, requirements: any[], facts: any[]): unknown[]
export function parseEvidenceMappingJson(content: string): unknown
