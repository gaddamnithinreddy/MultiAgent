import React, { useState, useRef, useEffect } from "react";

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [text]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="input-dock">
      <div className="input-container-box">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask a question, request a summary, generate MCQs, or search the web..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />
        <button
          className="send-action-btn"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          title="Send query (Enter)"
        >
          →
        </button>
      </div>
    </div>
  );
}
