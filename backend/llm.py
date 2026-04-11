"""
Shared LLM caller with timeout and rate-limit handling.

All AI endpoints import `call_llm` from here instead of duplicating
the provider switching logic. The Groq client is created once at
module level for connection pooling.
"""

import asyncio

from config import AI_PROVIDER, AI_MODEL, GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY

_LLM_TIMEOUT = 15  # seconds — fail fast on Render free tier

# Module-level clients for connection reuse
_groq_client = None
_openai_client = None
_anthropic_client = None


def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY, timeout=_LLM_TIMEOUT)
    return _groq_client


def _get_openai():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        _openai_client = OpenAI(api_key=OPENAI_API_KEY, timeout=_LLM_TIMEOUT)
    return _openai_client


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        _anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _anthropic_client


_RATE_LIMIT_MSG = "AI coach is resting — refresh in a moment."


def _call_llm_sync(prompt: str, max_tokens: int = 250) -> str:
    if AI_PROVIDER == "groq":
        client = _get_groq()
        try:
            response = client.chat.completions.create(
                model=AI_MODEL,
                max_tokens=max_tokens,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            err = str(e)
            if "rate_limit_exceeded" in err or "429" in err:
                return _RATE_LIMIT_MSG
            if "timeout" in err.lower() or "timed out" in err.lower():
                return _RATE_LIMIT_MSG
            raise

    elif AI_PROVIDER == "openai":
        client = _get_openai()
        response = client.chat.completions.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()

    elif AI_PROVIDER == "anthropic":
        client = _get_anthropic()
        response = client.messages.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    else:
        raise ValueError(f"Unknown AI_PROVIDER: '{AI_PROVIDER}'.")


async def call_llm(prompt: str, max_tokens: int = 250) -> str:
    return await asyncio.to_thread(_call_llm_sync, prompt, max_tokens)
