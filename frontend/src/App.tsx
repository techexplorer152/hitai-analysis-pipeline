import React, { useState, useEffect, useRef } from 'react';
import type { AnalysisLog, AnalysisSnapshot, PostResponse } from './types';
import { PIPELINE_STAGES } from './types';
import './App.css';

const BACKEND_URL = 'http://localhost:8000';

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState<string>('idle');
  const [currentStage, setCurrentStage] = useState<string>('queued');
  const [progress, setProgress] = useState<number>(0);
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    setIsLoading(true);
    closeStream();
    setLogs([]);
    setProgress(0);
    setCurrentStage('queued');

    try {
      const res = await fetch(`${BACKEND_URL}/analyses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl }),
      });

      const data: PostResponse = await res.json();
      sessionStorage.setItem('active_analysis_id', data.analysis_id);
      setStatus(data.status);

      startStreaming(data.analysis_id);
    } catch (err) {
      alert('Failed to submit video analysis job.');
    } finally {
      setIsLoading(false);
    }
  };

  const startStreaming = (id: string) => {
    closeStream();
    setIsReconnecting(false);

    const es = new EventSource(`${BACKEND_URL}/analyses/${id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('progress', (event) => {
      const packet: AnalysisLog = JSON.parse(event.data);
      setCurrentStage(packet.stage);
      setProgress(packet.progress);
      setStatus('processing');
      setLogs((prev) => [packet, ...prev].slice(0, 10));
    });

    es.addEventListener('status', (event) => {
      setStatus(event.data);
      if (event.data === 'completed') {
        setProgress(1);
        sessionStorage.removeItem('active_analysis_id');
      }
      if (event.data === 'failed') {
        sessionStorage.removeItem('active_analysis_id');
      }
      closeStream();
    });

    es.onerror = () => {
      setIsReconnecting(true);
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          catchUpWithSnapshot(id);
        }
      }, 3000);
    };
  };

  const catchUpWithSnapshot = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/analyses/${id}`);
      if (!res.ok) throw new Error();

      const snapshot: AnalysisSnapshot = await res.json();
      setStatus(snapshot.status);
      setVideoUrl(snapshot.video_url);

      if (snapshot.last_progress_event) {
        setCurrentStage(snapshot.last_progress_event.stage);
        setProgress(snapshot.last_progress_event.progress);
      }

      if (snapshot.status === 'completed' || snapshot.status === 'failed') {
        sessionStorage.removeItem('active_analysis_id');
        closeStream();
        setIsReconnecting(false);
      } else {
        startStreaming(id);
      }
    } catch (err) {
      console.error('Error fetching snapshot context, retrying...');
    }
  };

  useEffect(() => {
    const savedId = sessionStorage.getItem('active_analysis_id');
    if (savedId) {
      catchUpWithSnapshot(savedId);
    }
    return () => closeStream();
  }, []);

  const activeStageIndex = PIPELINE_STAGES.findIndex(s => s.id === currentStage);

  return (
    <div className="dashboard-container">
      <h2>HITAI Combat Video Analysis Engine</h2>

      <form onSubmit={handleSubmit} className="analysis-form">
        <input
          type="url"
          placeholder="Paste boxing match URL (e.g., https://youtube.com/watch...)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          required
          className="url-input"
        />
        <button type="submit" disabled={isLoading} className="submit-btn">
          {isLoading ? 'Submitting...' : 'Analyze Video'}
        </button>
      </form>

      {status !== 'idle' && (
        <div>
          <div className="status-header">
            <h4>
              System Status:{' '}
              <span className={`status-badge ${status}`}>
                {status.toUpperCase()}
              </span>
            </h4>
            {isReconnecting && (
              <span className="reconnect-alert">
                 Reconnecting to stream...
              </span>
            )}
          </div>

          <div className="pipeline-stepper">
            {PIPELINE_STAGES.map((step, idx) => {
              const isPassed = idx < activeStageIndex;
              const isActive = idx === activeStageIndex;
              const stepClass = isPassed ? 'completed' : isActive ? 'active' : '';

              return (
                <div key={step.id} className={`step-node ${stepClass}`}>
                  <div className="step-circle">
                    {idx + 1}
                  </div>
                  <div className="step-label">{step.label}</div>
                </div>
              );
            })}
          </div>

          <div className="progress-container">
            <div className="progress-meta">
              <span>Current Phase: <strong>{currentStage.replace('_', ' ')}</strong></span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>

          <h4 className="logs-section-title">Live Analytics Stream (Max 10 Logs)</h4>
          <div className="console-terminal">
            {logs.length === 0 ? (
              <span className="empty-logs">Waiting for logs...</span>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="log-line">
                  <span className="log-timestamp">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span>Stage: </span>
                  <span className="log-stage">{log.stage}</span>
                  <span> | Progress: {Math.round(log.progress * 100)}% - {log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}