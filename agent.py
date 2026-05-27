"""
Reflexology Agent — Anthropic SDK Integration
Refleksoloji Ajanı — Anthropic SDK Entegrasyonu

Uses:
- claude-opus-4-7 with adaptive thinking
- Prompt caching for the large system prompt
- Tool use for zone lookups and technique guidance
- Streaming for real-time output
"""

import os
import sys
import json
import anthropic

from tools import TOOL_DEFINITIONS, dispatch_tool


# ─── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Sen "Refleks" adında uzman bir refleksoloji asistanısın. Hem Türkçe hem de İngilizce konuşabilirsin.

## Kimliğin
- Adın: **Refleks** 🦶
- Uzmanlık alanın: Ayak, el ve kulak refleksolojisi
- Kişiliğin: Sıcak, sabırlı, bilgili ve şefkatli bir terapist gibi konuşursun
- Amacın: Kullanıcılara refleksoloji noktaları, teknikler ve faydalar hakkında rehberlik etmek

## Yeteneklerin
Aşağıdaki araçları kullanabilirsin:
1. **lookup_zone** — Belirli bir refleksoloji bölgesini ID'siyle sorgula
2. **find_zones_by_symptom** — Semptomlara göre ilgili bölgeleri bul
3. **get_technique_guide** — Masaj tekniği talimatları getir
4. **get_safety_info** — Güvenlik bilgileri ve kontrendikasyonlar
5. **list_all_zones** — Mevcut tüm bölgeleri listele

## Yanıt Kuralları
- Kullanıcı Türkçe konuşuyorsa → Türkçe yanıtla
- Kullanıcı İngilizce konuşuyorsa → İngilizce yanıtla
- Her zaman sıcak ve profesyonel bir ton kullan
- Araç çağrılarından gelen verileri akıcı bir anlatıya dönüştür
- Teknik bilgileri anlaşılır bir dille açıkla
- Baskı yönü ve süresini mutlaka belirt
- Güvenlik uyarılarını ihmal etme

## Önemli Uyarılar
- Refleksoloji tamamlayıcı bir terapidir; tıbbi tedavinin yerini almaz
- Ciddi semptomlar için mutlaka doktora yönlendir
- Hamilelik, yaralanma, derin ven trombozu gibi durumlarda uyarıda bulun
- Her bölge açıklamasının ardından kısa bir güvenlik notu ekle

## Konuşma Stili
- Kısa sorulara kısa yanıtlar ver
- Detaylı sorulara kapsamlı rehberlik sağla
- Emojiler kullanabilirsin (👣 🦶 🤲 👂 ✨ 💆)
- Bölge açıklarken görsel tarifler yap ("ayak tabanının ortası", "baş parmağın altı" gibi)

---

## Reflexology Knowledge Summary

### Foot Reflexology (Ayak Refleksolojisi)
The entire body is mapped on the soles and sides of the feet. Key zones:
- **Toes / Baş Parmaklar**: Brain, head, sinuses, pituitary gland
- **Ball of Foot / Metatarsal Bölge**: Heart, lungs, thyroid, neck, shoulders
- **Arch / Ayak Kemeri**: Digestive organs (stomach, liver, kidneys, pancreas, intestines)
- **Heel / Topuk**: Lower back, sciatic nerve, pelvis, reproductive organs
- **Inner Edge / İç Kenar**: Spine (cervical to lumbar vertebrae)
- **Outer Edge / Dış Kenar**: Shoulder, arm, hip, knee

### Hand Reflexology (El Refleksolojisi)
Hands mirror the foot map but are less sensitive. Useful for self-treatment when feet aren't accessible.
- **Fingertips / Parmak Uçları**: Head and brain
- **Thumb / Baş Parmak**: Brain, pituitary, thyroid
- **Inner Palm / İç Avuç**: Spine, heart, lungs
- **Outer Palm / Dış Avuç**: Shoulder, hip, reproductive organs

### Ear Reflexology / Auriculotherapy (Kulak Refleksolojisi)
The ear resembles an inverted fetus, with the entire body mapped on it:
- **Earlobe / Kulak Memesi**: Head and face (eye, teeth, brain)
- **Antihelix / Antihelix**: Spine and back
- **Concha / Concha**: Internal organs
- **Shen Men**: Master calming point for stress and pain
- **Zero Point**: Balancing and homeostasis

### Core Techniques (Temel Teknikler)
1. **Thumb Walking (Baş Parmak Yürüyüşü)**: Primary technique — caterpillar movement with bent thumb
2. **Finger Walking (Parmak Yürüyüşü)**: Lighter pressure using index finger
3. **Rotation (Rotasyon)**: Circular movement with thumb for small areas
4. **Pinching (Sıkıştırma)**: Gentle squeeze for protruding points (toes, earlobes)
5. **Holding (Tutma)**: Static pressure — hold and release for sensitive/energy points

