using UnityEngine;
using UnityEngine.UI;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Street City: Open World Mobile
/// MissionManager - Görev sistemi yöneticisi
/// Teslimat, yarış, kaçış ve park görevleri
/// </summary>
public class MissionManager : MonoBehaviour
{
    public static MissionManager Instance { get; private set; }

    // ---- Görev Tipi Enum ----
    public enum MissionType
    {
        GoToPoint,       // Belirli noktaya git
        Delivery,        // Süre dolmadan teslimat yap
        Race,            // Yarış kazan
        EscapePolice,    // Polisten kaç
        ParkCar          // Arabayı garaja götür
    }

    // ---- Görev Verisi ----
    [System.Serializable]
    public class MissionData
    {
        public string missionName;
        public string description;
        public MissionType type;
        public Transform missionPoint;       // Görev başlangıç noktası
        public Transform targetPoint;        // Hedef nokta
        public float timeLimit = 60f;        // Süre sınırı
        public int reward = 200;             // Para ödülü
        public int scoreReward = 100;        // Puan ödülü
        public bool isActive = false;
        public bool isCompleted = false;
    }

    [Header("Görev Listesi")]
    public MissionData[] missions;

    [Header("Görev UI")]
    public GameObject missionPanel;           // Görev bilgi paneli
    public Text missionNameText;
    public Text missionDescText;
    public Text missionTimerText;
    public Text missionRewardText;
    public GameObject missionCompletePanel;
    public Text missionCompleteText;
    public Text missionCompleteRewardText;
    public GameObject missionFailPanel;
    public Text missionFailText;

    [Header("Görev Noktası Göstergesi")]
    public GameObject missionMarkerPrefab;   // Haritada görev ikonları
    public Color activeMarkerColor = Color.yellow;
    public Color completedMarkerColor = Color.green;

