import React, { useState, useEffect } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_GATEWAY_URL;

interface ParkingSession {
  id: string;
  plateNumber: string;
  image: string;
  entryTime: string;
  exitTime?: string;
  amount?: number;
  status: "ACTIVE" | "COMPLETED";
}

type Mode = "entry" | "exit";
type UploadStatus = "idle" | "uploading" | "error";

export default function App() {
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [mode, setMode] = useState<Mode>("entry");

  const fetchSessions = async () => {
    const res = await fetch(`${API}/sessions`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : Array.isArray(data.body) ? data.body : JSON.parse(data.body ?? "[]");
    setSessions(list);
  };

  useEffect(() => { fetchSessions(); }, []);

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [selectedReceipt, setSelectedReceipt] = useState<ParkingSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("uploading");
    setErrorMsg(null);

    try {
      const presignRes = await fetch(`${API}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: mode, fileName: file.name, contentType: file.type }),
      });
      const { url } = await presignRes.json();
      await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await fetchSessions();
      setUploadStatus("idle");
      e.target.value = "";
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setUploadStatus("error");
    }
  };

  const active = sessions.filter((s) => s.status === "ACTIVE");
  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const totalRevenue = completed.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  return (
    <div className="container">
      <div className="header">
        <h1>Ticketless Parking System</h1>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">{active.length}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat">
          <span className="stat-value">{completed.length}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat">
          <span className="stat-value">R{totalRevenue}</span>
          <span className="stat-label">Revenue</span>
        </div>
      </div>

      <div className="card">
        <div className="mode-toggle">
          <button className={`mode-btn ${mode === "entry" ? "active-entry" : ""}`} onClick={() => setMode("entry")}>Entry</button>
          <button className={`mode-btn ${mode === "exit" ? "active-exit" : ""}`} onClick={() => setMode("exit")}>Exit</button>
        </div>

        {errorMsg && <p className="error-msg">{errorMsg}</p>}

        <label className="upload-label">
          <div className={`upload-zone ${uploadStatus}`}>
            <p>
              {uploadStatus === "uploading"
                ? "Uploading..."
                : uploadStatus === "error"
                ? "Upload failed — try again"
                : `Upload ${mode === "entry" ? "Entry" : "Exit"} Image`}
            </p>
            <span>{uploadStatus === "idle" ? "Click to select a file" : ""}</span>
            {uploadStatus === "uploading" && <div className="upload-progress"><div className="upload-progress-bar" /></div>}
          </div>
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploadStatus === "uploading"} />
        </label>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Active Sessions</span>
          <span className="card-count">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <div className="empty">No active sessions</div>
        ) : (
          active.map((s) => (
            <div key={s.id} className="session">
              <img src={s.image} alt={s.plateNumber} className="thumb" />
              <div className="session-info">
                <span className="badge badge-active">Active</span>
                <p className="session-plate">{s.plateNumber}</p>
                <p className="meta">Entry — {new Date(s.entryTime).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Receipts</span>
          <span className="card-count">{completed.length}</span>
        </div>
        {completed.length === 0 ? (
          <div className="empty">No receipts yet</div>
        ) : (
          completed.map((s) => (
            <div key={s.id} className="receipt-item">
              <div>
                <span className="badge badge-done">Completed</span>
                <p className="receipt-plate">{s.plateNumber}</p>
                <p className="receipt-fee">R{s.amount?.toFixed(2)}</p>
              </div>
              <button className="button" onClick={() => setSelectedReceipt(s)}>View Receipt</button>
            </div>
          ))
        )}
      </div>

      {selectedReceipt && (
        <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Parking Receipt</h2>
              <button className="modal-close" onClick={() => setSelectedReceipt(null)}>x</button>
            </div>
            <img src={selectedReceipt.image} alt={selectedReceipt.plateNumber} className="receipt-image" />
            <div className="receipt-details">
              <p><span>Plate Number</span><strong>{selectedReceipt.plateNumber}</strong></p>
              <p><span>Entry Time</span><strong>{new Date(selectedReceipt.entryTime).toLocaleString()}</strong></p>
              <p><span>Exit Time</span><strong>{new Date(selectedReceipt.exitTime!).toLocaleString()}</strong></p>
              <p className="receipt-total"><span>Total Fee</span><strong>R{selectedReceipt.amount?.toFixed(2)}</strong></p>
            </div>
            <button className="button" style={{ width: "100%" }} onClick={() => setSelectedReceipt(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
