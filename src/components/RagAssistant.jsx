import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function RagAssistant({ patientId, role = "doctor", theme = "light" }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]); // conversation history
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Scroll to latest message when messages update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const askRag = async () => {
    if (!question.trim()) return;

    const userMessage = { type: "user", text: question, timestamp: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion(""); // clear input

    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/query", {
        question,
        role,
        patientId
      });

      const aiMessage = {
        type: "ai",
        text: res.data.answer,
        severity: res.data.severity,
        confidence: Math.round(res.data.confidence * 100),
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      alert("RAG service unavailable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rag-box ${theme}`}>
      <h3>Clinical Assistant</h3>

      <div className="rag-chat-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`rag-message ${msg.type}`}>
            <span className="rag-timestamp">{msg.timestamp}</span>
            {msg.type === "user" ? (
              <p>{msg.text}</p>
            ) : (
              <div className={`rag-response ${msg.severity}`}>
                {splitIntoParagraphs(msg.text).map((para, i) => (
                   <p key={i} className="rag-paragraph">{para}</p>
                ))}

                <p><strong>Severity:</strong> {msg.severity}</p>
                <p><strong>Confidence:</strong> {msg.confidence}%</p>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <textarea
        placeholder="Ask about patient condition..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
      />

      <button onClick={askRag} disabled={loading}>
        {loading ? "Analyzing..." : "Ask AI"}
      </button>

      <style>{`
        .rag-paragraph {
          margin-bottom: 0.6rem;
          line-height: 1.5;
        }
 
        .rag-box {
          padding: 1rem;
          border-radius: 12px;
          max-width: 1000px;
          margin: auto;
          background-color: ${theme === "dark" ? "#1f1f1f" : "#f9f9f9"};
          color: ${theme === "dark" ? "#f9f9f9" : "#1f1f1f"};
          display: flex;
          flex-direction: column;
        }
        .rag-chat-container {
          max-height: 400px;
          overflow-y: auto;
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding-right: 0.5rem;
        }
        .rag-message.user p {
          background-color: ${theme === "dark" ? "#2e6df6" : "#d0e2ff"};
          color: ${theme === "dark" ? "#fff" : "#000"};
          padding: 0.5rem 0.75rem;
          border-radius: 12px;
          align-self: flex-end;
          max-width: 80%;
          word-wrap: break-word;
        }
        .rag-message.ai {
          align-self: flex-start;
        }
        .rag-response {
          background-color: ${theme === "dark" ? "#333" : "#eee"};
          padding: 0.5rem 0.75rem;
          border-radius: 12px;
          max-width: 80%;
          word-wrap: break-word;
        }
        .rag-response.high { border-left: 4px solid red; }
        .rag-response.medium { border-left: 4px solid orange; }
        .rag-response.low { border-left: 4px solid green; }
        textarea {
          width: 100%;
          padding: 0.5rem;
          border-radius: 8px;
          border: 1px solid #ccc;
          margin-bottom: 0.5rem;
          resize: vertical;
          background-color: ${theme === "dark" ? "#2b2b2b" : "#fff"};
          color: ${theme === "dark" ? "#f9f9f9" : "#000"};
        }
        button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 8px;
          background-color: ${theme === "dark" ? "#57ac42ff" : "#4cb44cff"};
          color: #fff;
          cursor: pointer;
        }
        .rag-timestamp {
          font-size: 0.7rem;
          color: ${theme === "dark" ? "#aaa" : "#555"};
          display: block;
          margin-bottom: 0.2rem;
        }
      `}</style>
    </div>
  );
}
