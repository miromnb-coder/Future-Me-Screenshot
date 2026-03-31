"use client"

import { useState, useCallback, useRef } from "react"

interface StreamingChatOptions {
  onStreamStart?: () => void
  onStreamEnd?: (fullText: string) => void
  onError?: (error: string) => void
}

export function useStreamingChat(options: StreamingChatOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)

  const streamMessage = useCallback(async (payload: {
    messages: Array<{ role: string; text: string }>
    mood: string
    isPro: boolean
    memorySummary?: string
    memory?: string
    ragContext?: string
    longTermMemories?: string[]
  }): Promise<string | null> => {
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsStreaming(true)
    setStreamingText("")
    options.onStreamStart?.()

    let fullText = ""

    try {
      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to get response")
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setStreamingText(fullText)
      }

      setIsStreaming(false)
      setStreamingText("")
      options.onStreamEnd?.(fullText)
      return fullText
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Stream was intentionally aborted
        return null
      }
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      options.onError?.(errorMessage)
      setIsStreaming(false)
      setStreamingText("")
      return null
    } finally {
      abortControllerRef.current = null
    }
  }, [options])

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setStreamingText("")
  }, [])

  return {
    isStreaming,
    streamingText,
    streamMessage,
    cancelStream,
  }
}
