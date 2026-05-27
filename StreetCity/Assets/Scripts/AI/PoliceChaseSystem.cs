using UnityEngine;
using UnityEngine.UI;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Street City: Open World Mobile
/// PoliceChaseSystem - Polis kovalamaca ve wanted sistemi
/// 1-3 yıldız sistemi, polis spawning ve takip yönetimi
/// </summary>
public class PoliceChaseSystem : MonoBehaviour
{
    public static PoliceChaseSystem Instance { get; private set; }

    [Header("Wanted Sistem")]
    public int maxWantedLevel = 3;
    [Tooltip("Wanted level artmadan önce gereken çarpışma/ihlal sayısı")]
    public int violationsPerLevel = 3;

    [Header("Polis Araç Prefab'ları")]
    public GameObject policePrefab;          // Polis araç prefab
    public Transform[] policeSpawnPoints;    // Polis spawn noktaları

    [Header("Polis Ayarları")]
    public float chaseDistance = 60f;        // Takibi bırakma mesafesi
    public float cooldownTime = 15f;         // Wanted sıfırlanma süresi (kaçınca)
    public float spawnDistance = 40f;        // Oyuncudan ne kadar uzağa spawn et

    [Header("UI")]
    public GameObject[] wantedStars;         // Yıldız ikonları (3 adet)
    public GameObject wantedPanel;
    public Text wantedLevelText;
    public Text cooldownText;

    // ---- Private değişkenler ----
    private int currentWantedLevel = 0;
    private int currentViolations = 0;
    private float cooldownTimer = 0f;
    private bool inCooldown = false;

    private List<AICarController> activePoliceCars = new List<AICarController>();
    private Transform playerTransform;

