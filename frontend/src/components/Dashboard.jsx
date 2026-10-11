import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard({ evaluations }) {
  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <h2 className="dash-heading">Evaluation Dashboard</h2>
        <p className="dash-subheading" style={{ maxWidth: 450 }}>
          No evaluation data yet. Upload a study PDF and send queries to compute real-time Ragas metrics (Faithfulness and Answer Relevance).
        </p>
      </div>
    );
  }

  const chartData = evaluations.map((ev, index) => ({
    name: `Q${index + 1}`,
    Faithfulness: Number((ev.faithfulness || 0).toFixed(2)),
    Relevance: Number((ev.answer_relevance || 0).toFixed(2)),
    query: ev.query,
  }));

  return (
    <div className="dashboard-container">
      <h2 className="dash-heading">Ragas Quality Metrics</h2>
      <p className="dash-subheading">
        Mathematical evaluation of RAG accuracy: Faithfulness (hallucination detection) and Answer Relevance.
      </p>

      <div className="chart-card-box">
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="2 2" stroke="#e5e4de" />
              <XAxis dataKey="name" stroke="#767676" tick={{ fill: '#767676', fontSize: 12, fontFamily: 'monospace' }} />
              <YAxis stroke="#767676" domain={[0, 1]} tick={{ fill: '#767676', fontSize: 12, fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111111',
                  borderColor: '#111111',
                  color: '#ffffff',
                  borderRadius: 0,
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#eb573d', fontWeight: 700 }}
                formatter={(value, name) => [`${value}`, name]}
              />
              <Legend wrapperStyle={{ color: '#111111', paddingTop: '14px', fontFamily: 'monospace', fontSize: '12px' }} />
              <Bar dataKey="Faithfulness" fill="#111111" name="Faithfulness" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Relevance" fill="#eb573d" name="Answer Relevance" radius={[0, 0, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '14px', color: '#111111' }}>
          Interaction Breakdown
        </h3>
        <table className="dash-table">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Query</th>
              <th>Faithfulness</th>
              <th>Relevance</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((ev, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{ev.query}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, color: ev.faithfulness >= 0.7 ? '#15803d' : '#eb573d' }}>
                  {(ev.faithfulness || 0).toFixed(2)}
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, color: ev.answer_relevance >= 0.7 ? '#15803d' : '#eb573d' }}>
                  {(ev.answer_relevance || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
