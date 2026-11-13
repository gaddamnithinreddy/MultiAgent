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
  // status: 'idle' | 'loading' | 'playing' | 'paused'
  const [status, setStatus] = useState("idle");
  const audioRef = useRef(null);
  const isSpeechSynthRef = useRef(false);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggle = useCallback(async () => {
    // 1. If currently playing -> PAUSE
    if (status === "playing") {
      if (audioRef.current && !isSpeechSynthRef.current) {
        audioRef.current.pause();
        setStatus("paused");
      } else if ("speechSynthesis" in window && isSpeechSynthRef.current) {
        window.speechSynthesis.pause();
        setStatus("paused");
      }
      return;
    }

    // 2. If currently paused -> PLAY / RESUME IMMEDIATELY
    if (status === "paused") {
      if (audioRef.current && !isSpeechSynthRef.current) {
        audioRef.current.play();
        setStatus("playing");
      } else if ("speechSynthesis" in window && isSpeechSynthRef.current) {
        window.speechSynthesis.resume();
        setStatus("playing");
      }
      return;
    }

    // 3. If idle -> FETCH AUDIO & PLAY
    setStatus("loading");
    try {
      const cleanText = text.replace(/[*_#`~>\[\]()]/g, "").substring(0, 5000);
      const audioUrl = await fetchTTSAudio(cleanText);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      isSpeechSynthRef.current = false;

      audio.onended = () => setStatus("idle");
      audio.onerror = () => setStatus("idle");

      await audio.play();
      setStatus("playing");
    } catch (err) {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*_#`~>\[\]()]/g, "").substring(0, 3000);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1;
        utterance.onend = () => setStatus("idle");
        utterance.onerror = () => setStatus("idle");
        isSpeechSynthRef.current = true;
        window.speechSynthesis.speak(utterance);
        setStatus("playing");
      } else {
        setStatus("idle");
      }
    }
  }, [text, status]);

  const handleStop = useCallback((e) => {
    e.stopPropagation();
    if (audioRef.current && !isSpeechSynthRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus("idle");
  }, []);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <button
        className={`audio-ctrl-btn ${status === "playing" ? "playing" : ""}`}
        onClick={handleToggle}
        disabled={status === "loading"}
        title={status === "playing" ? "Pause audio" : status === "paused" ? "Resume playing" : "Listen to audio"}
      >
        <span>
          {status === "loading" ? "⏳" : status === "playing" ? "⏸" : status === "paused" ? "▶" : "🔊"}
        </span>
        <span>
          {status === "loading"
            ? "Loading..."
            : status === "playing"
            ? "Pause"
            : status === "paused"
            ? "Play"
            : "Listen"}
        </span>
      </button>

      {(status === "playing" || status === "paused") && (
        <button
          className="audio-ctrl-btn"
          onClick={handleStop}
          title="Stop and reset to start"
          style={{ padding: "6px 9px" }}
        >
          <span>⏹</span>
        </button>
      )}
    </div>
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

          {msg.evaluating && (
            <span className="msg-eval-pill evaluating" title="Calculating Ragas metrics in real-time">
              <span className="eval-spin">⚡</span> Computing Ragas metrics...
            </span>
          )}

          {msg.evaluation && (
            <div className="msg-eval-pill-group">
              <span
                className="msg-eval-pill score"
                title="Faithfulness: Proportion of factual claims strictly supported by source documents"
                style={{
                  color: msg.evaluation.faithfulness >= 0.7 ? "#15803d" : "#eb573d",
                }}
              >
                🛡️ Faithfulness: <strong>{(msg.evaluation.faithfulness || 0).toFixed(2)}</strong>
              </span>
              <span
                className="msg-eval-pill score"
                title="Answer Relevance: How directly and concisely the answer addresses your question"
                style={{
                  color: msg.evaluation.answer_relevance >= 0.7 ? "#15803d" : "#eb573d",
                }}
              >
                🎯 Relevance: <strong>{(msg.evaluation.answer_relevance || 0).toFixed(2)}</strong>
              </span>
            </div>
          )}
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
