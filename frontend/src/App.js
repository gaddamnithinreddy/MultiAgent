import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import MessageInput from "./components/MessageInput";
import { fetchModels, sendQuery, sendChat } from "./api";

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

      try {
        let result;
        const hasFiles = uploadedFiles.length > 0;

        if (hasFiles) {
          result = await sendQuery(text, selectedModel);
        } else {
          result = await sendChat(text, selectedModel);
        }

        const assistantMsg = {
          role: "assistant",
          text: result.response || "No response generated.",
          agent: result.agent || "unknown",
          sub_agent: result.sub_agent || "none",
          sources: result.sources || [],
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setActiveAgent(result.agent || "");
        setActiveSubAgent(result.sub_agent || "none");
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

      {/* Clean, Simple Top Header (No Workspaces, No Evaluation) */}
      <header className="top-nav">
        <div className="brand-wrapper">
          <div className="brand-symbol" />
          <span className="brand-name">Nexora</span>
          <span className="brand-subtag">7-Agent Assistant</span>
        </div>

        <div className="nav-actions">
          {activeAgent && activeAgent !== "error" && (
            <div className="active-agent-pill">
              <span className="agent-indicator-pulse" />
              <span>Agent: {activeAgent.replace(/_/g, " ")}</span>
            </div>
          )}

          {messages.length > 0 && (
            <button className="clear-chat-btn" onClick={handleClearChat}>
              Clear Chat
            </button>
          )}

          <div className="status-badge-file">
            {uploadedFiles.length > 0
              ? `● ${uploadedFiles.length} PDF${uploadedFiles.length > 1 ? "s" : ""} Loaded`
              : "○ Ready (Free Chat)"}
          </div>
        </div>
      </header>

      <div className="app-container">
        <Sidebar
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
          activeAgent={activeAgent}
          activeSubAgent={activeSubAgent}
          onToast={showToast}
        />

        <main className="main-content">
          <ChatArea
            messages={messages}
            isLoading={isLoading}
            onPromptSelect={handleSend}
            uploadedFilesCount={uploadedFiles.length}
          />
          <MessageInput onSend={handleSend} disabled={isLoading} />
        </main>
      </div>
    </>
  );
}
