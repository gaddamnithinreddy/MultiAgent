import React, { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchTTSAudio } from "../api";
import { downloadResponseAsDoc } from "../utils/docExport";

const AGENTS = [
  { key: "summarizer", name: "Summarizer", icon: "📝", prompt: "Summarize the key points of the uploaded material into clear paragraphs." },
  { key: "mcq_generator", name: "MCQ Generator", icon: "❓", prompt: "Generate 5 multiple-choice questions with options, answers, and explanations." },
  { key: "notes_maker", name: "Notes Maker", icon: "📒", prompt: "Create structured revision notes with bullet points and key definitions." },
  { key: "exam_prep_agent", name: "Exam Prep", icon: "🎯", prompt: "Predict likely exam questions categorized by Easy, Medium, and Tough." },
  { key: "concept_explainer", name: "Concept Explainer", icon: "💡", prompt: "Explain the central concept simply with analogies and real-world examples." },
  { key: "search_agent", name: "Search Agent", icon: "🌐", prompt: "Search the web and give me an up-to-date summary of the latest AI developments." },
  { key: "chat_agent", name: "Chat Agent", icon: "💬", prompt: "Hi! How can you help me study today?" },
];

const AGENT_LABELS = {
  summarizer: "Summarizer",
  mcq_generator: "MCQ Generator",
  notes_maker: "Notes Maker",
  exam_prep_agent: "Exam Prep",
  concept_explainer: "Concept Explainer",
  search_agent: "Search Agent",
  chat_agent: "Chat Agent",
};

function SourceLinks({ sources }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="sources-section">
      <div className="sources-title">Verified Sources ({sources.length})</div>
      <div className="source-links-grid">
        {sources.map((src, i) => (
          <a
            key={i}
            className="source-link-item"
            href={src.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="source-link-arrow">↗</span>
            <span style={{ fontWeight: 500 }}>{src.title || src.link}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function AudioButton({ text }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  const handlePlay = useCallback(async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      const audioUrl = await fetchTTSAudio(text.substring(0, 5000));
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play();
      setPlaying(true);
    } catch (err) {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text.substring(0, 3000));
        utterance.rate = 1;
        utterance.onend = () => setPlaying(false);
        window.speechSynthesis.speak(utterance);
        setPlaying(true);
      }
    } finally {
      setLoading(false);
    }
  }, [text, playing]);

  return (
    <button
      className={`audio-ctrl-btn ${playing ? "playing" : ""}`}
      onClick={handlePlay}
      disabled={loading}
    >
      <span>{loading ? "⏳" : playing ? "⏹" : "🔊"}</span>
      <span>{loading ? "Loading..." : playing ? "Stop Audio" : "Listen"}</span>
    </button>
  );
}

function DownloadDocButton({ text, agentKey }) {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    downloadResponseAsDoc(text, agentKey);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2200);
  };

  return (
    <button
      className={`doc-download-btn ${downloaded ? "downloaded" : ""}`}
      onClick={handleDownload}
      title="Download this response as a Word document (.docx)"
      aria-label="Download response as doc"
    >
      <span className="doc-btn-icon">{downloaded ? "✓" : "📄"}</span>
      <span>{downloaded ? "Downloaded Doc" : "Download Doc"}</span>
    </button>
  );
}

function MessageContent({ msg }) {
  const agentKey = msg.agent || "";
  const subAgentKey = msg.sub_agent && msg.sub_agent !== "none" ? msg.sub_agent : null;

  return (
    <div>
      {msg.role === "assistant" && agentKey && (
        <div className="message-meta-tags">
          <span className="meta-agent-chip">
            🤖 {AGENT_LABELS[agentKey] || agentKey}
          </span>
          {subAgentKey && (
            <span className="meta-agent-chip sub">
              ⚡ Sub-agent: {AGENT_LABELS[subAgentKey] || subAgentKey}
            </span>
          )}
        </div>
      )}

      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>

      {msg.role === "assistant" && <SourceLinks sources={msg.sources} />}

      {msg.role === "assistant" && msg.text && (
        <div className="message-actions-bar">
          <AudioButton text={msg.text} />
          <DownloadDocButton text={msg.text} agentKey={msg.agent} />
        </div>
      )}
    </div>
  );
}

export default function ChatArea({
  messages,
  isLoading,
  onPromptSelect,
  uploadedFilesCount,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="welcome-chat-container">
        <div className="welcome-chat-card">
          <h1 className="welcome-title">How can I help you study?</h1>
          <p className="welcome-subtitle">
            {uploadedFilesCount > 0
              ? `${uploadedFilesCount} Document${uploadedFilesCount > 1 ? "s" : ""} loaded · Select an agent or ask anything:`
              : "Upload PDFs, Docs, or PPTs in sidebar or ask anything · 7 specialized agents ready:"}
          </p>

          <div className="agent-chips-row">
            {AGENTS.map((agent) => (
              <button
                key={agent.key}
                className="agent-pill-btn"
                onClick={() => onPromptSelect?.(agent.prompt)}
              >
                <span className="agent-pill-icon">{agent.icon}</span>
                <span className="agent-pill-name">{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-area">
      {messages.map((msg, i) => (
        <div key={i} className={`message ${msg.role}`}>
          <div className="message-avatar">
            {msg.role === "user" ? "YOU" : "AI"}
          </div>
          <div className="message-bubble">
            <MessageContent msg={msg} />
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="message assistant">
          <div className="message-avatar">AI</div>
          <div className="message-bubble">
            <div className="loading-box">
              <div className="loading-indicator-dots">
                <span />
                <span />
                <span />
              </div>
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Routing query across agent swarm...
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
