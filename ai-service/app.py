"""Aeta G4F adapter — development/self-hosted only, no credentials collected."""
import os, time
from typing import Literal
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Aeta AI Provider", version="1.0.0")
origins = [x.strip() for x in os.getenv("AI_ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)

class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=30)
    model: str = Field(default="gpt-4o-mini", max_length=100)
    portfolio_context: dict | None = None

SYSTEM = """You are Aeta AI, a Persian-language educational financial analysis assistant. Clearly label all market and portfolio inputs as DEMO. Never guarantee returns, claim certainty, request credentials, or present output as financial advice. Be concise and explain risk."""

def providers():
    try:
        import g4f.Provider
        return sorted({p.__name__ for p in g4f.Provider.__providers__ if getattr(p, "working", False)})
    except Exception:
        return []

@app.get("/health")
def health():
    available = providers()
    return {"status": "ok" if available else "degraded", "provider": "G4F", "requires_api_key": False, "available_providers": available[:30]}

@app.post("/chat")
async def chat(body: ChatRequest, request: Request):
    started = time.monotonic()
    try:
        from g4f.client import AsyncClient
        messages = [{"role": "system", "content": SYSTEM}]
        if body.portfolio_context:
            messages.append({"role": "system", "content": f"User-approved DEMO portfolio context: {body.portfolio_context}"})
        messages.extend(m.model_dump() for m in body.messages)
        response = await AsyncClient().chat.completions.create(model=body.model, messages=messages, web_search=False)
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("Provider returned an empty response")
        return {"content": content, "provider": "G4F", "model": body.model, "latency_ms": round((time.monotonic()-started)*1000), "disclaimer": "DEMO analysis — not financial advice"}
    except ImportError:
        raise HTTPException(503, detail={"code": "PROVIDER_UNAVAILABLE", "message": "G4F is not installed"})
    except Exception as exc:
        # Do not expose provider internals, cookies, URLs, or stack traces.
        raise HTTPException(503, detail={"code": "PROVIDER_UNAVAILABLE", "message": "No credential-free G4F provider responded", "type": type(exc).__name__})