### Session Guidelines (Seans Rehberi)
- Duration: 30-60 minutes full session; 5-15 minutes targeted treatment
- Pressure: Firm but not painful — "comfortable discomfort"
- Frequency: 2-3 times per week for chronic conditions; daily for acute symptoms
- Preparation: Warm feet first (warm water soak), use lotion/oil for smoother movement
- After session: Drink water to aid detoxification; rest if possible

---

You are ready to help users discover the healing potential of reflexology. Be their knowledgeable, compassionate guide! 🦶✨"""


# ─── Agent Class ──────────────────────────────────────────────────────────────

class ReflexologyAgent:
    """
    Reflexology conversational agent using Anthropic SDK.
    Refleksoloji konuşma ajanı, Anthropic SDK kullanır.
    """

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY")
        )
        self.model = "claude-opus-4-7"
        self.conversation_history: list[dict] = []
        self.max_tokens = 4096

    def _build_system_with_cache(self) -> list[dict]:
        """Build system prompt with prompt caching enabled."""
        return [
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"}
            }
        ]

    def _stream_text(self, stream) -> str:
        """Stream text chunks to stdout and collect the full response."""
        full_text = ""
        for text_chunk in stream.text_stream:
            print(text_chunk, end="", flush=True)
            full_text += text_chunk
        return full_text

    def _handle_tool_calls(self, response_message) -> list[dict]:
        """
        Process all tool use blocks from a response.
        Returns a list of tool result content blocks.
        """
        tool_results = []
        for block in response_message.content:
            if block.type == "tool_use":
                print(f"\n\n🔧 [{block.name}] çalışıyor...", flush=True)
                result_json = dispatch_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_json
                })
        return tool_results

    def chat(self, user_message: str) -> str:
        """
        Process a user message, handle tool calls, and return the final response.
        Bir kullanıcı mesajını işler, araç çağrılarını yönetir ve nihai yanıtı döndürür.
        """
        # Add user message to history
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })

        final_response_text = ""
        max_tool_rounds = 5  # Prevent infinite loops

        for round_num in range(max_tool_rounds):
            # Make API call with streaming
            with self.client.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                system=self._build_system_with_cache(),
                tools=TOOL_DEFINITIONS,
                messages=self.conversation_history,
                thinking={"type": "adaptive"},
            ) as stream:
                # Stream text output to terminal
                streamed_text = ""
                for text_chunk in stream.text_stream:
                    print(text_chunk, end="", flush=True)
                    streamed_text += text_chunk

                # Get the complete message
                response_message = stream.get_final_message()

            stop_reason = response_message.stop_reason

            # Add assistant response to history
            self.conversation_history.append({
                "role": "assistant",
                "content": response_message.content
            })

            if stop_reason == "tool_use":
                # Handle tool calls
                tool_results = self._handle_tool_calls(response_message)

                if tool_results:
                    # Add tool results to history
                    self.conversation_history.append({
                        "role": "user",
                        "content": tool_results
                    })
                    print("\n", flush=True)
                    # Continue to next round to get Claude's response to tool results
                    continue

            # Extract final text from response
            for block in response_message.content:
                if hasattr(block, "text"):
                    final_response_text = block.text
                    break

            # End loop on end_turn or any non-tool_use stop
            break

        return final_response_text

    def reset_conversation(self):
        """Clear conversation history."""
        self.conversation_history = []

    def get_welcome_message(self) -> str:
        return (
            "\n"
            "╔══════════════════════════════════════════════════════════╗\n"
            "║          🦶  REFLEKS — Refleksoloji Asistanı  🦶          ║\n"
            "╠══════════════════════════════════════════════════════════╣\n"
            "║  Merhaba! Ben Refleks, refleksoloji konusunda size       ║\n"
            "║  rehberlik edecek asistanınızım.                         ║\n"
            "║                                                          ║\n"
            "║  Şunları sorabilirsiniz:                                 ║\n"
            "║  • 'Bel ağrısı için hangi noktalar var?'                 ║\n"
            "║  • 'Stres için ayak refleksolojisi nasıl yapılır?'       ║\n"
            "║  • 'Kalp bölgesi nerede, nasıl uyarılır?'                ║\n"
            "║  • 'Tüm teknikleri açıkla'                               ║\n"
            "║  • 'Show me all ear reflexology zones'                   ║\n"
            "║                                                          ║\n"
            "║  Çıkmak için: 'çıkış', 'exit' veya Ctrl+C               ║\n"
            "╚══════════════════════════════════════════════════════════╝\n"
        )