    // ---- Private değişkenler ----
    private MissionData currentMission = null;
    private float missionTimer = 0f;
    private bool missionTimerRunning = false;
    private List<GameObject> missionMarkers = new List<GameObject>();

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        SetupMissionMarkers();
        HideMissionUI();
    }

    void Update()
    {
        if (missionTimerRunning && currentMission != null)
        {
            UpdateMissionTimer();
        }
    }

    // ========================
    // Görev marker'larını oluştur
    // ========================
    void SetupMissionMarkers()
    {
        if (missionMarkerPrefab == null) return;

        foreach (var mission in missions)
        {
            if (mission.missionPoint == null) continue;

            GameObject marker = Instantiate(missionMarkerPrefab, mission.missionPoint.position, Quaternion.identity);
            marker.name = $"MissionMarker_{mission.missionName}";
            missionMarkers.Add(marker);

            // Trigger collider ekle
            SphereCollider col = marker.AddComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = 3f;

            // MissionTrigger component ekle
            MissionTrigger trigger = marker.AddComponent<MissionTrigger>();
            trigger.missionData = mission;
        }
    }

    // ========================
    // En yakın görevi başlat
    // ========================
    public void StartNearestMission()
    {
        if (currentMission != null) return; // Zaten görev var

        Transform playerPos = GameManager.Instance?.GetPlayerCar()?.transform;
        if (playerPos == null) return;

        MissionData nearest = null;
        float nearestDist = float.MaxValue;

        foreach (var mission in missions)
        {
            if (mission.isCompleted || mission.isActive) continue;
            if (mission.missionPoint == null) continue;

            float dist = Vector3.Distance(playerPos.position, mission.missionPoint.position);
            if (dist < nearestDist)
            {
                nearestDist = dist;
                nearest = mission;
            }
        }

        if (nearest != null && nearestDist < 10f)
        {
            StartMission(nearest);
        }
    }

    // ========================
    // Görevi başlat
    // ========================
    public void StartMission(MissionData mission)
    {
        currentMission = mission;
        mission.isActive = true;

        missionTimer = 0f;
        missionTimerRunning = mission.type == MissionType.Delivery ||
                              mission.type == MissionType.EscapePolice;

        // UI göster
        ShowMissionUI(mission);

        // Hedef marker göster
        ShowTargetMarker(mission.targetPoint);

        // Görev tipine özel başlatma
        switch (mission.type)
        {
            case MissionType.Race:
                StartCoroutine(StartRaceMission());
                break;
            case MissionType.EscapePolice:
                PoliceChaseSystem.Instance?.SetWantedLevel(2);
                break;
        }

        AudioManager.Instance?.PlaySFX("mission_start");
        Debug.Log($"[Mission] Görev başladı: {mission.missionName}");
    }

    IEnumerator StartRaceMission()
    {
        yield return new WaitForSeconds(0.5f);
        RaceManager.Instance?.StartRace(RaceManager.RaceMode.CityRace);
    }

    // ========================
    // Görev zamanlayıcısı
    // ========================
    void UpdateMissionTimer()
    {
        missionTimer += Time.deltaTime;
        float remaining = currentMission.timeLimit - missionTimer;

        if (missionTimerText != null)
        {
            missionTimerText.text = remaining > 0
                ? $"Süre: {remaining:F0}s"
                : "SÜRE DOLDU!";
            missionTimerText.color = remaining < 10f ? Color.red : Color.white;
        }

        // Süre doldu
        if (missionTimer >= currentMission.timeLimit)
        {
            FailMission("Süre Doldu!");
        }
    }

    // ========================
    // Hedefe ulaşıldı (MissionTrigger tarafından çağrılır)
    // ========================
    public void OnPlayerReachedTarget()
    {
        if (currentMission == null) return;

        // Görev tipine göre kontrol
        switch (currentMission.type)
        {
            case MissionType.GoToPoint:
            case MissionType.Delivery:
            case MissionType.ParkCar:
                CompleteMission();
                break;
            case MissionType.EscapePolice:
                if (!PoliceChaseSystem.Instance?.IsWanted() ?? true)
                    CompleteMission();
                break;
        }
    }

    // ========================
    // Görevi tamamla
    // ========================
    void CompleteMission()
    {
        if (currentMission == null) return;

        currentMission.isCompleted = true;
        currentMission.isActive = false;
        missionTimerRunning = false;

        // Ödül ver
        MoneySystem.Instance?.AddMoney(currentMission.reward);
        GameManager.Instance?.AddScore(currentMission.scoreReward);

        // Bonus: Hızlı teslimatta ekstra ödül
        if (currentMission.type == MissionType.Delivery)
        {
            float remaining = currentMission.timeLimit - missionTimer;
            if (remaining > currentMission.timeLimit * 0.5f)
            {
                int bonus = currentMission.reward / 2;
                MoneySystem.Instance?.AddMoney(bonus);
            }
        }

        // Polis görevinde - polis sıfırla
        if (currentMission.type == MissionType.EscapePolice)
        {
            PoliceChaseSystem.Instance?.ClearWantedLevel();
        }

        // UI
        ShowMissionComplete(currentMission);

        AudioManager.Instance?.PlaySFX("mission_complete");
        currentMission = null;

        Debug.Log("[Mission] Görev tamamlandı!");
    }

    // ========================
    // Görev başarısız
    // ========================
    void FailMission(string reason = "Görev Başarısız")
    {
        if (currentMission == null) return;

        currentMission.isActive = false;
        missionTimerRunning = false;

        if (missionFailPanel != null)
        {
            missionFailPanel.SetActive(true);
            if (missionFailText != null)
                missionFailText.text = $"❌ {reason}";
        }

        StartCoroutine(HideMissionUIDelayed(3f));

        AudioManager.Instance?.PlaySFX("mission_fail");
        currentMission = null;

        Debug.Log($"[Mission] Görev başarısız: {reason}");
    }

    // ========================
    // UI yönetimi
    // ========================
    void ShowMissionUI(MissionData mission)
    {
        if (missionPanel != null) missionPanel.SetActive(true);
        if (missionNameText != null) missionNameText.text = mission.missionName;
        if (missionDescText != null) missionDescText.text = mission.description;
        if (missionRewardText != null) missionRewardText.text = $"Ödül: {mission.reward} $";
    }

    void HideMissionUI()
    {
        if (missionPanel != null) missionPanel.SetActive(false);
        if (missionCompletePanel != null) missionCompletePanel.SetActive(false);
        if (missionFailPanel != null) missionFailPanel.SetActive(false);
    }

    void ShowMissionComplete(MissionData mission)
    {
        if (missionPanel != null) missionPanel.SetActive(false);
        if (missionCompletePanel != null) missionCompletePanel.SetActive(true);
        if (missionCompleteText != null) missionCompleteText.text = "✅ GÖREV TAMAMLANDI!";
        if (missionCompleteRewardText != null)
            missionCompleteRewardText.text = $"+{mission.reward} $";

        StartCoroutine(HideMissionUIDelayed(3f));
    }

    void ShowTargetMarker(Transform target)
    {
        if (target == null) return;
        MiniMapController.Instance?.SetMissionTarget(target.position);
    }

    IEnumerator HideMissionUIDelayed(float delay)
    {
        yield return new WaitForSeconds(delay);
        HideMissionUI();
    }

    // ========================
    // Dışarıdan erişim
    // ========================
    public bool HasActiveMission() => currentMission != null;
    public MissionData GetCurrentMission() => currentMission;
}

// ========================
// Görev Trigger Component
// ========================
public class MissionTrigger : MonoBehaviour
{
    public MissionManager.MissionData missionData;
    public bool isTarget = false; // True ise hedef nokta

    void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player")) return;

        if (isTarget)
        {
            MissionManager.Instance?.OnPlayerReachedTarget();
        }
        else if (!missionData.isCompleted && !missionData.isActive)
        {
            MissionManager.Instance?.StartMission(missionData);
        }
    }
}
