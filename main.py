#!/usr/bin/env python3
"""
Refleks — Reflexology Agent CLI Entry Point
Refleks — Refleksoloji Ajanı CLI Giriş Noktası

Usage / Kullanım:
    python main.py
    ANTHROPIC_API_KEY=sk-... python main.py
"""

import sys
import os


def check_api_key() -> str:
    """Check for API key in environment."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        print("\n⚠️  ANTHROPIC_API_KEY bulunamadı!")
        print("   API anahtarınızı aşağıdaki yöntemlerden biriyle ayarlayın:\n")
        print("   1. Ortam değişkeni olarak:")
        print("      export ANTHROPIC_API_KEY='sk-ant-...'\n")
        print("   2. Komut satırında:")
        print("      ANTHROPIC_API_KEY='sk-ant-...' python main.py\n")
        print("   API anahtarı almak için: https://console.anthropic.com\n")
        sys.exit(1)
    return api_key


def is_exit_command(text: str) -> bool:
    """Check if user wants to exit."""
    exit_words = {
        "çıkış", "çık", "exit", "quit", "q", "bye",
        "görüşürüz", "hoşçakal", "tamam çık", "kapat"
    }
    return text.strip().lower() in exit_words


def print_separator():
    """Print a visual separator."""
    print("\n" + "─" * 60 + "\n")


def run():
    """Main interactive loop."""
    # Validate API key before importing heavy modules
    api_key = check_api_key()

    # Import agent (after key check to avoid unnecessary imports on error)
    from agent import ReflexologyAgent

    agent = ReflexologyAgent(api_key=api_key)

    # Welcome message
    print(agent.get_welcome_message())

    try:
        while True:
            # Get user input
            try:
                print("Siz 👤 : ", end="", flush=True)
                user_input = input().strip()
            except EOFError:
                # Handle piped input ending
                print("\n\nGörüşmek üzere! 🦶✨")
                break

            # Skip empty input
            if not user_input:
                continue

            # Check for exit
            if is_exit_command(user_input):
                print("\n🦶 Görüşmek üzere! Sağlıklı günler dilerim. ✨\n")
                break

            # Handle special commands
            if user_input.lower() in ("/reset", "/yenile", "/temizle"):
                agent.reset_conversation()
                print("\n✅ Konuşma geçmişi temizlendi.\n")
                continue

            if user_input.lower() in ("/help", "/yardım"):
                print_help()
                continue

            # Get response from agent
            print("\nRefleks 🦶 : ", end="", flush=True)
            try:
                agent.chat(user_input)
                print_separator()
            except Exception as e:
                print(f"\n\n❌ Hata oluştu: {e}\n")
                continue

    except KeyboardInterrupt:
        print("\n\n🦶 Görüşmek üzere! Sağlıklı günler. ✨\n")
        sys.exit(0)


def print_help():
    """Print help information."""
    help_text = """
╔══════════════════════════════════════════════════════╗
║                    📚 YARDIM / HELP                  ║
╠══════════════════════════════════════════════════════╣
║  Örnek sorular / Example questions:                  ║
║                                                      ║
║  🇹🇷 Türkçe:                                          ║
║  • Baş ağrısı için hangi noktalar var?               ║
║  • Kalp bölgesi nerede?                              ║
║  • Stres için refleksoloji noktalarını söyle         ║
║  • Tüm ayak bölgelerini listele                      ║
║  • Baş parmak yürüyüşü nasıl yapılır?                ║
║  • Refleksoloji güvenli mi?                          ║
║  • Sindirim sorunları için hangi noktalar?           ║
║                                                      ║
║  🇬🇧 English:                                         ║
║  • Which zones help with back pain?                  ║
║  • Show me heart reflexology zone                    ║
║  • List all ear reflexology zones                    ║
║  • How do I do thumb walking?                        ║
║  • Is reflexology safe during pregnancy?             ║
║                                                      ║
║  Komutlar / Commands:                                ║
║  /reset veya /yenile → Konuşmayı sıfırla            ║
║  /help veya /yardım  → Bu yardım menüsü             ║
║  çıkış veya exit     → Programdan çık               ║
╚══════════════════════════════════════════════════════╝
"""
    print(help_text)


if __name__ == "__main__":
    run()
