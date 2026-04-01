import os
from dotenv import load_dotenv 

load_dotenv()  

# ── Swap model here in one line ───────────────────────────────────────────────
AI_PROVIDER = "groq"
AI_MODEL    = "llama-3.3-70b-versatile"
# ─────────────────────────────────────────────────────────────────────────────

GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")