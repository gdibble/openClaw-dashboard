'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from '@/components/providers/WebSocketProvider';
import type { ChatMessage } from '@/types';

interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  send: (message: string) => Promise<void>;
  loadHistory: () => Promise<void>;
}

export function useChat(agentId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const { subscribe } = useWebSocket();
  const abortRef = useRef<AbortController | null>(null);

  // Load history on mount
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${agentId}/history`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch { /* ignore */ }
  }, [agentId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Subscribe to WS events for this agent
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(subscribe('chat:chunk', (payload) => {
      const p = payload as { agentId: string; delta: string };
      if (p.agentId === agentId) {
        setStreamingContent(prev => prev + p.delta);
      }
    }));
    unsubs.push(subscribe('chat:done', (payload) => {
      const p = payload as { agentId: string };
      if (p.agentId === agentId) {
        setIsStreaming(false);
        // Reload to get persisted messages
        loadHistory();
        setStreamingContent('');
      }
    }));
    return () => unsubs.forEach(fn => fn());
  }, [agentId, subscribe, loadHistory]);

  const send = useCallback(async (message: string) => {
    if (isStreaming) return;

    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: Date.now(),
      agentId,
      role: 'user',
      content: message,
      createdAt: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setIsStreaming(false);
        return;
      }

      // Read SSE stream for direct (non-WS) fallback
      const reader = res.body?.getReader();
      if (!reader) { setIsStreaming(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      let localContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              localContent += data.delta;
              setStreamingContent(localContent);
            }
            if (data.done) {
              setIsStreaming(false);
              await loadHistory();
              setStreamingContent('');
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setIsStreaming(false);
    }
  }, [agentId, isStreaming, loadHistory]);

  return { messages, isStreaming, streamingContent, send, loadHistory };
}
