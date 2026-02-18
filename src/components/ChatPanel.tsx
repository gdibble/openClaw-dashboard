'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { X, Send, MessageSquare, Loader2 } from 'lucide-react';
import { useChat } from '@/lib/useChat';
import type { Agent } from '@/types';

interface ChatPanelProps {
  agent: Agent;
  onClose: () => void;
}

export default function ChatPanel({ agent, onClose }: ChatPanelProps) {
  const { messages, isStreaming, streamingContent, send } = useChat(agent.id);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input.trim());
    setInput('');
  }

  return (
    <motion.div
      className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-96 bg-card border-l border-border
                 flex flex-col shadow-2xl"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: agent.color }}
        >
          {agent.letter}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{agent.name}</h3>
          <p className="text-[10px] text-muted-foreground">{agent.role}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Start a conversation with {agent.name}</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-primary)] text-white rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className="text-[10px] mt-1 opacity-50">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-bl-sm bg-muted text-foreground text-sm">
              {streamingContent ? (
                <p className="whitespace-pre-wrap">{streamingContent}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-muted-foreground">Thinking...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${agent.name}...`}
            disabled={isStreaming}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm
                       text-foreground placeholder:text-muted-foreground/50
                       focus:outline-none focus:border-[var(--accent-primary)]
                       disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-3 py-2 bg-[var(--accent-primary)] disabled:opacity-50 text-white rounded-lg
                       transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY && (
          <p className="text-[10px] text-muted-foreground/50 mt-1 text-center">
            Requires ANTHROPIC_API_KEY on server
          </p>
        )}
      </form>
    </motion.div>
  );
}
