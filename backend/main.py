from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import uuid

app = FastAPI()
analyses_db = {}


class VideoRequest(BaseModel):
    video_url: str


def run_ai_simulation(new_id: str):
    return "hi"


@app.post("/analyses")
def analyses(video_url: VideoRequest, background_tasks: BackgroundTasks):
    new_id = str(uuid.uuid4())
    analyses_db[new_id] = {
        "status": "queued",
        "url": video_url.video_url,
        "logs": []
    }
    background_tasks.add_task(run_ai_simulation, new_id)
    return {
        "status": "queued",
        "analysis_id": new_id
    }


@app.get("/analyses/{id}/stream")
def analyses_stream(id: int):
    return "hi"


@app.get("/analyses/{id}")
def analyses_get(id: int):
    return "hi"