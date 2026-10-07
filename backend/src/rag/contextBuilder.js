export function buildRagContext({ question, retrieved, session, analysis, recommendations }) {
  const evidence = retrieved.length
    ? retrieved
        .map((item, i) => `[Source ${i + 1}: ${item.source} (Relevance: ${Math.round(item.score * 100)}%)]\n${item.text}`)
        .join("\n\n")
    : "NO_RETRIEVED_DOCUMENTS";

  const sensorLines = analysis
    ? Object.values(analysis.analysis || {})
        .map((s) => `${s.zone} (${s.label}, GPIO ${s.gpio ?? "N/A"}): Current=${s.value ?? "n/a"}, Severity=${s.severity}, Trend=${s.trend}`)
        .join("\n")
    : "No live sensor context available.";

  const recLines = recommendations?.length
    ? recommendations.map((r) => `${r.zone}: ${r.message || r.text || ""}`).join("\n")
    : "No soft-insert cushioning recommendations generated.";

  return {
    system: `You are the SmartContour Clinical Support AI Assistant for 3D-printed prosthetic sockets.
CRITICAL OPERATING RULES:
1. You are a STRICT Grounded RAG Assistant. You must answer the user's question using ONLY the provided Retrieved Knowledge and Current Sensor Context.
2. DO NOT answer from general outside knowledge or invent guidelines.
3. If the retrieved knowledge does not contain sufficient information to answer the question, or if NO_RETRIEVED_DOCUMENTS is given, you MUST state EXACTLY:
   "I could not find sufficient information in the provided knowledge base."
4. If sufficient information exists, explain the residual-limb pressure patterns and soft-insert cushioning guidelines based strictly on the retrieved text.
5. In your answer, explicitly cite the sources used (e.g. "[cushioning-and-refit.md]").
6. Always remember prototype thresholds (0-349 LOW, 350-699 MEDIUM, 700+ HIGH) are engineering test thresholds, NOT clinical diagnostic limits.`,

    user: `User Question: "${question}"

=== CURRENT SENSOR CONTEXT ===
${sensorLines}
Highest Pressure Zone: ${analysis?.highestPressureZone ? `${analysis.highestPressureZone.zone} (${analysis.highestPressureZone.value})` : "None"}

=== STORED RECOMMENDATIONS ===
${recLines}

=== RETRIEVED KNOWLEDGE PASSAGES ===
${evidence}

=== RESPONSE FORMAT ===
Provide your response with these exact section headers:
Answer: <Grounded answer or 'I could not find sufficient information in the provided knowledge base.'>
Reasoning: <Direct rationale based on retrieved knowledge and sensors>
Relevant evidence: <Exact sources cited from retrieved passages>
Current sensor context: <Summary of current zone pressures>
Recommendation: <Specific soft insert contouring advice from the retrieved knowledge>`,

    sources: retrieved.map((item) => ({
      source: item.source,
      score: item.score,
      snippet: item.text.slice(0, 160) + "...",
    })),
  };
}
