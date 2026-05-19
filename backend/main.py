from fastapi import FastAPI, BackgroundTasks
from datetime import datetime, timezone
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
import asyncio
import uuid


app = FastAPI()



#Our Database
analyses_db = {}



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


PIPELINE_STAGES = [
    {"stage": "downloading_video", "seconds": 3, "msg": "Downloading combat video footage..."},
    {"stage": "extracting_frames", "seconds": 6, "msg": "Extracting frames at 60fps for analysis..."},
    {"stage": "detecting_actions", "seconds": 10, "msg": "AI identifying fighter strikes and guards..."},
    {"stage": "segmenting_rounds", "seconds": 5, "msg": "Parsing round timestamps and intervals..."},
    {"stage": "generating_insights", "seconds": 4, "msg": "Compiling fighter performance analytics..."}
]


class VideoRequest(BaseModel):
    video_url: str

async def run_ai_simulation(new_id: str):
    try:

        analyses_db[new_id]["status"] = "processing"


        for step in PIPELINE_STAGES:
            stage_name = step["stage"]
            total_seconds = step["seconds"]
            base_message = step["msg"]

            for elapsed in range(1, total_seconds + 1):
                await asyncio.sleep(1)

                progress_pct = round(elapsed / total_seconds, 2)

                log_packet = {
                    "analysis_id": new_id,
                    "stage": stage_name,
                    "progress": progress_pct,
                    "message": base_message if stage_name != "detecting_actions" else f"Detected {elapsed * 3} combat actions so far",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }


                analyses_db[new_id]["logs"].append(log_packet)

        analyses_db[new_id]["status"] = "completed"
    except Exception:
        analyses_db[new_id]["status"] = "failed"


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
async def analyses_stream(id: str):

    if id not in analyses_db:
        raise HTTPException(status_code=404, detail="Analysis ID not found")


    async def log_pusher():
        sent_count = 0

        while True:
            folder = analyses_db.get(id)

            if not folder:
                break

            total_logs = len(folder["logs"])

            if sent_count < total_logs:
                for i in range(sent_count, total_logs):
                    yield {
                        "event": "progress",
                        "data": folder["logs"][i]
                    }
                sent_count = total_logs

            if folder["status"] in ["completed", "failed"] and sent_count == total_logs:
                yield {
                    "event": "status",
                    "data": folder["status"]
                }
                break

            await asyncio.sleep(0.5)


    return EventSourceResponse(log_pusher())


@app.get("/analyses/{id}")
def analyses_get(id: str):
    if id not in analyses_db:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    folder = analyses_db[id]

    return {
        "status": folder["status"],
        "video_url": folder["url"],
        "last_progress_event": folder["logs"][-1] if folder["logs"] else None
    }