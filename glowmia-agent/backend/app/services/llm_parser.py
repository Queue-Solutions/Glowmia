import json
from openai import OpenAI
from app.config import get_settings

settings = get_settings()
client = OpenAI(api_key=settings.openai_api_key)


def extract_preferences_llm(query: str):
    try:
        prompt = f"""
Extract structured fashion preferences from this user request.

Return ONLY valid JSON in this exact format:
{{
  "color": string or null,
  "occasion": list,
  "style": list
}}

User request:
"{query}"
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You extract structured fashion preferences from user requests and return only valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0
        )

        text = response.choices[0].message.content.strip()
        return json.loads(text)

    except Exception as e:
        print("LLM parsing failed:", e)
        return None