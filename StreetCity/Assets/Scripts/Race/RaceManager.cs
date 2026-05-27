using UnityEngine;
using UnityEngine.UI;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Street City: Open World Mobile
/// RaceManager - Yarış sistemi yöneticisi
/// 3 yarış modu: Şehir Yarışı, Zamanlı Yarış, Polis Kovalamacalı Yarış
/// </summary>
public class RaceManager : MonoBehaviour
{
    public static RaceManager Instance { get; private set; }

    // ---- Yarış Modu Enum ----
    public enum RaceMode
    {
        CityRace,        // Kısa şehir yarışı
        TimedRace,       // Zamanlı yarış
        PoliceChaseRace  // Polis kovalamacalı yarış
    }

    public enum RaceState
    {
        Idle,
        Countdown,
        Racing,
        Finished
    }

    [Header("Yarış Ayarları")]
    public RaceMode currentMode = RaceMode.CityRace;
    public float raceTimeLimit = 120f;        // Süre sınırı (saniye)
    public int totalLaps = 1;                 // Tur sayısı

    [Header("Yarış Noktaları")]
    public Transform startLine;              // Başlangıç çizgisi
    public Transform finishLine;             // Bitiş çizgisi
    public Transform[] checkpoints;          // Kontrol noktaları

    [Header("AI Rakipler")]
    public AICarController[] aiRacers;       // AI yarışmacılar

    [Header("Countdown UI")]
    public GameObject countdownPanel;
    public Text countdownText;
    public Text racePositionText;
    public Text raceTimerText;
    public Text lapText;
    public GameObject raceResultPanel;
    public Text resultText;
    public Text resultRewardText;
    public Button retryButton;
    public Button exitRaceButton;

    [Header("Ödüller")]
    public int firstPlaceReward = 500;
    public int secondPlaceReward = 250;
    public int thirdPlaceReward = 100;

    // ---- Private değişkenler ----
    private RaceState raceState = RaceState.Idle;
    private float raceTimer = 0f;
    private int playerPosition = 1;
    private int playerCheckpoint = 0;
    private int playerLap = 0;
    private bool playerFinished = false;
    private float countdownValue = 3f;

    // Rakiplerin checkpoint takibi
    private Dictionary<AICarController, int> aiCheckpoints = new Dictionary<AICarController, int>();
    private Dictionary<AICarController, int> aiLaps = new Dictionary<AICarController, int>();

