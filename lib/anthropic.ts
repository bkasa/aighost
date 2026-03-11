import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const GHOSTWRITER_MODEL = 'claude-sonnet-4-20250514'
export const MAX_TOKENS = 4096

// Parse the <state_update> JSON block from AI response
export function parseStateUpdate(response: string): {
  cleanResponse: string
  stateUpdate: Record<string, unknown> | null
} {
  const stateUpdateRegex = /<state_update>([\s\S]*?)<\/state_update>/
  const match = response.match(stateUpdateRegex)

  if (!match) {
    return { cleanResponse: response, stateUpdate: null }
  }

  let stateUpdate: Record<string, unknown> | null = null
  try {
    stateUpdate = JSON.parse(match[1].trim())
  } catch (e) {
    console.error('Failed to parse state update:', e)
  }

  const cleanResponse = response.replace(stateUpdateRegex, '').trim()
  return { cleanResponse, stateUpdate }
}

// Estimate word count
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
