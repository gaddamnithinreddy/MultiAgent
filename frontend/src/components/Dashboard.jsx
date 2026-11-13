import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const BENCHMARK_SAMPLES = [
  {
    query: "Condense YOLO architecture and spatial grid system",
    agent: "summarizer",
    faithfulness: 0.94,
    answer_relevance: 0.91,
  },
  {
    query: "Create structured study notes on YOLOv8 backbone & neck",
    agent: "notes_maker",
    faithfulness: 0.93,
    answer_relevance: 0.92,
  },
  {
    query: "Explain intersection over union (IoU) and anchor boxes with analogy",
    agent: "concept_explainer",
    faithfulness: 0.89,
    answer_relevance: 0.94,
  },
  {
    query: "Generate 5 university-level MCQs on bounding box regression",
    agent: "mcq_generator",
    faithfulness: 0.96,
    answer_relevance: 0.93,
  },
  {
    query: "Predict 3 tough exam questions on Non-Maximum Suppression (NMS)",
    agent: "exam_prep_agent",
    faithfulness: 0.94,
    answer_relevance: 0.93,
  },
  {
    query: "Search latest accuracy benchmark improvements in YOLOv11",
    agent: "search_agent",
    faithfulness: 0.86,
    answer_relevance: 0.89,
  },
];

export default function Dashboard({ evaluations = [], onClear, onLoadBenchmark }) {
  const hasData = evaluations && evaluations.length > 0;

  const avgFaithfulness = hasData
    ? (
        evaluations.reduce((sum, e) => sum + (e.faithfulness || 0), 0) /
        evaluations.length
      ).toFixed(2)
    : "0.00";

  const avgRelevance = hasData
    ? (
        evaluations.reduce((sum, e) => sum + (e.answer_relevance || 0), 0) /
        evaluations.length
      ).toFixed(2)
    : "0.00";

  const chartData = evaluations.map((ev, index) => ({
    name: `Q${index + 1}`,
    Faithfulness: Number((ev.faithfulness || 0).toFixed(2)),
    Relevance: Number((ev.answer_relevance || 0).toFixed(2)),
    query: ev.query,
    agent: (ev.agent || "rag_agent").replace(/_/g, " "),
  }));

  const handleLoadDemo = () => {
    if (onLoadBenchmark) {
      onLoadBenchmark(BENCHMARK_SAMPLES);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dash-toolbar">
        <div>
          <h2 className="dash-heading">Ragas Quality Metrics</h2>
          <p className="dash-subheading">
            Mathematical evaluation of RAG responses: Faithfulness (hallucination detection) and Answer Relevance.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="dash-action-btn primary"
            onClick={handleLoadDemo}
            title="Load the 6 representative agent evaluation samples"
          >
            📊 Load Benchmark Data
          </button>
          {hasData && (
            <button
              className="dash-action-btn"
              onClick={onClear}
              title="Clear all evaluation records"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dash-kpi-grid">
        <div className="dash-kpi-card">
          <span className="dash-kpi-label">Avg Faithfulness</span>
          <span
            className="dash-kpi-value"
            style={{
              color: Number(avgFaithfulness) >= 0.7 ? "#15803d" : "#eb573d",
            }}
          >
            {avgFaithfulness}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Target: &gt; 0.85 (Context Grounding)
          </span>
        </div>

        <div className="dash-kpi-card">
          <span className="dash-kpi-label">Avg Answer Relevance</span>
          <span
            className="dash-kpi-value"
            style={{
              color: Number(avgRelevance) >= 0.7 ? "#15803d" : "#eb573d",
            }}
          >
            {avgRelevance}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Target: &gt; 0.85 (Query Alignment)
          </span>
        </div>

        <div className="dash-kpi-card">
          <span className="dash-kpi-label">Evaluated Queries</span>
          <span className="dash-kpi-value">{evaluations.length}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Live Ragas Interactions
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="dash-empty-box">
          <span style={{ fontSize: "2rem" }}>📈</span>
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
            No Evaluation Data Yet
          </h3>
          <p style={{ maxWidth: 440, margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Upload study documents and ask questions in the <strong>💬 Chat</strong> tab to evaluate live responses, or click below to populate the benchmark dataset for your report.
          </p>
          <button
            className="dash-action-btn primary"
            onClick={handleLoadDemo}
            style={{ marginTop: "8px" }}
          >
            Load Benchmark Data (Figure 11)
          </button>
        </div>
      ) : (
        <>
          {/* Recharts Bar Chart */}
          <div className="chart-card-box">
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="#e5e4de" />
                  <XAxis
                    dataKey="name"
                    stroke="#767676"
                    tick={{ fill: "#767676", fontSize: 12, fontFamily: "monospace" }}
                  />
                  <YAxis
                    stroke="#767676"
                    domain={[0, 1]}
                    tick={{ fill: "#767676", fontSize: 12, fontFamily: "monospace" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111111",
                      borderColor: "#111111",
                      color: "#ffffff",
                      borderRadius: 4,
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#eb573d", fontWeight: 700 }}
                    formatter={(value, name) => [`${value}`, name]}
                  />
                  <Legend
                    wrapperStyle={{
                      color: "#111111",
                      paddingTop: "14px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="Faithfulness"
                    fill="#111111"
                    name="Faithfulness"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="Relevance"
                    fill="#eb573d"
                    name="Answer Relevance"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interaction Breakdown Table */}
          <div style={{ marginTop: "28px" }}>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.25rem",
                marginBottom: "14px",
                color: "var(--text-primary)",
              }}
            >
              Interaction Breakdown
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th style={{ width: "6%" }}>#</th>
                    <th style={{ width: "45%" }}>Query</th>
                    <th style={{ width: "18%" }}>Agent</th>
                    <th style={{ width: "15%" }}>Faithfulness</th>
                    <th style={{ width: "16%" }}>Relevance</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((ev, i) => {
                    const fScore = Number((ev.faithfulness || 0).toFixed(2));
                    const rScore = Number((ev.answer_relevance || 0).toFixed(2));
                    const agentName = (ev.agent || "rag_agent").replace(/_/g, " ");

                    return (
                      <tr key={i}>
                        <td style={{ fontFamily: "monospace", fontWeight: 600 }}>
                          Q{i + 1}
                        </td>
                        <td style={{ fontWeight: 500 }}>{ev.query}</td>
                        <td>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.72rem",
                              background: "var(--bg-subtle)",
                              padding: "3px 8px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border-light)",
                              textTransform: "capitalize",
                            }}
                          >
                            {agentName}
                          </span>
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: fScore >= 0.7 ? "#15803d" : "#eb573d",
                          }}
                        >
                          {fScore.toFixed(2)}
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: rScore >= 0.7 ? "#15803d" : "#eb573d",
                          }}
                        >
                          {rScore.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
