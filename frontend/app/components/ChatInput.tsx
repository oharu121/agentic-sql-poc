"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { UI_TEXT } from "@/lib/constants";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = !!input.trim() && !disabled;

  return (
    <div className="p-4">
      <div className="max-w-3xl mx-auto">
        <div
          className={`relative flex items-end gap-3 p-2 glass-bubble rounded-2xl border transition-all duration-200 ${
            isFocused
              ? "border-blue-400/50 shadow-lg shadow-blue-500/20"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={UI_TEXT.inputPlaceholder}
              disabled={disabled}
              rows={1}
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-white disabled:text-gray-500 placeholder:text-gray-500"
              style={{ minHeight: "44px", maxHeight: "150px" }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            aria-label="Send"
            className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
              canSend
                ? "bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:scale-105 active:scale-95"
                : "bg-white/10 text-gray-500"
            }`}
          >
            <svg className={`w-5 h-5 transition-transform duration-200 ${canSend ? "translate-x-0.5" : ""}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 text-center">
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 font-mono text-[10px]">Enter</kbd>
          {" to send · "}
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 font-mono text-[10px]">Shift+Enter</kbd>
          {" for new line"}
        </p>
      </div>
    </div>
  );
}
