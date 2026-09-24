# Aeta G4F Provider

Optional, keyless AI adapter for local/development use. G4F providers are community services and may stop working, require browser automation, or change availability at runtime. Aeta never requests or imports user cookies.

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
AI_ALLOWED_ORIGINS=http://localhost:5173 uvicorn app:app --host 0.0.0.0 --port 8000
```

Set `VITE_AI_API_URL=http://localhost:8000` before building/running the frontend. Verify `GET /health`; failed upstreams return `PROVIDER_UNAVAILABLE`. GitHub Pages cannot run Python, so this service must be separately deployed over HTTPS for the published site.
