// AI Video Stüdyosu — masaüstü kabuğu (Faz 1).
// Web arayüzünü (localhost:3000) yerel pencerede açar.
// Faz 4'te yerel FFmpeg render komutları, Faz sonrası güvenli anahtar kasası
// (Windows Credential Manager) buraya Tauri komutları olarak eklenecek.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Tauri uygulaması başlatılamadı");
}
