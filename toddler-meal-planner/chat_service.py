"""OpenAI chat completions helper for LittleBowl."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import requests


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


class ChatConfigError(Exception):
    def __init__(self, message: str, code: str = "NO_API_KEY"):
        super().__init__(message)
        self.code = code


class ChatRequestError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def call_openai_chat(
    *,
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    key = api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ChatConfigError(
            "OPENAI_API_KEY is not set. Add it to toddler-meal-planner/.env to enable chat."
        )
    if not messages:
        raise ChatConfigError("Missing messages array.", code="BAD_REQUEST")

    payload: Dict[str, Any] = {
        "model": model or os.environ.get("OPENAI_CHAT_MODEL") or "gpt-4o-mini",
        "messages": messages,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    try:
        res = requests.post(
            OPENAI_CHAT_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            },
            json=payload,
            timeout=60,
        )
    except requests.RequestException as exc:
        raise ChatRequestError(f"Could not reach OpenAI: {exc}") from exc

    data = {}
    try:
        data = res.json()
    except Exception:
        data = {}

    if not res.ok:
        message = (data.get("error") or {}).get("message") if isinstance(data, dict) else None
        raise ChatRequestError(message or f"OpenAI API error ({res.status_code})", status=res.status_code)

    return data


def chat_configured() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def summarize_chat_history(
    *,
    messages: List[Dict[str, Any]],
    prior_summary: Optional[str] = None,
    toddler_name: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    """
    Compress older chat turns into a short rolling summary for session continuity.
    """
    lines = []
    for m in messages:
        role = (m.get("role") or "").strip().lower()
        content = (m.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        label = "Parent" if role == "user" else "Assistant"
        lines.append(f"{label}: {content}")
    if not lines and not (prior_summary or "").strip():
        return ""

    name = toddler_name or "the toddler"
    prior = (prior_summary or "").strip() or "(none)"
    transcript = "\n".join(lines) if lines else "(no new messages)"

    prompt = (
        f"You maintain a rolling summary of a parent chat about {name}'s meals and nutrition "
        "in the LittleBowl app.\n"
        "Update the summary so a future assistant can continue helpfully without the full transcript.\n"
        "Keep: food likes/dislikes, allergies/safety notes, plan changes requested or applied, "
        "open questions, and key advice already given.\n"
        "Drop chit-chat. Max 8 short sentences. Plain text only.\n\n"
        f"Prior summary:\n{prior}\n\n"
        f"New messages to fold in:\n{transcript}"
    )

    try:
        data = call_openai_chat(
            messages=[
                {
                    "role": "system",
                    "content": "You write concise chat memory summaries for a toddler meal planner.",
                },
                {"role": "user", "content": prompt},
            ],
            tools=None,
            api_key=api_key,
        )
        choice = (data.get("choices") or [{}])[0]
        content = ((choice.get("message") or {}).get("content") or "").strip()
        if content:
            return content
    except (ChatConfigError, ChatRequestError):
        pass

    # Offline / API fallback: compact extractive memory
    bits = []
    if prior and prior != "(none)":
        bits.append(prior)
    for line in lines[-12:]:
        bits.append(line[:160])
    joined = " | ".join(bits)
    return joined[:1200]