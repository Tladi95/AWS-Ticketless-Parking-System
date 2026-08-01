import React, { useState } from "react";
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
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [selectedReceipt, setSelectedReceipt] = useState<ParkingSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("uploading");
    setErrorMsg(null);

    try {
      // Step 1: Get presigned URL from Lambda 1
      const presignRes = await fetch(`${API}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: mode, fileName: file.name, contentType: file.type }),
      });
      const { url, key } = await presignRes.json();

      // Step 2: Upload directly to S3 (triggers Lambda 2)
      await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      const session: ParkingSession = {
        id: Date.now().toString(),
        plateNumber: "Processing...",
        image: `https://${import.meta.env.VITE_S3_BUCKET_NAME}.s3.af-south-1.amazonaws.com/${key}`,
        entryTime: new Date().toISOString(),
        status: "ACTIVE",
      };

      setSessions((prev) =>
        mode === "entry"
          ? [...prev, session]
          : prev.map((s) => (s.plateNumber === session.plateNumber ? session : s))
      );

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
      <h1>Parking Management System</h1>

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

      <section className="card">
        <div className="mode-toggle">
          <button className={`mode-btn ${mode === "entry" ? "active-entry" : ""}`} onClick={() => setMode("entry")}>
            Entry
          </button>
          <button className={`mode-btn ${mode === "exit" ? "active-exit" : ""}`} onClick={() => setMode("exit")}>
            Exit
          </button>
        </div>

        <div className="upload-form">
          {errorMsg && <p className="error-msg">{errorMsg}</p>}
          <label className={`upload-label ${uploadStatus}`}>
            {uploadStatus === "uploading"
              ? "Uploading..."
              : uploadStatus === "error"
              ? "Upload failed — retry"
              : `Upload ${mode === "entry" ? "Entry" : "Exit"} Image`}
            <input type="file" accept="image/*" onChange={handleUpload} disabled={uploadStatus === "uploading"} hidden />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Active Sessions</h2>
        {active.length === 0 ? (
          <p className="empty">No active sessions.</p>
        ) : (
          active.map((s) => (
            <div key={s.id} className="session">
              <img src={s.image} alt={s.plateNumber} className="thumb" />
              <div className="session-info">
                <span className="badge badge-active">Active</span>
                <p><strong>{s.plateNumber}</strong></p>
                <p className="meta">Entry: {new Date(s.entryTime).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h2>Receipts</h2>
        {completed.length === 0 ? (
          <p className="empty">No receipts yet.</p>
        ) : (
          completed.map((s) => (
            <div key={s.id} className="receipt-item">
              <div>
                <span className="badge badge-done">Completed</span>
                <p><strong>{s.plateNumber}</strong></p>
                <p className="meta">Fee: R{s.amount?.toFixed(2)}</p>
              </div>
              <button className="button" onClick={() => setSelectedReceipt(s)}>View Receipt</button>
            </div>
          ))
        )}
      </section>

      {selectedReceipt && (
        <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Parking Receipt</h2>
            <img src={selectedReceipt.image} alt={selectedReceipt.plateNumber} className="receipt-image" />
            <div className="receipt-details">
              <p><span>Plate</span><strong>{selectedReceipt.plateNumber}</strong></p>
              <p><span>Entry</span><strong>{new Date(selectedReceipt.entryTime).toLocaleString()}</strong></p>
              <p><span>Exit</span><strong>{new Date(selectedReceipt.exitTime!).toLocaleString()}</strong></p>
              <p className="receipt-total"><span>Total Fee</span><strong>R{selectedReceipt.amount?.toFixed(2)}</strong></p>
            </div>
            <button className="button" onClick={() => setSelectedReceipt(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