    // Wanted seviye renkleri
    private readonly Color[] starColors = { Color.yellow, Color.red, Color.red };

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        UpdateWantedUI();
        playerTransform = GameManager.Instance?.GetPlayerCar()?.transform;
    }

    void Update()
    {
        if (playerTransform == null)
        {
            playerTransform = GameManager.Instance?.GetPlayerCar()?.transform;
            return;
        }

        UpdateCooldown();
        ManagePolice();
    }

    // ========================
    // İhlal ekle (çarpışma, hız ihlali)
    // ========================
    public void AddViolation(int amount = 1)
    {
        if (currentWantedLevel >= maxWantedLevel) return;

        currentViolations += amount;
        inCooldown = false; // Cooldown'ı sıfırla
        cooldownTimer = 0f;

        if (currentViolations >= violationsPerLevel)
        {
            currentViolations = 0;
            IncreaseWantedLevel();
        }
    }

    // ========================
    // Wanted seviyesini artır
    // ========================
    void IncreaseWantedLevel()
    {
        if (currentWantedLevel >= maxWantedLevel) return;

        currentWantedLevel++;
        UpdateWantedUI();

        // Polis araçları spawn et
        SpawnPoliceForLevel(currentWantedLevel);

        // Ses efekti
        AudioManager.Instance?.PlaySFX("police_siren");

        Debug.Log($"[Police] Wanted Level: {currentWantedLevel}");
    }

    // ========================
    // Wanted seviyesini ayarla (dışarıdan)
    // ========================
    public void SetWantedLevel(int level)
    {
        currentWantedLevel = Mathf.Clamp(level, 0, maxWantedLevel);
        UpdateWantedUI();

        if (currentWantedLevel > 0)
        {
            SpawnPoliceForLevel(currentWantedLevel);
            AudioManager.Instance?.PlaySFX("police_siren");
        }
        else
        {
            DespawnAllPolice();
        }
    }

    // ========================
    // Wanted seviyesini sıfırla
    // ========================
    public void ClearWantedLevel()
    {
        currentWantedLevel = 0;
        currentViolations = 0;
        inCooldown = false;
        cooldownTimer = 0f;
        DespawnAllPolice();
        UpdateWantedUI();
        AudioManager.Instance?.StopSFX("police_siren");
        Debug.Log("[Police] Wanted Level sıfırlandı");
    }

    // ========================
    // Cooldown sistemi - Oyuncu kaçarsa
    // ========================
    void UpdateCooldown()
    {
        if (currentWantedLevel == 0) return;

        // Oyuncu tüm polislerden uzaksa cooldown başlat
        bool policeNearby = IsAnyPoliceCar();

        if (!policeNearby && !inCooldown)
        {
            inCooldown = true;
            cooldownTimer = 0f;
            Debug.Log("[Police] Cooldown başladı - polis yakın değil");
        }

        if (inCooldown)
        {
            cooldownTimer += Time.deltaTime;

            // Cooldown UI
            if (cooldownText != null)
            {
                float remaining = cooldownTime - cooldownTimer;
                cooldownText.text = remaining > 0 ? $"Kaçıyor: {remaining:F0}s" : "";
            }

            if (cooldownTimer >= cooldownTime)
            {
                // Wanted sıfırla
                int oldLevel = currentWantedLevel;
                currentWantedLevel = Mathf.Max(0, currentWantedLevel - 1);

                if (currentWantedLevel == 0)
                    ClearWantedLevel();
                else
                    UpdateWantedUI();

                inCooldown = false;
                cooldownTimer = 0f;

                Debug.Log($"[Police] Cooldown bitti, level {oldLevel} -> {currentWantedLevel}");
            }
        }
        else if (policeNearby)
        {
            cooldownTimer = 0f;
        }
    }

    // ========================
    // Polis araçlarını yönet
    // ========================
    void ManagePolice()
    {
        if (currentWantedLevel == 0) return;

        // Aktif polislerin listesini temizle (yok edilmiş olanları)
        activePoliceCars.RemoveAll(p => p == null);

        // Gereken polis sayısı
        int requiredPolice = GetRequiredPoliceCount();

        // Eksik polis varsa spawn et
        while (activePoliceCars.Count < requiredPolice)
        {
            SpawnPolice();
        }

        // Polislere takip emri ver
        foreach (var police in activePoliceCars)
        {
            if (police == null) continue;
            police.StartPoliceChase(playerTransform);
        }
    }

    int GetRequiredPoliceCount()
    {
        switch (currentWantedLevel)
        {
            case 1: return 1;
            case 2: return 2;
            case 3: return 3;
            default: return 0;
        }
    }

    // ========================
    // Polis seviyesine göre spawn et
    // ========================
    void SpawnPoliceForLevel(int level)
    {
        DespawnAllPolice();
        int count = GetRequiredPoliceCount();
        for (int i = 0; i < count; i++)
        {
            SpawnPolice();
        }
    }

    void SpawnPolice()
    {
        if (policePrefab == null || playerTransform == null) return;

        // Spawn pozisyonu: oyuncunun arkasında, belirli mesafede
        Vector3 spawnPos = GetPoliceSpawnPosition();
        if (spawnPos == Vector3.zero) return;

        GameObject policeObj = Instantiate(policePrefab, spawnPos, Quaternion.identity);
        AICarController policeAI = policeObj.GetComponent<AICarController>();

        if (policeAI != null)
        {
            policeAI.StartPoliceChase(playerTransform);
            activePoliceCars.Add(policeAI);
            Debug.Log($"[Police] Polis spawn edildi: {spawnPos}");
        }
    }

    Vector3 GetPoliceSpawnPosition()
    {
        // Önceden tanımlanmış spawn noktalarından birini seç
        if (policeSpawnPoints != null && policeSpawnPoints.Length > 0)
        {
            // Oyuncuya en yakın spawn noktasını seç ama belirli mesafede
            Transform bestSpawn = null;
            float bestDist = float.MaxValue;

            foreach (var spawn in policeSpawnPoints)
            {
                if (spawn == null) continue;
                float dist = Vector3.Distance(spawn.position, playerTransform.position);
                if (dist > 20f && dist < spawnDistance + 20f && dist < bestDist)
                {
                    bestDist = dist;
                    bestSpawn = spawn;
                }
            }

            if (bestSpawn != null) return bestSpawn.position;
        }

        // Spawn noktası yoksa oyuncunun arkasına spawn et
        Vector3 behindPlayer = playerTransform.position - playerTransform.forward * spawnDistance;
        behindPlayer += Random.insideUnitSphere * 10f;
        behindPlayer.y = playerTransform.position.y;
        return behindPlayer;
    }

    // ========================
    // Tüm polisleri yok et
    // ========================
    void DespawnAllPolice()
    {
        foreach (var police in activePoliceCars)
        {
            if (police != null)
                Destroy(police.gameObject);
        }
        activePoliceCars.Clear();
    }

    // ========================
    // Polis yakınlığını kontrol et
    // ========================
    bool IsAnyPoliceCar()
    {
        foreach (var police in activePoliceCars)
        {
            if (police == null) continue;
            float dist = Vector3.Distance(police.transform.position, playerTransform.position);
            if (dist < chaseDistance) return true;
        }
        return false;
    }

    // ========================
    // Wanted UI güncelle
    // ========================
    void UpdateWantedUI()
    {
        if (wantedPanel != null)
            wantedPanel.SetActive(currentWantedLevel > 0);

        for (int i = 0; i < wantedStars.Length; i++)
        {
            if (wantedStars[i] == null) continue;
            wantedStars[i].SetActive(i < currentWantedLevel);
        }

        if (wantedLevelText != null)
            wantedLevelText.text = currentWantedLevel > 0 ? $"ARANIYOR: {'★'.ToString().PadRight(currentWantedLevel, '★')}" : "";

        // 3. seviye = çok yoğun - renk kırmızı yap
        if (wantedLevelText != null)
            wantedLevelText.color = currentWantedLevel >= 3 ? Color.red : Color.yellow;
    }

    // ========================
    // Dışarıdan erişim
    // ========================
    public int GetWantedLevel() => currentWantedLevel;
    public bool IsWanted() => currentWantedLevel > 0;

    // Oyuncu çarpışma callback'i (PlayerCarController'dan çağrılır)
    public void OnPlayerCollision()
    {
        AddViolation(1);
    }

    // Oyuncu hız ihlali callback'i
    public void OnPlayerHighSpeed()
    {
        AddViolation(1);
    }
}
