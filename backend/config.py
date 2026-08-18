import os
from dotenv import load_dotenv 

load_dotenv()  

# ── Swap model here in one line ───────────────────────────────────────────────
AI_PROVIDER = "groq"
AI_MODEL    = "groq/compound-mini"
# ─────────────────────────────────────────────────────────────────────────────

GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")