    public RaceState CurrentState => raceState;
    public bool IsRacing => raceState == RaceState.Racing;

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        SetupRaceUI(false);
    }

    void Update()
    {
        switch (raceState)
        {
            case RaceState.Racing:
                UpdateRaceTimer();
                UpdatePlayerPosition();
                break;
        }
    }

    // ========================
    // Yarışı başlat
    // ========================
    public void StartRace(RaceMode mode)
    {
        currentMode = mode;
        raceState = RaceState.Countdown;
        raceTimer = 0f;
        playerCheckpoint = 0;
        playerLap = 0;
        playerFinished = false;

        // AI'ları başlangıç pozisyonlarına ayarla
        SetupAIRacers();

        // UI'ı göster
        SetupRaceUI(true);

        // Geri sayım başlat
        StartCoroutine(CountdownRoutine());

        // Polis kovalamacalı modda polis spawn et
        if (mode == RaceMode.PoliceChaseRace)
        {
            PoliceChaseSystem.Instance?.SetWantedLevel(1);
        }

        Debug.Log($"[RaceManager] Yarış başlıyor: {mode}");
    }

    // ========================
    // Geri sayım
    // ========================
    IEnumerator CountdownRoutine()
    {
        // Oyuncuyu durdur
        SetPlayerCarEnabled(false);

        if (countdownPanel != null) countdownPanel.SetActive(true);

        // 3, 2, 1 BAŞLA
        for (int i = 3; i >= 1; i--)
        {
            if (countdownText != null)
            {
                countdownText.text = i.ToString();
                countdownText.color = Color.red;
            }
            AudioManager.Instance?.PlaySFX("countdown_beep");
            yield return new WaitForSeconds(1f);
        }

        // BAŞLA!
        if (countdownText != null)
        {
            countdownText.text = "BAŞLA!";
            countdownText.color = Color.green;
        }
        AudioManager.Instance?.PlaySFX("race_start");

        // AI'ları başlat
        foreach (var ai in aiRacers)
        {
            if (ai != null) ai.StartRacing();
        }

        // Oyuncuyu serbest bırak
        SetPlayerCarEnabled(true);

        yield return new WaitForSeconds(0.8f);

        if (countdownPanel != null) countdownPanel.SetActive(false);
        raceState = RaceState.Racing;

        Debug.Log("[RaceManager] YARIŞA BAŞLADI!");
    }

    // ========================
    // Yarış zamanlayıcısı
    // ========================
    void UpdateRaceTimer()
    {
        raceTimer += Time.deltaTime;

        if (raceTimerText != null)
        {
            int mins = (int)(raceTimer / 60f);
            int secs = (int)(raceTimer % 60f);
            raceTimerText.text = $"{mins:00}:{secs:00}";
        }

        // Süre sınırlı modda - süre dolunca yarış biter
        if (currentMode == RaceMode.TimedRace && raceTimer >= raceTimeLimit)
        {
            FinishRace(false); // Süre doldu = kaybettin
        }
    }

    // ========================
    // Oyuncu sıralamasını güncelle
    // ========================
    void UpdatePlayerPosition()
    {
        int pos = 1;
        Transform playerTransform = GameManager.Instance?.GetPlayerCar()?.transform;
        if (playerTransform == null) return;

        float playerProgress = GetRaceProgress(playerCheckpoint, playerLap, playerTransform.position);

        foreach (var ai in aiRacers)
        {
            if (ai == null) continue;
            int aiCheckpoint = aiCheckpoints.ContainsKey(ai) ? aiCheckpoints[ai] : 0;
            int aiLap = aiLaps.ContainsKey(ai) ? aiLaps[ai] : 0;
            float aiProgress = GetRaceProgress(aiCheckpoint, aiLap, ai.transform.position);

            if (aiProgress > playerProgress) pos++;
        }

        playerPosition = pos;
        UpdatePositionUI();
    }

    float GetRaceProgress(int checkpoint, int lap, Vector3 pos)
    {
        float lapProgress = (float)(checkpoint + 1) / (checkpoints.Length + 1);
        return lap + lapProgress;
    }

    void UpdatePositionUI()
    {
        if (racePositionText == null) return;
        string[] suffixes = { "", "1.", "2.", "3.", "4." };
        string suffix = playerPosition <= 4 ? suffixes[playerPosition] : playerPosition + ".";
        racePositionText.text = $"{suffix} SIRADA";

        if (lapText != null)
            lapText.text = $"TUR: {playerLap + 1}/{totalLaps}";
    }

    // ========================
    // Checkpoint geçme
    // ========================
    public void OnPlayerPassedCheckpoint(int checkpointIndex)
    {
        if (raceState != RaceState.Racing) return;
        if (checkpointIndex != playerCheckpoint) return; // Sırayla geçilmeli

        playerCheckpoint++;

        if (playerCheckpoint >= checkpoints.Length)
        {
            // Tur tamamlandı
            playerCheckpoint = 0;
            playerLap++;

            if (playerLap >= totalLaps)
            {
                // Yarış bitti!
                FinishRace(true);
            }
        }

        Debug.Log($"[RaceManager] Oyuncu checkpoint {checkpointIndex} geçti");
    }

    public void OnAIPassedCheckpoint(AICarController ai, int checkpointIndex)
    {
        if (!aiCheckpoints.ContainsKey(ai)) aiCheckpoints[ai] = 0;
        if (!aiLaps.ContainsKey(ai)) aiLaps[ai] = 0;

        if (checkpointIndex != aiCheckpoints[ai]) return;
        aiCheckpoints[ai]++;

        if (aiCheckpoints[ai] >= checkpoints.Length)
        {
            aiCheckpoints[ai] = 0;
            aiLaps[ai]++;

            // AI yarışı bitirirse
            if (aiLaps[ai] >= totalLaps && !playerFinished)
            {
                // AI rakip oyuncudan önce bitirdi
                Debug.Log($"[RaceManager] AI rakip yarışı bitirdi!");
            }
        }
    }

    // ========================
    // Yarışı bitir
    // ========================
    void FinishRace(bool playerWon)
    {
        if (playerFinished) return;
        playerFinished = true;
        raceState = RaceState.Finished;

        // AI'ları durdur
        foreach (var ai in aiRacers)
        {
            if (ai != null) ai.StopRacing();
        }

        // Oyuncuyu durdur
        SetPlayerCarEnabled(false);

        // Polis kovalamacasını durdur
        if (currentMode == RaceMode.PoliceChaseRace)
        {
            PoliceChaseSystem.Instance?.ClearWantedLevel();
        }

        // Sonuç hesapla
        int reward = 0;
        string resultMsg = "";

        if (playerWon)
        {
            switch (playerPosition)
            {
                case 1:
                    reward = firstPlaceReward;
                    resultMsg = "🏆 BİRİNCİ OLDUN!";
                    break;
                case 2:
                    reward = secondPlaceReward;
                    resultMsg = "🥈 İKİNCİ OLDUN!";
                    break;
                case 3:
                    reward = thirdPlaceReward;
                    resultMsg = "🥉 ÜÇÜNCÜ OLDUN!";
                    break;
                default:
                    reward = 0;
                    resultMsg = "❌ KAYBETTİN";
                    break;
            }
        }
        else
        {
            resultMsg = "❌ SÜRE DOLDU!";
        }

        // Ödülü ver
        if (reward > 0)
        {
            MoneySystem.Instance?.AddMoney(reward);
            AudioManager.Instance?.PlaySFX("mission_complete");
        }
        else
        {
            AudioManager.Instance?.PlaySFX("race_fail");
        }

        // Sonuç UI'ı göster
        ShowRaceResult(resultMsg, reward);

        // Puan ekle
        GameManager.Instance?.AddScore(reward);

        Debug.Log($"[RaceManager] Yarış bitti! Sonuç: {resultMsg}, Ödül: {reward}");
    }

    // ========================
    // Sonuç UI
    // ========================
    void ShowRaceResult(string message, int reward)
    {
        if (raceResultPanel != null) raceResultPanel.SetActive(true);
        if (resultText != null) resultText.text = message;
        if (resultRewardText != null)
            resultRewardText.text = reward > 0 ? $"+{reward} $" : "";

        if (retryButton != null)
            retryButton.onClick.AddListener(() => RestartRace());
        if (exitRaceButton != null)
            exitRaceButton.onClick.AddListener(() => ExitRace());

        StartCoroutine(EnablePlayerAfterDelay(2f));
    }

    IEnumerator EnablePlayerAfterDelay(float delay)
    {
        yield return new WaitForSeconds(delay);
        SetPlayerCarEnabled(true);
    }

    // ========================
    // Yarıştan çık / Yeniden dene
    // ========================
    public void RestartRace()
    {
        SetupRaceUI(false);
        StartRace(currentMode);
    }

    public void ExitRace()
    {
        raceState = RaceState.Idle;
        SetupRaceUI(false);
        SetPlayerCarEnabled(true);

        // Tüm AI'ları normal moda döndür
        foreach (var ai in aiRacers)
        {
            if (ai != null) ai.ReturnToPatrol();
        }
    }

    // ========================
    // Yardımcı fonksiyonlar
    // ========================
    void SetPlayerCarEnabled(bool enabled)
    {
        var playerCar = GameManager.Instance?.GetPlayerCar();
        if (playerCar != null)
        {
            if (!enabled)
            {
                playerCar.SetMotorInput(0);
                playerCar.SetBrakeInput(true);
            }
            else
            {
                playerCar.SetBrakeInput(false);
            }
        }
    }

    void SetupAIRacers()
    {
        aiCheckpoints.Clear();
        aiLaps.Clear();

        for (int i = 0; i < aiRacers.Length; i++)
        {
            if (aiRacers[i] == null) continue;
            aiCheckpoints[aiRacers[i]] = 0;
            aiLaps[aiRacers[i]] = 0;

            // Başlangıç pozisyonuna ayarla
            if (startLine != null)
            {
                Vector3 offset = startLine.right * (i + 1) * 3f;
                aiRacers[i].transform.position = startLine.position + offset;
                aiRacers[i].transform.rotation = startLine.rotation;
            }
        }
    }

    void SetupRaceUI(bool show)
    {
        if (raceResultPanel != null) raceResultPanel.SetActive(false);
        if (countdownPanel != null) countdownPanel.SetActive(false);
        if (raceTimerText != null) raceTimerText.gameObject.SetActive(show);
        if (racePositionText != null) racePositionText.gameObject.SetActive(show);
        if (lapText != null) lapText.gameObject.SetActive(show);
    }

    public float GetRaceTime() => raceTimer;
    public int GetPlayerPosition() => playerPosition;
}
