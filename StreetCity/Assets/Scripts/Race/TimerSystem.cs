using UnityEngine;
using UnityEngine.UI;
using System;

/// <summary>
/// Street City: Open World Mobile
/// TimerSystem - Genel zamanlayıcı sistemi
/// Görev süreleri, yarış süreleri ve diğer zamanlama işlemleri
/// </summary>
public class TimerSystem : MonoBehaviour
{
    public static TimerSystem Instance { get; private set; }

    [Header("UI")]
    public Text timerDisplay;          // Ana zamanlayıcı göstergesi
    public Text countdownDisplay;      // Geri sayım göstergesi

    // ---- Zamanlayıcı yapısı ----
    private class Timer
    {
        public string id;
        public float duration;
        public float elapsed;
        public bool isCountdown;   // true = geri sayım, false = yukarı sayım
        public bool isRunning;
        public bool isPaused;
        public Action onComplete;
        public Action<float> onTick;
    }

    private System.Collections.Generic.Dictionary<string, Timer> timers =
        new System.Collections.Generic.Dictionary<string, Timer>();

    // Aktif ana zamanlayıcı ID'si
    private string activeTimerId = null;

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Update()
    {
        UpdateAllTimers();
        UpdateMainDisplay();
    }

    // ========================
    // Yeni zamanlayıcı başlat
    // ========================
    public string StartTimer(string id, float duration, bool isCountdown = false,
                             Action onComplete = null, Action<float> onTick = null)
    {
        Timer timer = new Timer
        {
            id = id,
            duration = duration,
            elapsed = 0f,
            isCountdown = isCountdown,
            isRunning = true,
            isPaused = false,
            onComplete = onComplete,
            onTick = onTick
        };

        timers[id] = timer;
        return id;
    }

    // ========================
    // Zamanlayıcıları güncelle
    // ========================
    void UpdateAllTimers()
    {
        List<string> toRemove = new List<string>();

        foreach (var kvp in timers)
        {
            Timer t = kvp.Value;
            if (!t.isRunning || t.isPaused) continue;

            t.elapsed += Time.deltaTime;
            t.onTick?.Invoke(GetCurrentValue(t));

            // Tamamlandı mı?
            if (t.elapsed >= t.duration)
            {
                t.elapsed = t.duration;
                t.isRunning = false;
                t.onComplete?.Invoke();
                toRemove.Add(kvp.Key);
            }
        }

        // Tamamlanan zamanlayıcıları kaldır
        foreach (var key in toRemove)
            timers.Remove(key);
    }

    // Şu anki değeri al
    float GetCurrentValue(Timer t)
    {
        return t.isCountdown ? t.duration - t.elapsed : t.elapsed;
    }

    // ========================
    // Ana display güncelleme
    // ========================
    void UpdateMainDisplay()
    {
        if (timerDisplay == null || activeTimerId == null) return;
        if (!timers.ContainsKey(activeTimerId)) return;

        float value = GetCurrentValue(timers[activeTimerId]);
        timerDisplay.text = FormatTime(value);

        // Süre azalıyorsa renk değiştir
        if (timers[activeTimerId].isCountdown)
        {
            if (value < 10f)
                timerDisplay.color = Color.red;
            else if (value < 30f)
                timerDisplay.color = Color.yellow;
            else
                timerDisplay.color = Color.white;
        }
    }

    // ========================
    // Zamanlayıcı kontrol
    // ========================
    public void PauseTimer(string id)
    {
        if (timers.ContainsKey(id))
            timers[id].isPaused = true;
    }

    public void ResumeTimer(string id)
    {
        if (timers.ContainsKey(id))
            timers[id].isPaused = false;
    }

    public void StopTimer(string id)
    {
        if (timers.ContainsKey(id))
            timers.Remove(id);
    }

    public void StopAllTimers()
    {
        timers.Clear();
        activeTimerId = null;
    }

    public float GetTimerValue(string id)
    {
        if (!timers.ContainsKey(id)) return 0f;
        return GetCurrentValue(timers[id]);
    }

    public bool IsTimerRunning(string id)
    {
        return timers.ContainsKey(id) && timers[id].isRunning;
    }

    // ========================
    // Display ayarla
    // ========================
    public void SetActiveDisplay(string id)
    {
        activeTimerId = id;
        if (timerDisplay != null)
            timerDisplay.gameObject.SetActive(true);
    }

    public void HideDisplay()
    {
        activeTimerId = null;
        if (timerDisplay != null)
            timerDisplay.gameObject.SetActive(false);
    }

    // ========================
    // Geri sayım başlat (UI entegreli)
    // ========================
    public void StartCountdownDisplay(float duration, Action onComplete = null)
    {
        if (countdownDisplay != null)
            countdownDisplay.gameObject.SetActive(true);

        StartTimer("countdown_display", duration, true,
            onComplete: () =>
            {
                if (countdownDisplay != null)
                    countdownDisplay.gameObject.SetActive(false);
                onComplete?.Invoke();
            },
            onTick: (value) =>
            {
                if (countdownDisplay != null)
                    countdownDisplay.text = Mathf.CeilToInt(value).ToString();
            });
    }

    // ========================
    // Zaman formatı: 00:00
    // ========================
    public static string FormatTime(float seconds)
    {
        int mins = (int)(seconds / 60f);
        int secs = (int)(seconds % 60f);
        return $"{mins:00}:{secs:00}";
    }

    // MM:SS.mm formatı
    public static string FormatTimePrecise(float seconds)
    {
        int mins = (int)(seconds / 60f);
        int secs = (int)(seconds % 60f);
        int ms = (int)((seconds - (int)seconds) * 100f);
        return $"{mins:00}:{secs:00}.{ms:00}";
    }

    // ========================
    // Private list yardımcısı
    // ========================
    private class List<T> : System.Collections.Generic.List<T> { }
}
