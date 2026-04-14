import { useEffect, useRef, useState } from "react";
import { createSession, sendMessage, sendEdit } from "./api/glowmia";
import "./index.css";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDress, setSelectedDress] = useState(null);
  const [mode, setMode] = useState("recommend"); // recommend | edit
  const [error, setError] = useState("");

  const chatEndRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const session = await createSession();
        setSessionId(session.id);

        setMessages([
          {
            role: "assistant",
            type: "text",
            text: "Hi, I’m Glowmia AI. Ask me for a dress recommendation in English or Arabic, then choose a dress to edit it inside the chat.",
          },
        ]);
      } catch (err) {
        console.error(err);
        setError("Failed to create chat session.");
      }
    };

    init();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, selectedDress, mode, error]);

  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleSelectDressForEdit = (dress) => {
    setSelectedDress(dress);
    setMode("edit");
    setError("");

    addMessage({
      role: "assistant",
      type: "text",
      text: `Selected "${dress.name}" for editing. Now type your edit request, like "make it red" or "add long sleeves".`,
    });
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !sessionId || loading) return;

    addMessage({
      role: "user",
      type: "text",
      text: trimmed,
    });

    setInput("");
    setLoading(true);
    setError("");

    try {
      if (mode === "edit" && selectedDress) {
        const res = await sendEdit(sessionId, {
          dress_id: selectedDress.id,
          image_url: selectedDress.image_url,
          instruction: trimmed,
        });

        if (!res?.edited_image_url) {
          addMessage({
            role: "assistant",
            type: "text",
            text: "The edit request finished, but no edited image was returned.",
          });
        } else {
          addMessage({
            role: "assistant",
            type: "edit",
            data: {
              ...res,
              dress_name: selectedDress.name,
            },
          });
        }

        return;
      }

      const res = await sendMessage(sessionId, trimmed);
      const results = res?.results || [];

      if (!results.length) {
        addMessage({
          role: "assistant",
          type: "text",
          text: "I couldn’t find matching dresses for that request. Try changing the color, occasion, or style.",
        });
      } else {
        addMessage({
          role: "assistant",
          type: "recommend",
          data: results,
        });
      }
    } catch (err) {
      console.error(err);

      const detail =
        err?.response?.data?.detail ||
        "Something went wrong while talking to the backend.";

      setError(detail);

      addMessage({
        role: "assistant",
        type: "text",
        text: `Error: ${detail}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="page">
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: "8px 14px",
              borderRadius: "999px",
              color: "#d8dfff",
              fontSize: "13px",
              marginBottom: "12px",
            }}
          >
            Glowmia AI Chat Test
          </div>

          <h1 style={{ margin: 0, fontSize: "32px" }}>Glowmia Chat</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", marginTop: "8px" }}>
            Test recommendations and chained edits in one chat flow.
          </p>
        </div>

        <div
          style={{
            flex: 1,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
            borderRadius: "24px",
            padding: "20px",
            overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.22)",
            minHeight: "500px",
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  padding:
                    msg.type === "recommend" || msg.type === "edit"
                      ? "14px"
                      : "12px 14px",
                  borderRadius: "18px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #7c5cff, #31c3ff)"
                      : "rgba(255,255,255,0.06)",
                  border:
                    msg.role === "user"
                      ? "none"
                      : "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              >
                {msg.type === "text" && <div>{msg.text}</div>}

                {msg.type === "recommend" && (
                  <div>
                    <div style={{ marginBottom: "12px", fontWeight: 600 }}>
                      I found these dresses:
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      {msg.data.map((dress) => (
                        <div
                          key={dress.id}
                          style={{
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "16px",
                            overflow: "hidden",
                            background: "rgba(255,255,255,0.04)",
                          }}
                        >
                          <img
                            src={dress.image_url}
                            alt={dress.name}
                            style={{
                              width: "100%",
                              aspectRatio: "4 / 5",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />

                          <div style={{ padding: "12px" }}>
                            <div
                              style={{
                                fontWeight: 600,
                                marginBottom: "6px",
                                lineHeight: 1.35,
                              }}
                            >
                              {dress.name}
                            </div>

                            <div
                              style={{
                                fontSize: "13px",
                                color: "rgba(255,255,255,0.72)",
                                marginBottom: "10px",
                              }}
                            >
                              {dress.color || "No color"} • {dress.category || "dress"}
                            </div>

                            <button
                              onClick={() => handleSelectDressForEdit(dress)}
                              style={{
                                border: 0,
                                borderRadius: "12px",
                                padding: "10px 12px",
                                cursor: "pointer",
                                background: "linear-gradient(135deg, #7c5cff, #31c3ff)",
                                color: "white",
                                fontWeight: 600,
                                width: "100%",
                              }}
                            >
                              Edit this dress
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {msg.type === "edit" && (
                  <div>
                    <div style={{ marginBottom: "10px", fontWeight: 600 }}>
                      Edited result for {msg.data.dress_name}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "rgba(255,255,255,0.72)",
                            marginBottom: "8px",
                          }}
                        >
                          Input image used
                        </div>
                        <img
                          src={msg.data.original_image_url}
                          alt="Input image used"
                          style={{
                            width: "100%",
                            borderRadius: "14px",
                            display: "block",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        />
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "rgba(255,255,255,0.72)",
                            marginBottom: "8px",
                          }}
                        >
                          Edited image
                        </div>
                        <img
                          src={msg.data.edited_image_url}
                          alt="Edited result"
                          style={{
                            width: "100%",
                            borderRadius: "14px",
                            display: "block",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        />
                      </div>
                    </div>

                    {msg.data.parsed_edits &&
                      Object.keys(msg.data.parsed_edits).length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.72)",
                              marginBottom: "8px",
                            }}
                          >
                            Applied edits
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            {Object.entries(msg.data.parsed_edits).map(([key, value]) => (
                              <span
                                key={key}
                                style={{
                                  display: "inline-flex",
                                  padding: "7px 11px",
                                  borderRadius: "999px",
                                  background: "rgba(124, 92, 255, 0.13)",
                                  border: "1px solid rgba(124, 92, 255, 0.28)",
                                  color: "#ebe7ff",
                                  fontSize: "13px",
                                }}
                              >
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ color: "rgba(255,255,255,0.72)", marginTop: "10px" }}>
              Glowmia is thinking...
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {selectedDress && mode === "edit" && (
          <div
            style={{
              marginTop: "14px",
              padding: "14px",
              borderRadius: "18px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img
              src={selectedDress.image_url}
              alt={selectedDress.name}
              style={{
                width: "64px",
                height: "80px",
                objectFit: "cover",
                borderRadius: "12px",
              }}
            />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.72)" }}>
                Editing selected dress
              </div>
              <div style={{ fontWeight: 600 }}>{selectedDress.name}</div>
            </div>

            <button
              onClick={() => {
                setSelectedDress(null);
                setMode("recommend");
              }}
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                borderRadius: "12px",
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              Cancel edit
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px 14px",
              borderRadius: "14px",
              background: "rgba(255, 107, 125, 0.12)",
              border: "1px solid rgba(255, 107, 125, 0.26)",
              color: "#ffd7dd",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            gap: "10px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "edit" && selectedDress
                ? `Edit "${selectedDress.name}"...`
                : "Ask for a dress recommendation..."
            }
            style={{
              flex: 1,
              minHeight: "56px",
              maxHeight: "160px",
              resize: "vertical",
              padding: "14px 16px",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(6, 10, 22, 0.55)",
              color: "white",
              outline: "none",
            }}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || !sessionId}
            style={{
              border: 0,
              borderRadius: "16px",
              padding: "14px 18px",
              cursor: "pointer",
              background: "linear-gradient(135deg, #7c5cff, #31c3ff)",
              color: "white",
              fontWeight: 700,
              opacity: !input.trim() || loading || !sessionId ? 0.6 : 1,
            }}
          >
            {loading ? "Sending..." : mode === "edit" ? "Apply Edit" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;