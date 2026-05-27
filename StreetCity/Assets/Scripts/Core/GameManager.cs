using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;

/// <summary>
/// Street City: Open World Mobile
/// GameManager - Ana oyun yöneticisi
/// Oyun durumu, skor sistemi ve sahne yönetimi
/// </summary>
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    // ---- Oyun Durumu Enum ----
    public enum GameState
    {
        MainMenu,
        Playing,
        Paused,
        Garage,
        GameOver
    }

    [Header("Araç Prefab'ları")]
    public GameObject[] vehiclePrefabs;      // 5 araç prefab
    public Transform playerSpawnPoint;       // Oyuncu başlangıç noktası

    [Header("Oyuncu Referansı")]
    private PlayerCarController playerCar;
    private GameObject playerCharacter;

    [Header("Oyun Durumu")]
    private GameState currentState = GameState.MainMenu;
    private int totalScore = 0;

    // Spawn edilmiş araç
    private GameObject spawnedCar;

    public GameState CurrentState => currentState;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    void Start()
    {
        // Kayıtlı skorу yükle
        totalScore = SaveLoadSystem.Instance?.GetScore() ?? 0;

        // Başlangıç durumu
        SetGameState(GameState.MainMenu);
    }

    // ========================
    // Oyun durumu yönetimi
    // ========================
    public void SetGameState(GameState newState)
    {
        currentState = newState;

        switch (newState)
        {
            case GameState.MainMenu:
                Time.timeScale = 1f;
                AudioManager.Instance?.PlayMenuMusic();
                break;

            case GameState.Playing:
                Time.timeScale = 1f;
                AudioManager.Instance?.PlayGameMusic();
                break;

            case GameState.Paused:
                Time.timeScale = 0f;
                break;

            case GameState.Garage:
                Time.timeScale = 0f;
                break;

            case GameState.GameOver:
                Time.timeScale = 0f;
                break;
        }

        UIManager.Instance?.OnGameStateChanged(newState);
        Debug.Log($"[GameManager] State: {newState}");
    }

    // ========================
    // Oyunu başlat
    // ========================
    public void StartGame()
    {
        SetGameState(GameState.Playing);
        SpawnDefaultVehicle();
        UIManager.Instance?.ShowHUD(true);
    }

    // ========================
    // Varsayılan araç spawn et
    // ========================
    void SpawnDefaultVehicle()
    {
        if (vehiclePrefabs == null || vehiclePrefabs.Length == 0)
        {
            Debug.LogError("[GameManager] Araç prefabı atanmamış!");
            return;
        }

        SpawnPlayerVehicle(vehiclePrefabs[0].GetComponent<PlayerCarController>(),
                          Color.red, null);
    }

    // ========================
    // Belirli araç spawn et (Garajdan)
    // ========================
    public void SpawnPlayerVehicle(PlayerCarController vehiclePrefab, Color vehicleColor,
                                    VehicleData upgradeData)
    {
        // Eski aracı temizle
        if (spawnedCar != null)
        {
            Destroy(spawnedCar);
        }

        // Yeni araç oluştur
        Vector3 spawnPos = playerSpawnPoint != null
            ? playerSpawnPoint.position
            : Vector3.zero + Vector3.up;

        if (vehiclePrefab == null)
        {
            Debug.LogError("[GameManager] Araç prefabı null!");
            return;
        }

        spawnedCar = Instantiate(vehiclePrefab.gameObject, spawnPos, Quaternion.identity);
        playerCar = spawnedCar.GetComponent<PlayerCarController>();

        // Renk uygula
        ApplyVehicleColor(spawnedCar, vehicleColor);

        // Yükseltme verisi yükle
        if (upgradeData != null && playerCar != null)
            playerCar.LoadVehicleData(upgradeData);

        // Polis sistemini bağla
        if (playerCar != null)
        {
            playerCar.OnCollision += () => PoliceChaseSystem.Instance?.OnPlayerCollision();
            playerCar.OnHighSpeed += () => PoliceChaseSystem.Instance?.OnPlayerHighSpeed();
        }

        // Input controller'ı araçla bağla
        MobileInputController.Instance?.SetTargetCar(playerCar);
        VehicleEnterExitSystem.Instance?.ForceEnterVehicle(playerCar);

        Debug.Log($"[GameManager] Araç spawn edildi: {vehiclePrefab.vehicleName}");
    }

    void ApplyVehicleColor(GameObject car, Color color)
    {
        MeshRenderer[] renderers = car.GetComponentsInChildren<MeshRenderer>();
        foreach (var r in renderers)
        {
            if (r.gameObject.name.Contains("Body") || r.gameObject.name.Contains("body"))
            {
                if (r.material != null)
                {
                    Material mat = new Material(r.material);
                    mat.color = color;
                    r.material = mat;
                }
            }
        }
    }

    // ========================
    // Oyun duraklat / devam
    // ========================
    public void PauseGame()
    {
        if (currentState == GameState.Playing)
            SetGameState(GameState.Paused);
    }

    public void ResumeGame()
    {
        if (currentState == GameState.Paused)
            SetGameState(GameState.Playing);
    }

    // ========================
    // Sahne yükleme
    // ========================
    public void LoadMainMenu()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene("MainMenu");
    }

    public void LoadGameScene()
    {
        SceneManager.LoadScene("GameScene");
    }

    public void RestartGame()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene(SceneManager.GetActiveScene().name);
    }

    public void QuitGame()
    {
        SaveLoadSystem.Instance?.SaveAll();
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        Application.Quit();
#endif
    }

    // ========================
    // Skor sistemi
    // ========================
    public void AddScore(int amount)
    {
        totalScore += amount;
        UIManager.Instance?.UpdateScore(totalScore);
        SaveLoadSystem.Instance?.SaveScore(totalScore);
    }

    public int GetTotalScore() => totalScore;

    // ========================
    // Araç olayları
    // ========================
    public void OnPlayerEnteredVehicle(PlayerCarController car)
    {
        playerCar = car;
        Debug.Log("[GameManager] Oyuncu araca bindi");
    }

    public void OnPlayerExitedVehicle()
    {
        Debug.Log("[GameManager] Oyuncu araçtan indi");
    }

    // ========================
    // Getter'lar
    // ========================
    public PlayerCarController GetPlayerCar() => playerCar;
    public GameObject GetPlayerCharacter() => playerCharacter;

    // ========================
    // Uygulama arka plana gittiğinde kaydet
    // ========================
    void OnApplicationPause(bool paused)
    {
        if (paused)
        {
            SaveLoadSystem.Instance?.SaveAll();
            Debug.Log("[GameManager] Uygulama duraklatıldı - kaydedildi");
        }
    }

    void OnApplicationQuit()
    {
        SaveLoadSystem.Instance?.SaveAll();
    }
}
