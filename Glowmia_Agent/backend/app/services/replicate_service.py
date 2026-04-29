import re
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.services.prompt_builder import build_edit_prompt, build_edit_translation_prompt

logger = get_logger(__name__)


class ReplicateService:
    def __init__(self) -> None:
        self.base_url = "https://api.replicate.com/v1"
        self.timeout = settings.request_timeout_seconds

    def _headers(self) -> dict[str, str]:
        if not settings.replicate_api_token:
            raise RuntimeError("Replicate API token is not configured")
        return {
            "Authorization": f"Bearer {settings.replicate_api_token}",
            "Content-Type": "application/json",
            "Prefer": "wait",
        }

    def _model_prediction_url(self, model_identifier: str) -> str:
        if ":" in model_identifier:
            return f"{self.base_url}/predictions"
        owner, name = model_identifier.split("/", maxsplit=1)
        return f"{self.base_url}/models/{owner}/{name}/predictions"

    def _contains_foreign_script(self, text: str) -> bool:
        if not text.strip():
            return False

        if re.search(r"[\u0400-\u04FF]", text):
            return True

        latin_words = re.findall(r"\b[A-Za-z]{2,}\b", text)
        return len(latin_words) > 0

    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        history: list[dict[str, str]] | None = None,
    ) -> str:
        model_identifier = settings.replicate_llm_model
        payload: dict[str, Any] = {
            "input": {
                "system_prompt": system_prompt,
                "prompt": user_prompt,
                "messages": history or [],
            },
        }
        if ":" in model_identifier:
            payload["version"] = model_identifier
        data = await self._create_prediction(model_identifier, payload)
        output = data.get("output") or []
        if isinstance(output, list):
            return "".join(str(chunk) for chunk in output).strip()
        return str(output).strip()

    async def polish_arabic_text(self, text: str) -> str:
        if not text.strip():
            return text

        rewritten = await self.generate_text(
            system_prompt=(
                "You rewrite Arabic fashion-assistant replies into polished, natural Arabic. "
                "Preserve the exact meaning and fashion advice. "
                "Use Arabic script only, unless an unavoidable brand name must remain foreign. "
                "Translate foreign-script fashion terms into natural Arabic whenever possible. "
                "Return only the rewritten Arabic reply."
            ),
            user_prompt=f"Rewrite this reply in polished Arabic only:\n{text}",
        )
        cleaned = rewritten.strip() or text

        if not self._contains_foreign_script(cleaned):
            return cleaned

        final_rewrite = await self.generate_text(
            system_prompt=(
                "You rewrite Arabic replies into clean Arabic script only. "
                "Remove every foreign-script word and replace it with a natural Arabic equivalent whenever possible. "
                "Preserve the meaning exactly. Return only the final Arabic reply."
            ),
            user_prompt=f"Clean this Arabic reply so it contains Arabic script only:\n{cleaned}",
        )

        final_cleaned = final_rewrite.strip() or cleaned
        return final_cleaned

    async def edit_image(self, image_url: str, instruction: str, language: str = "en") -> str:
        effective_instruction = instruction
        effective_language = language
        if language == "ar":
            translated_instruction = await self.generate_text(
                system_prompt=(
                    "You translate Arabic fashion image-edit instructions into precise English prompts for image editing models. "
                    "Return only the translated instruction."
                ),
                user_prompt=build_edit_translation_prompt(instruction),
            )
            if translated_instruction.strip():
                effective_instruction = translated_instruction.strip()
                effective_language = "en"

        model_identifier = settings.replicate_model
        payload: dict[str, Any] = {
            "input": {
                "input_image": image_url,
                "prompt": build_edit_prompt(effective_language, effective_instruction),
                "aspect_ratio": "match_input_image",
                "output_format": "png",
                "prompt_upsampling": False,
                "safety_tolerance": 2,
            },
        }
        if ":" in model_identifier:
            payload["version"] = model_identifier
        data = await self._create_prediction(model_identifier, payload)
        output = data.get("output")
        if isinstance(output, list) and output:
            return str(output[-1])
        if isinstance(output, str):
            return output
        raise RuntimeError("Replicate image edit did not return an output URL")

    async def _create_prediction(self, model_identifier: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self._model_prediction_url(model_identifier),
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            prediction = response.json()
            prediction_id = prediction["id"]

            status_value = prediction.get("status")
            while status_value not in {"succeeded", "failed", "canceled"}:
                poll_response = await client.get(
                    f"{self.base_url}/predictions/{prediction_id}",
                    headers=self._headers(),
                )
                poll_response.raise_for_status()
                prediction = poll_response.json()
                status_value = prediction.get("status")

            if status_value != "succeeded":
                logger.error("Replicate prediction failed: %s", prediction)
                raise RuntimeError("Replicate prediction failed")

            return prediction
