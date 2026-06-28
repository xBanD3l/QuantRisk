from __future__ import annotations

import os
from dataclasses import dataclass

from ..schemas import ModelResult


@dataclass(frozen=True)
class Persona:
    name: str
    role: str
    model: str


PERSONAS: dict[str, Persona] = {
    "GARCH": Persona("Sophia", "Risk Manager", "GARCH"),
    "Historical": Persona("Maya", "Market Historian", "Historical"),
    "Monte Carlo": Persona("Ethan", "Simulation Specialist", "Monte Carlo"),
    "Bayesian": Persona("Liam", "Bayesian Researcher", "Bayesian"),
    "Bootstrap": Persona("Ava", "Bootstrap Statistician", "Bootstrap"),
    "EWMA": Persona("Noah", "Portfolio Analyst", "EWMA"),
}


def pct(value: float) -> str:
    return f"{value * 100:+.2f}%"


def prob(value: float) -> str:
    return f"{value * 100:.1f}%"


def compact_model_evidence(result: ModelResult) -> list[str]:
    return [
        f"Expected return {pct(result.expected_return)}",
        f"95% VaR {pct(result.var95)}",
        f"Expected shortfall {pct(result.expected_shortfall)}",
        f"Probability positive {prob(result.prob_positive)}",
        f"Confidence score {prob(result.confidence_score)}",
    ]


class AIProviderAdapter:
    def __init__(self, api_key: str | None):
        self.api_key = api_key

    async def generate_statement(
        self,
        persona: Persona,
        result: ModelResult,
        peers: list[ModelResult] | None = None,
    ) -> str | None:
        return None


class LocalCommitteeAdapter(AIProviderAdapter):
    async def generate_statement(
        self,
        persona: Persona,
        result: ModelResult,
        peers: list[ModelResult] | None = None,
    ) -> str | None:
        risk_tone = "downside risk is material" if result.var95 < -0.08 else "downside risk is contained"
        direction = "positive" if result.expected_return > 0 else "negative"
        assumption = result.assumptions[0] if result.assumptions else "its core sampling assumptions"
        peer_note = ""
        if peers:
            optimistic = max(peers, key=lambda item: item.expected_return)
            conservative = min(peers, key=lambda item: item.var95)
            if optimistic.expected_return > result.expected_return + 0.015:
                peer_note = (
                    f" {optimistic.model} is more constructive at {pct(optimistic.expected_return)}, "
                    f"which I would weigh if recent volatility moderates."
                )
            elif conservative.var95 < result.var95 - 0.01:
                peer_note = (
                    f" {conservative.model} flags a deeper tail at {pct(conservative.var95)}, "
                    f"and that would raise my concern if the volatility regime persists."
                )
        change_trigger = (
            f"My view would shift if realized volatility diverged from {assumption.lower()} "
            f"or if the expected-return estimate moved beyond the current interval "
            f"[{pct(result.confidence_interval[0])}, {pct(result.confidence_interval[1])}]."
        )
        return (
            f"{persona.name} ({persona.role}) reads the {result.model} evidence as a {direction} "
            f"signal over the horizon. The model estimates an expected return of {pct(result.expected_return)}, "
            f"VaR of {pct(result.var95)}, and a positive-return probability of {prob(result.prob_positive)}; "
            f"under its assumptions, {risk_tone}.{peer_note} {change_trigger}"
        )


class OpenAIAdapter(AIProviderAdapter):
    async def generate_statement(
        self,
        persona: Persona,
        result: ModelResult,
        peers: list[ModelResult] | None = None,
    ) -> str | None:
        return await _post_openai(self.api_key, _statement_prompt(persona, result, peers))


class AnthropicAdapter(AIProviderAdapter):
    async def generate_statement(
        self,
        persona: Persona,
        result: ModelResult,
        peers: list[ModelResult] | None = None,
    ) -> str | None:
        return await _post_anthropic(self.api_key, _statement_prompt(persona, result, peers))


class GeminiAdapter(AIProviderAdapter):
    async def generate_statement(
        self,
        persona: Persona,
        result: ModelResult,
        peers: list[ModelResult] | None = None,
    ) -> str | None:
        return await _post_gemini(self.api_key, _statement_prompt(persona, result, peers))


def make_adapter(provider: str, api_key: str | None) -> AIProviderAdapter:
    if not api_key or provider == "local":
        return LocalCommitteeAdapter(None)
    if provider == "openai":
        return OpenAIAdapter(api_key)
    if provider == "anthropic":
        return AnthropicAdapter(api_key)
    if provider == "gemini":
        return GeminiAdapter(api_key)
    return LocalCommitteeAdapter(None)


def _statement_prompt(persona: Persona, result: ModelResult, peers: list[ModelResult] | None = None) -> str:
    evidence = "\n".join(f"- {item}" for item in compact_model_evidence(result))
    assumptions = "\n".join(f"- {item}" for item in result.assumptions)
    peer_lines = ""
    if peers:
        peer_lines = "\nPeer model outputs (reference only, do not invent numbers):\n" + "\n".join(
            f"- {peer.model}: expected return {pct(peer.expected_return)}, VaR {pct(peer.var95)}"
            for peer in peers[:4]
        )
    return (
        "You are writing one concise institutional quant committee statement.\n"
        "Rules: reference only the provided metrics, do not invent numbers, stay within this model's domain, "
        "explain one assumption, one uncertainty, what would change your view, and optionally reference a peer "
        "model when disagreeing. Avoid investment advice and theatrical debate.\n\n"
        f"Persona: {persona.name}, {persona.role}\n"
        f"Assigned model: {result.model}\n"
        f"Model reasoning: {result.reasoning}\n"
        f"Metrics:\n{evidence}\n"
        f"Assumptions:\n{assumptions}\n"
        f"{peer_lines}\n\n"
        "Return only the statement, 3 to 5 sentences."
    )


async def _post_openai(api_key: str | None, prompt: str) -> str | None:
    if not api_key:
        return None
    try:
        import httpx  # type: ignore

        model = os.getenv("OPENAI_MODEL") or "gpt-4.1-mini"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You summarize quantitative model output without inventing metrics."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return None


async def _post_anthropic(api_key: str | None, prompt: str) -> str | None:
    if not api_key:
        return None
    try:
        import httpx  # type: ignore

        model = os.getenv("ANTHROPIC_MODEL") or "claude-3-5-sonnet-latest"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 220,
                    "temperature": 0.2,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"].strip()
    except Exception:
        return None


async def _post_gemini(api_key: str | None, prompt: str) -> str | None:
    if not api_key:
        return None
    try:
        import httpx  # type: ignore

        model = os.getenv("GEMINI_MODEL") or "gemini-1.5-pro"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                url,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 220},
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None

