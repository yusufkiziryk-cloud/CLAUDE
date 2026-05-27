using UnityEngine;
using UnityEngine.UI;
using System.Collections;

/// <summary>
/// Street City: Open World Mobile
/// UIManager - Kullanıcı arayüzü yönetim sistemi
/// HUD, Ana Menü, Ayarlar, Duraklama ve Garaj UI yönetimi
/// </summary>
public class UIManager : MonoBehaviour
{
    public static UIManager Instance { get; private set; }

    // ========================
    // Ana Menü
    // ========================
    [Header("Ana Menü")]
    public GameObject mainMenuPanel;
    public Button playButton;
    public Button garageMenuButton;
    public Button settingsMenuButton;
    public Button quitButton;
    public Text gameVersionText;
    public Animator mainMenuAnimator;

    // ========================
    // HUD (Oyun içi arayüz)
    // ========================
    [Header("HUD")]
    public GameObject hudPanel;
    public Text speedText;           // Hız göstergesi
    public Text moneyText;           // Para göstergesi
    public Text scoreText;           // Skor göstergesi
    public Slider nitroSlider;       // Nitro doluluk çubuğu
    public Image nitroFillImage;     // Nitro dolum rengi
    public Text nitroStatusText;     // "HAZIR" / "ŞARJ"
    public GameObject wantedPanel;   // Polis wanted panel

    // ========================
    // Duraklama Menüsü
    // ========================
    [Header("Duraklama Menüsü")]
    public GameObject pauseMenuPanel;
    public Button resumeButton;
    public Button garageButton;
    public Button settingsPauseButton;
    public Button mainMenuButton;
    public Button restartButton;

    // ========================
    // Ayarlar Menüsü
    // ========================
    [Header("Ayarlar")]
    public GameObject settingsPanel;
    public Slider volumeSlider;
    public Toggle sfxToggle;
    public Toggle musicToggle;
    public Dropdown graphicsDropdown;
    public Slider sensitivitySlider;
    public Button settingsCloseButton;

    // ========================
    // Harita
    // ========================
    [Header("Harita")]
    public GameObject miniMapContainer;
    public Button mapToggleButton;

    // ========================
    // HUD Butonları
    // ========================
    [Header("HUD Butonları")]
    public Button pauseButton;

    // ========================
    // Loading Screen
    // ========================
    [Header("Loading")]
    public GameObject loadingPanel;
    public Slider loadingBar;
    public Text loadingText;

    // ========================
    // Notifications
    // ========================
    [Header("Bildirimler")]
    public GameObject notificationPrefab;
    public Transform notificationContainer;

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        SetupButtons();
        LoadSettings();
        ShowMainMenu();

