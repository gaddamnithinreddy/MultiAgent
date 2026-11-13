import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import MessageInput from "./components/MessageInput";
import Dashboard from "./components/Dashboard";
import { fetchModels, sendQuery, sendChat, sendEvaluate } from "./api";

function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`status-toast ${toast.type}`}>{toast.message}</div>;
}

export default function App() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("gpt-oss-120b");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState("");
  const [activeSubAgent, setActiveSubAgent] = useState("none");
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState("chat"); // 'chat' or 'dashboard'
  const [evaluations, setEvaluations] = useState([]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch available models on mount
  useEffect(() => {
    fetchModels()
      .then((data) => {
        setModels(data.models || []);
        if (data.models && data.models.length > 0) {
          setSelectedModel(data.models[0].key);
        }
      })
      .catch(() => {
        setModels([
          { key: "gpt-oss-120b", display_name: "GPT-OSS 120B" },
          { key: "gpt-oss-20b", display_name: "GPT-OSS 20B" },
        ]);
      });
  }, []);

  const handleSend = useCallback(
    async (text) => {
      const userMsg = { role: "user", text };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setActiveAgent("");
      setActiveSubAgent("none");
      setSidebarOpen(false); // Close mobile sidebar if open

      try {
        let result;
        const hasFiles = uploadedFiles.length > 0;

        const msgId = Date.now();
        let contexts = [];

        if (hasFiles) {
          result = await sendQuery(text, selectedModel);
          contexts = result.contexts || [];
        } else {
          result = await sendChat(text, selectedModel);
        }

        const isRag = hasFiles && contexts.length > 0;

        const assistantMsg = {
          id: msgId,
          role: "assistant",
          text: result.response || "No response generated.",
          agent: result.agent || "unknown",
          sub_agent: result.sub_agent || "none",
          sources: result.sources || [],
          evaluating: isRag,
          evaluation: null,
        };

        // Render response immediately on screen!
        setMessages((prev) => [...prev, assistantMsg]);
        setActiveAgent(result.agent || "");
        setActiveSubAgent(result.sub_agent || "none");
        setIsLoading(false);

        // Compute Ragas metrics in parallel without blocking chat
        if (isRag) {
          sendEvaluate(text, result.response, contexts)
            .then((metrics) => {
              setEvaluations((prev) => [
                ...prev,
                {
                  query: text,
                  agent: result.agent || "rag_agent",
                  ...metrics,
                },
              ]);

              // Update the specific message bubble with live scores
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId
                    ? { ...m, evaluating: false, evaluation: metrics }
                    : m
                )
              );
              showToast(
                "success",
                `Metrics: Faithfulness ${(metrics.faithfulness || 0).toFixed(2)} | Relevance ${(metrics.answer_relevance || 0).toFixed(2)}`
              );
            })
            .catch((e) => {
              console.error("Ragas evaluation error:", e);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, evaluating: false } : m
                )
              );
            });
        }
      } catch (err) {
        const errMsg = {
          role: "assistant",
          text: `⚠️ **Error:** ${err.message}`,
          agent: "error",
          sub_agent: "none",
          sources: [],
        };
        setMessages((prev) => [...prev, errMsg]);
        showToast("error", err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedModel, uploadedFiles, showToast]
  );

  const handleClearChat = () => {
    setMessages([]);
    setActiveAgent("");
    setActiveSubAgent("none");
  };

  return (
    <>
      <Toast toast={toast} />

      {/* Responsive Top Header */}
      <header className="top-nav">
        <div className="brand-wrapper">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle sidebar menu"
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
          <div className="brand-symbol" />
          <span className="brand-name">Nexora</span>
          <span className="brand-subtag">7-Agent Assistant</span>
        </div>

        {/* View Switcher: Chat vs Evaluation Dashboard */}
        <div className="view-toggle-group">
          <button
            className={`view-toggle-btn ${view === "chat" ? "active" : ""}`}
            onClick={() => setView("chat")}
          >
            💬 Chat
          </button>
          <button
            className={`view-toggle-btn ${view === "dashboard" ? "active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            📊 Metrics Dashboard
            {evaluations.length > 0 && (
              <span className="eval-count-badge">{evaluations.length}</span>
            )}
          </button>
        </div>

        <div className="nav-actions">
          {activeAgent && activeAgent !== "error" && (
            <div className="active-agent-pill">
              <span className="agent-indicator-pulse" />
              <span className="agent-pill-text">Agent: {activeAgent.replace(/_/g, " ")}</span>
            </div>
          )}

          {messages.length > 0 && (
            <button className="clear-chat-btn" onClick={handleClearChat}>
              Clear
            </button>
          )}

          <div className="status-badge-file">
            {uploadedFiles.length > 0
              ? `● ${uploadedFiles.length} File${uploadedFiles.length > 1 ? "s" : ""}`
              : "○ Ready"}
          </div>
        </div>
      </header>

      <div className="app-container">
        {/* Backdrop for mobile drawer */}
        <div
          className={`sidebar-backdrop ${sidebarOpen ? "visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <Sidebar
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
          activeAgent={activeAgent}
          activeSubAgent={activeSubAgent}
          onToast={showToast}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="main-content">
          {view === "chat" ? (
            <>
              <ChatArea
                messages={messages}
                isLoading={isLoading}
                onPromptSelect={handleSend}
                uploadedFilesCount={uploadedFiles.length}
              />
              <MessageInput onSend={handleSend} disabled={isLoading} />
            </>
          ) : (
            <Dashboard
              evaluations={evaluations}
              onClear={() => setEvaluations([])}
              onLoadBenchmark={(samples) => setEvaluations(samples)}
            />
          )}
        </main>
      </div>
    </>
  );
}
