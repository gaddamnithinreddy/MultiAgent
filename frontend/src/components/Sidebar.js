import React, { useRef, useState } from "react";
import { uploadFiles } from "../api";

const AGENT_LIST = [
  { name: "Summarizer", key: "summarizer", icon: "📝" },
  { name: "MCQ Generator", key: "mcq_generator", icon: "❓" },
  { name: "Notes Maker", key: "notes_maker", icon: "📒" },
  { name: "Exam Prep", key: "exam_prep_agent", icon: "🎯" },
  { name: "Concept Explainer", key: "concept_explainer", icon: "💡" },
  { name: "Search Agent", key: "search_agent", icon: "🌐" },
  { name: "Chat Agent", key: "chat_agent", icon: "💬" },
];

const ALLOWED_EXTS = [".pdf", ".docx", ".doc", ".pptx", ".ppt", ".txt", ".md"];
const isAllowedFile = (name) => {
  const lower = name.toLowerCase();
  return ALLOWED_EXTS.some((ext) => lower.endsWith(ext));
};

const getFileIcon = (name) => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "📕";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "📘";
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "📙";
  return "📄";
};

export default function Sidebar({
  models,
  selectedModel,
  onModelChange,
  uploadedFiles,
  setUploadedFiles,
  activeAgent,
  activeSubAgent,
  onToast,
  isOpen,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter((f) => isAllowedFile(f.name));
    setPendingFiles((prev) => [...prev, ...files]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => isAllowedFile(f.name));
    setPendingFiles((prev) => [...prev, ...files]);
  };

  const removePending = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      const result = await uploadFiles(pendingFiles);
      setUploadedFiles((prev) => [...prev, ...result.files]);
      setPendingFiles([]);
      onToast("success", `Vectorized: ${result.message}`);
    } catch (err) {
      onToast("error", `Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? "mobile-open" : ""}`}>
      {/* Mobile Drawer Header with Close Button */}
      <div className="sidebar-mobile-header">
        <span className="sidebar-mobile-title">Workspace Settings</span>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close settings">
          ✕
        </button>
      </div>

      {/* Model Selection */}
      <div className="sidebar-section">
        <div className="section-eyebrow">
          <span className="section-eyebrow-accent" />
          Model Architecture
        </div>
        <div className="model-select-wrapper">
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.key} value={m.key}>
                {m.display_name}
              </option>
            ))}
          </select>
          <span className="model-select-arrow">▼</span>
        </div>
      </div>

      {/* Document Ingestion / Upload */}
      <div className="sidebar-section">
        <div className="section-eyebrow">
          <span className="section-eyebrow-accent" />
          Study Material (PDF, DOC, PPT)
        </div>
        <div
          className={`upload-dropzone ${dragging ? "dragging" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <span className="upload-icon-mark">📁</span>
          <p className="upload-primary-text">Upload PDF, DOC, or PPT</p>
          <span className="upload-secondary-text">PDF, DOCX, DOC, PPTX, PPT files</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
            multiple
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
        </div>

        {/* Pending Files to Upload */}
        {pendingFiles.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="file-list">
              {pendingFiles.map((f, i) => (
                <div className="file-item" key={i}>
                  <div className="file-meta">
                    <span>{getFileIcon(f.name)}</span>
                    <span className="file-name">{f.name}</span>
                  </div>
                  <button
                    className="file-remove-btn"
                    onClick={() => removePending(i)}
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn-primary-black"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? "Embedding Chunks..." : `Upload & Vectorize (${pendingFiles.length}) →`}
            </button>
          </div>
        )}

        {/* Active Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="section-eyebrow" style={{ color: "var(--text-secondary)" }}>
              Indexed in Pinecone ({uploadedFiles.length})
            </div>
            <div className="file-list">
              {uploadedFiles.map((name, i) => (
                <div className="file-item" key={i} style={{ background: "var(--bg-canvas)" }}>
                  <div className="file-meta">
                    <span>{getFileIcon(name)}</span>
                    <span className="file-name">{name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Specialized Agent Swarms */}
      <div className="sidebar-section" style={{ borderBottom: "none" }}>
        <div className="section-eyebrow">
          <span className="section-eyebrow-accent" />
          Specialized Agents
        </div>
        <div className="agent-status-grid">
          {AGENT_LIST.map((agent) => {
            const isMain = activeAgent === agent.key;
            const isSub = activeSubAgent === agent.key && activeSubAgent !== "none";
            const isActive = isMain || isSub;
            return (
              <div
                className={`agent-row ${isActive ? "active" : ""}`}
                key={agent.key}
              >
                <div className="agent-identity">
                  <span className="agent-status-indicator" />
                  <span>
                    {agent.icon} {agent.name}
                  </span>
                </div>
                {isMain && <span className="agent-tag">ACTIVE</span>}
                {isSub && <span className="agent-tag">SUB-AGENT</span>}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
