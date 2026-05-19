export interface AnalysisLog {
  analysis_id: string;
  stage: string;
  progress: number;
  message: string;
  timestamp: string;
}

export interface AnalysisSnapshot {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  video_url: string;
  last_progress_event: AnalysisLog | null;
}

export interface PostResponse {
  status: 'queued';
  analysis_id: string;
}

export const PIPELINE_STAGES = [
  { id: 'queued', label: 'Queued' },
  { id: 'downloading_video', label: 'Downloading Video' },
  { id: 'extracting_frames', label: 'Extracting Frames' },
  { id: 'detecting_actions', label: 'Detecting Actions' },
  { id: 'segmenting_rounds', label: 'Segmenting Rounds' },
  { id: 'generating_insights', label: 'Generating Insights' }
];