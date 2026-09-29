import type { Plugin } from 'vite'

export function createResumeFactAnalysisPlugin(env: Record<string, string>): Plugin
export function validateResumeFactInput(input: unknown): { resumeText: string }
export function validateFactsPayload(payload: unknown, resumeText: string): unknown[]
export function parseFactModelJson(content: string): unknown
