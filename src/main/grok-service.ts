import { settingsStore } from './store'

const XAI_API = 'https://api.x.ai/v1/chat/completions'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GrokStreamChunk {
  type: 'delta' | 'done' | 'error' | 'citations'
  content?: string
  citations?: string[]
  error?: string
}

export class GrokService {
  private getApiKey(): string {
    const key = settingsStore.get('apiKey')
    if (!key) throw new Error('xAI API key not configured. Open Settings (⚙) and add your key from console.x.ai')
    return key
  }

  private getAccountContext(): string {
    if (!settingsStore.get('xAccountLinked')) return ''
    const username = settingsStore.get('xUsername')
    const email = settingsStore.get('xEmail')
    const parts = ['The user has linked their X account to Grok Browser.']
    if (username) parts.push(`X username: ${username}`)
    if (email) parts.push(`Email: ${email}`)
    return parts.join(' ')
  }

  private enrichSystemPrompt(base: string): string {
    const account = this.getAccountContext()
    return account ? `${base}\n\n${account}` : base
  }

  async *streamChat(
    messages: ChatMessage[],
    options?: { searchMode?: 'auto' | 'on' | 'off'; includeCitations?: boolean }
  ): AsyncGenerator<GrokStreamChunk> {
    const apiKey = this.getApiKey()
    const model = settingsStore.get('model')
    const searchMode = options?.searchMode ?? settingsStore.get('searchMode')

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      temperature: 0.7
    }

    if (searchMode !== 'off') {
      body.search_parameters = {
        mode: searchMode,
        return_citations: options?.includeCitations ?? true
      }
    }

    const response = await fetch(XAI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text()
      let message = `API error ${response.status}`
      try {
        const parsed = JSON.parse(errText)
        message = parsed.error?.message || parsed.message || message
      } catch {
        message = errText || message
      }
      yield { type: 'error', error: message }
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      yield { type: 'error', error: 'No response stream' }
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let citations: string[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          if (citations.length) yield { type: 'citations', citations }
          yield { type: 'done' }
          return
        }

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) yield { type: 'delta', content: delta }
          if (parsed.citations?.length) citations = parsed.citations
        } catch {
          // skip malformed chunks
        }
      }
    }

    if (citations.length) yield { type: 'citations', citations }
    yield { type: 'done' }
  }

  buildPageContextPrompt(pageTitle: string, pageUrl: string, pageText: string, userQuery: string): ChatMessage[] {
    const truncated = pageText.slice(0, 12000)
    return [
      {
        role: 'system',
        content: this.enrichSystemPrompt(`You are Grok, an AI assistant built into Grok Browser. You help users browse the web intelligently.
You have access to the current page context. Be concise, accurate, and helpful.
When citing information from the page, reference specific details. Use markdown formatting.`)
      },
      {
        role: 'user',
        content: `Current page:
Title: ${pageTitle}
URL: ${pageUrl}

Page content:
${truncated}

User question: ${userQuery}`
      }
    ]
  }

  buildResearchPrompt(topic: string): ChatMessage[] {
    return [
      {
        role: 'system',
        content: this.enrichSystemPrompt(`You are Grok, an AI research assistant in Grok Browser. Research the topic thoroughly using live web search.
Provide a concise, well-structured answer with key findings. Include the most relevant URLs as markdown links at the end under "## Top Sources".`)
      },
      {
        role: 'user',
        content: `Research this topic and give me the best resources: ${topic}`
      }
    ]
  }

  buildSummarizePrompt(pageTitle: string, pageUrl: string, pageText: string): ChatMessage[] {
    const truncated = pageText.slice(0, 15000)
    return [
      {
        role: 'system',
        content: this.enrichSystemPrompt('You are Grok. Summarize web pages clearly with key points, structure, and takeaways. Use markdown.')
      },
      {
        role: 'user',
        content: `Summarize this page:

Title: ${pageTitle}
URL: ${pageUrl}

Content:
${truncated}`
      }
    ]
  }
}

export const grokService = new GrokService()