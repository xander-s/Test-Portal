from fastapi import FastAPI, UploadFile, File, HTTPException, status
from app.detector import detector

app = FastAPI(title="AI Proctoring Microservice")

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/analyze-frame")
async def analyze_frame(file: UploadFile = File(...)):
    # Verify image format (only JPEG/PNG, no WebP conversion for proctor snapshots)
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Frame image must be PNG or JPEG format"
        )
        
    contents = await file.read()
    try:
        analysis = detector.analyze_frame(contents)
        return analysis
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Frame execution error: {str(e)}"
        )