        if (gameVersionText != null)
            gameVersionText.text = "v1.0.0";
    }

    void Update()
    {
        UpdateHUD();

        // Android geri tuşu - duraklat
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            if (settingsPanel != null && settingsPanel.activeSelf)
                CloseSettings();
            else if (pauseMenuPanel != null && pauseMenuPanel.activeSelf)
                ResumeGame();
            else if (GameManager.Instance?.CurrentState == GameManager.GameState.Playing)
                PauseGame();
        }
    }

    // ========================
    // Buton kurulumu
    // ========================
    void SetupButtons()
    {
        // Ana menü
        if (playButton != null) playButton.onClick.AddListener(StartGame);
        if (garageMenuButton != null) garageMenuButton.onClick.AddListener(OpenGarage);
        if (settingsMenuButton != null) settingsMenuButton.onClick.AddListener(OpenSettings);
        if (quitButton != null) quitButton.onClick.AddListener(QuitGame);

        // Duraklama
        if (resumeButton != null) resumeButton.onClick.AddListener(ResumeGame);
        if (garageButton != null) garageButton.onClick.AddListener(OpenGarage);
        if (settingsPauseButton != null) settingsPauseButton.onClick.AddListener(OpenSettings);
        if (mainMenuButton != null) mainMenuButton.onClick.AddListener(GoToMainMenu);
        if (restartButton != null) restartButton.onClick.AddListener(RestartGame);

        // HUD
        if (pauseButton != null) pauseButton.onClick.AddListener(PauseGame);
        if (mapToggleButton != null) mapToggleButton.onClick.AddListener(ToggleMap);

        // Ayarlar
        if (settingsCloseButton != null) settingsCloseButton.onClick.AddListener(CloseSettings);
        if (volumeSlider != null) volumeSlider.onValueChanged.AddListener(OnVolumeChanged);
        if (sfxToggle != null) sfxToggle.onValueChanged.AddListener(OnSFXToggle);
        if (musicToggle != null) musicToggle.onValueChanged.AddListener(OnMusicToggle);
        if (graphicsDropdown != null) graphicsDropdown.onValueChanged.AddListener(OnGraphicsChanged);
        if (sensitivitySlider != null) sensitivitySlider.onValueChanged.AddListener(OnSensitivityChanged);
    }

    // ========================
    // HUD güncelleme
    // ========================
    void UpdateHUD()
    {
        var playerCar = GameManager.Instance?.GetPlayerCar();
        if (playerCar == null) return;

        // Hız
        if (speedText != null)
            speedText.text = $"{(int)playerCar.SpeedKMH}\nkm/h";

        // Nitro
        if (nitroSlider != null)
        {
            if (playerCar.IsNitroActive)
            {
                nitroSlider.value = 1f;
                if (nitroFillImage != null) nitroFillImage.color = Color.cyan;
                if (nitroStatusText != null) nitroStatusText.text = "NİTRO!";
            }
            else
            {
                nitroSlider.value = playerCar.NitroCooldownRatio;
                if (nitroFillImage != null)
                    nitroFillImage.color = playerCar.NitroCooldownRatio >= 1f ? Color.yellow : Color.gray;
                if (nitroStatusText != null)
                    nitroStatusText.text = playerCar.NitroCooldownRatio >= 1f ? "HAZIR" : "ŞARJ...";
            }
        }
    }

    // ========================
    // Skor güncelle
    // ========================
    public void UpdateScore(int score)
    {
        if (scoreText != null) scoreText.text = $"PUAN: {score:N0}";
    }

    public void UpdateMoney(int money)
    {
        if (moneyText != null) moneyText.text = $"${money:N0}";
    }

    // ========================
    // Panelleri göster/gizle
    // ========================
    public void ShowMainMenu()
    {
        HideAll();
        if (mainMenuPanel != null) mainMenuPanel.SetActive(true);
    }

    public void ShowHUD(bool show)
    {
        if (hudPanel != null) hudPanel.SetActive(show);
    }

    void HideAll()
    {
        if (mainMenuPanel != null) mainMenuPanel.SetActive(false);
        if (pauseMenuPanel != null) pauseMenuPanel.SetActive(false);
        if (settingsPanel != null) settingsPanel.SetActive(false);
        if (hudPanel != null) hudPanel.SetActive(false);
    }

    // ========================
    // Ana Menü aksiyonları
    // ========================
    void StartGame()
    {
        HideAll();
        ShowHUD(true);
        GameManager.Instance?.StartGame();
        AudioManager.Instance?.PlaySFX("button_click");
    }

    void OpenGarage()
    {
        if (pauseMenuPanel != null) pauseMenuPanel.SetActive(false);
        GarageManager.Instance?.OpenGarage();
        AudioManager.Instance?.PlaySFX("button_click");
    }

    void OpenSettings()
    {
        if (settingsPanel != null) settingsPanel.SetActive(true);
        AudioManager.Instance?.PlaySFX("button_click");
    }

    void CloseSettings()
    {
        if (settingsPanel != null) settingsPanel.SetActive(false);
        SaveSettings();
    }

    void QuitGame()
    {
        AudioManager.Instance?.PlaySFX("button_click");
        GameManager.Instance?.QuitGame();
    }

    // ========================
    // Duraklama aksiyonları
    // ========================
    void PauseGame()
    {
        if (pauseMenuPanel != null) pauseMenuPanel.SetActive(true);
        GameManager.Instance?.PauseGame();
    }

    void ResumeGame()
    {
        if (pauseMenuPanel != null) pauseMenuPanel.SetActive(false);
        GameManager.Instance?.ResumeGame();
        AudioManager.Instance?.PlaySFX("button_click");
    }

    void GoToMainMenu()
    {
        AudioManager.Instance?.PlaySFX("button_click");
        ShowMainMenu();
        GameManager.Instance?.LoadMainMenu();
    }

    void RestartGame()
    {
        AudioManager.Instance?.PlaySFX("button_click");
        GameManager.Instance?.RestartGame();
    }

    // ========================
    // Harita
    // ========================
    public void ToggleMap()
    {
        MiniMapController.Instance?.ToggleFullMap();
    }

    // ========================
    // Ayarlar
    // ========================
    void LoadSettings()
    {
        var save = SaveLoadSystem.Instance;
        if (save == null) return;

        if (volumeSlider != null) volumeSlider.value = save.GetMasterVolume();
        if (sfxToggle != null) sfxToggle.isOn = save.GetSFXEnabled();
        if (musicToggle != null) musicToggle.isOn = save.GetMusicEnabled();
        if (graphicsDropdown != null) graphicsDropdown.value = save.GetGraphicsQuality();
        if (sensitivitySlider != null) sensitivitySlider.value = save.GetControlSensitivity();

        ApplyGraphicsSettings(save.GetGraphicsQuality());
    }

    void SaveSettings()
    {
        SaveLoadSystem.Instance?.SaveSettings(
            volumeSlider?.value ?? 1f,
            sfxToggle?.isOn ?? true,
            musicToggle?.isOn ?? true,
            graphicsDropdown?.value ?? 1,
            sensitivitySlider?.value ?? 1f
        );
    }

    void OnVolumeChanged(float value)
    {
        AudioManager.Instance?.SetMasterVolume(value);
    }

    void OnSFXToggle(bool enabled)
    {
        AudioManager.Instance?.SetSFXEnabled(enabled);
    }

    void OnMusicToggle(bool enabled)
    {
        AudioManager.Instance?.SetMusicEnabled(enabled);
    }

    void OnGraphicsChanged(int quality)
    {
        ApplyGraphicsSettings(quality);
    }

    void OnSensitivityChanged(float value)
    {
        if (MobileInputController.Instance != null)
            MobileInputController.Instance.cameraSensitivity = value * 3f;
    }

    void ApplyGraphicsSettings(int quality)
    {
        switch (quality)
        {
            case 0: // Düşük
                QualitySettings.SetQualityLevel(0, true);
                Application.targetFrameRate = 30;
                break;
            case 1: // Orta
                QualitySettings.SetQualityLevel(2, true);
                Application.targetFrameRate = 45;
                break;
            case 2: // Yüksek
                QualitySettings.SetQualityLevel(5, true);
                Application.targetFrameRate = 60;
                break;
        }
    }

    // ========================
    // Bildirim göster
    // ========================
    public void ShowNotification(string message, Color color = default)
    {
        if (notificationPrefab == null || notificationContainer == null) return;
        if (color == default) color = Color.white;

        GameObject notification = Instantiate(notificationPrefab, notificationContainer);
        Text notifText = notification.GetComponentInChildren<Text>();
        if (notifText != null)
        {
            notifText.text = message;
            notifText.color = color;
        }

        Destroy(notification, 3f);
    }

    // ========================
    // GameState değişince çağrılır
    // ========================
    public void OnGameStateChanged(GameManager.GameState state)
    {
        switch (state)
        {
            case GameManager.GameState.MainMenu:
                ShowMainMenu();
                break;
            case GameManager.GameState.Playing:
                if (mainMenuPanel != null) mainMenuPanel.SetActive(false);
                if (pauseMenuPanel != null) pauseMenuPanel.SetActive(false);
                ShowHUD(true);
                break;
            case GameManager.GameState.Paused:
                // Pause paneli PauseGame() içinde açılıyor
                break;
        }
    }
}
