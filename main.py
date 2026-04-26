from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import json
from logic import analyze_json_data

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        raise HTTPException(500, "index.html not found")


@app.post("/analyze")
async def analyze_emotion(file: UploadFile = File(...)):
    try:
        content = await file.read()
        data = json.loads(content)

        emotion, intensity = analyze_json_data(data)

        return {"emotion": emotion, "intensity": intensity}

    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON format")

    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)