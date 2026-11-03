# Server speech endpoint (`POST /tts`)

For languages the phone has no voice for. Today that is Western Armenian (voice id `hyw`).
The app side is `src/services/tts.ts`; this is what it expects from the server.

Status: the endpoint below is NOT tested. It was written without being able to download or run
the model. Check the points under "Verify before relying on it".

## Contract

Request: `POST {API_URL}/tts`, JSON `{ "text": "բարեւ", "voice": "hyw" }`

Response: the audio bytes, with the right `Content-Type` (`audio/wav`, `audio/mpeg`, ...).
Any non-2xx status or empty body is treated as "no audio" and the card simply stays silent.

The app keeps every answer on the phone (one file per voice + text), so each word is requested
at most once per install. It also asks for the NEXT card's audio ahead of time.

`voice` is the only thing that selects how the audio is made. To change provider later (or add
another language) only the server changes; the app and its cache stay as they are. Because the
cache is keyed by voice id, use a NEW id (e.g. `hyw2`) for a better voice, otherwise phones keep
playing the old audio.

## Example implementation (Python, FastAPI)

```python
import io
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from scipy.io import wavfile
from transformers import AutoTokenizer, VitsModel

app = FastAPI()

# voice id -> Hugging Face model. Add more entries for more languages or providers.
VOICES = {"hyw": "facebook/mms-tts-hyw"}  # Western Armenian. Licence: CC-BY-NC 4.0 (non-commercial)
_loaded = {}


def load(voice: str):
    if voice not in VOICES:
        raise HTTPException(status_code=400, detail="unknown voice")
    if voice not in _loaded:
        name = VOICES[voice]
        _loaded[voice] = (VitsModel.from_pretrained(name).eval(), AutoTokenizer.from_pretrained(name))
    return _loaded[voice]


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    voice: str


@app.post("/tts")
def tts(request: TtsRequest):
    model, tokenizer = load(request.voice)
    inputs = tokenizer(request.text.strip().lower(), return_tensors="pt")
    if inputs["input_ids"].shape[-1] == 0:
        raise HTTPException(status_code=422, detail="nothing to say")
    with torch.no_grad():
        waveform = model(**inputs).waveform[0].numpy()
    # 16-bit PCM: Android's player does not reliably play 32-bit float WAV files.
    pcm = (np.clip(waveform, -1.0, 1.0) * 32767).astype(np.int16)
    buffer = io.BytesIO()
    wavfile.write(buffer, model.config.sampling_rate, pcm)
    return Response(buffer.getvalue(), media_type="audio/wav")
```

`requirements.txt`: `fastapi`, `uvicorn`, `torch` (CPU build), `transformers`, `scipy`, `numpy`.

Cloud Run: about 2 GiB memory. Download the model while building the image (call
`from_pretrained` once in the Dockerfile) so a cold start does not fetch it. The first request
after an idle period will still be slow (model load), which the app tolerates by timing out after
20 seconds and trying again on the next play.

## Verify before relying on it

1. Listen to a handful of words (`scripts/armenian-tts-test.mjs` prepares them from your deck).
   The model was trained on Western Armenian but I could not judge how it sounds.
2. The model card's example passes text straight to the tokenizer. Confirm that lower-casing is
   right and that no romanization step (uroman) is needed for `hyw` by comparing a word with and
   without `.lower()`.
3. Confirm the WAV plays in the app on your phone.
4. Licence: CC-BY-NC 4.0 means non-commercial. Fine for personal use. Before publishing, see
   `docs/accounts-and-backend.md`.

## Before this is public

The endpoint must sit behind the same sign-in, App Check and per-user rate limits as the other
endpoints, otherwise anyone can use your server's CPU.
