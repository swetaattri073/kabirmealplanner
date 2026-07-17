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
