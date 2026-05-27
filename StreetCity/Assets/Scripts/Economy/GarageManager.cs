using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

/// <summary>
/// Street City: Open World Mobile
/// GarageManager - Garaj ekranı ve araç yükseltme sistemi
/// Araç seçimi, renk değiştirme, hız/fren/nitro/tutuş geliştirme
/// </summary>
public class GarageManager : MonoBehaviour
{
    public static GarageManager Instance { get; private set; }

    [System.Serializable]
    public class GarageVehicle
    {
        public string name;
        public PlayerCarController prefab;
        public Sprite previewSprite;
        public int purchaseCost = 0;       // 0 = başlangıçta mevcut
        public bool isOwned = false;
        public Color vehicleColor = Color.red;
        public VehicleData upgradeData;
    }

    [Header("Araçlar")]
    public GarageVehicle[] vehicles;
    private int selectedVehicleIndex = 0;

    [Header("Renk Seçenekleri")]
    public Color[] availableColors = new Color[]
    {
        Color.red,
        Color.blue,
        new Color(1f, 0.85f, 0f),    // Sarı
        Color.black,
        new Color(0.1f, 0.7f, 0.1f), // Yeşil
        Color.white,
        new Color(1f, 0.5f, 0f),     // Turuncu
        Color.magenta                 // Pembe
    };
    private int selectedColorIndex = 0;

    [Header("Garaj UI")]
    public GameObject garagePanel;
    public Text vehicleNameText;
    public Image vehiclePreviewImage;
    public Text speedLevelText;
    public Text brakeLevelText;
    public Text nitroLevelText;
    public Text gripLevelText;
    public Button upgradeSpeedBtn;
    public Button upgradeBrakeBtn;
    public Button upgradeNitroBtn;
    public Button upgradeGripBtn;
    public Text upgradeSpeedCostText;
    public Text upgradeBrakeCostText;
    public Text upgradeNitroCostText;
    public Text upgradeGripCostText;
    public Button changeColorBtn;
    public Button prevVehicleBtn;
    public Button nextVehicleBtn;
    public Button selectVehicleBtn;
    public Button buyVehicleBtn;
    public Text buyVehicleCostText;
    public GameObject colorSelector;
    public Transform colorButtonContainer;
    public GameObject colorButtonPrefab;

    // Renk değişimi için araç renderer
    [Header("Araç Görsel")]
    public MeshRenderer vehiclePreviewRenderer;  // Garajdaki önizleme aracı

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        LoadGarageData();
        SetupButtons();
        SetupColorButtons();

        if (garagePanel != null)
            garagePanel.SetActive(false);
    }

    // ========================
    // Garajı aç/kapat
    // ========================
    public void OpenGarage()
    {
        if (garagePanel != null) garagePanel.SetActive(true);
        UpdateGarageUI();
        Time.timeScale = 0; // Oyunu durdur
    }

    public void CloseGarage()
    {
        if (garagePanel != null) garagePanel.SetActive(false);
        SaveGarageData();
        Time.timeScale = 1; // Oyunu devam ettir
    }

    // ========================
    // Buton kurulumu
    // ========================
    void SetupButtons()
    {
        if (prevVehicleBtn != null)
            prevVehicleBtn.onClick.AddListener(() => SelectVehicle(selectedVehicleIndex - 1));
        if (nextVehicleBtn != null)
            nextVehicleBtn.onClick.AddListener(() => SelectVehicle(selectedVehicleIndex + 1));
        if (selectVehicleBtn != null)
            selectVehicleBtn.onClick.AddListener(EquipSelectedVehicle);
        if (buyVehicleBtn != null)
            buyVehicleBtn.onClick.AddListener(BuySelectedVehicle);
        if (changeColorBtn != null)
            changeColorBtn.onClick.AddListener(ToggleColorSelector);

        if (upgradeSpeedBtn != null)
            upgradeSpeedBtn.onClick.AddListener(() => UpgradeVehicle("speed"));
        if (upgradeBrakeBtn != null)
            upgradeBrakeBtn.onClick.AddListener(() => UpgradeVehicle("brake"));
        if (upgradeNitroBtn != null)
            upgradeNitroBtn.onClick.AddListener(() => UpgradeVehicle("nitro"));
        if (upgradeGripBtn != null)
            upgradeGripBtn.onClick.AddListener(() => UpgradeVehicle("grip"));
    }

    // ========================
    // Renk butonlarını oluştur
    // ========================
    void SetupColorButtons()
    {
        if (colorButtonContainer == null || colorButtonPrefab == null) return;

        for (int i = 0; i < availableColors.Length; i++)
        {
            int index = i; // closure için
            GameObject btn = Instantiate(colorButtonPrefab, colorButtonContainer);
            Image img = btn.GetComponent<Image>();
            if (img != null) img.color = availableColors[i];

            Button button = btn.GetComponent<Button>();
            if (button != null)
                button.onClick.AddListener(() => SelectColor(index));
        }
    }

    // ========================
    // Araç seçimi
    // ========================
    void SelectVehicle(int index)
    {
        if (vehicles == null || vehicles.Length == 0) return;
        selectedVehicleIndex = Mathf.Clamp(index, 0, vehicles.Length - 1);
        UpdateGarageUI();
    }

    // ========================
    // Araç satın al
    // ========================
    void BuySelectedVehicle()
    {
        if (vehicles == null || selectedVehicleIndex >= vehicles.Length) return;
        GarageVehicle v = vehicles[selectedVehicleIndex];

        if (v.isOwned)
        {
            EquipSelectedVehicle();
            return;
        }

        if (MoneySystem.Instance?.SpendMoney(v.purchaseCost) ?? false)
        {
            v.isOwned = true;
            SaveGarageData();
            UpdateGarageUI();
            AudioManager.Instance?.PlaySFX("purchase");
            Debug.Log($"[Garage] Araç satın alındı: {v.name}");
        }
    }

    // ========================
    // Seçili aracı kullan
    // ========================
    void EquipSelectedVehicle()
    {
        if (vehicles == null || selectedVehicleIndex >= vehicles.Length) return;
        GarageVehicle v = vehicles[selectedVehicleIndex];

        if (!v.isOwned)
        {
            Debug.Log("[Garage] Araç satın alınmamış!");
            return;
        }

        GameManager.Instance?.SpawnPlayerVehicle(v.prefab, v.vehicleColor, v.upgradeData);
        CloseGarage();
        Debug.Log($"[Garage] Araç seçildi: {v.name}");
    }

    // ========================
    // Renk seç
    // ========================
    void SelectColor(int index)
    {
        if (index >= availableColors.Length) return;
        selectedColorIndex = index;

        // Para harca
        if (MoneySystem.Instance?.SpendMoney(MoneySystem.GetColorChangeCost()) ?? false)
        {
            vehicles[selectedVehicleIndex].vehicleColor = availableColors[index];

            // Önizleme araç rengini güncelle
            if (vehiclePreviewRenderer != null)
            {
                Material mat = vehiclePreviewRenderer.material;
                if (mat != null) mat.color = availableColors[index];
            }

            SaveGarageData();
            AudioManager.Instance?.PlaySFX("color_change");
            Debug.Log($"[Garage] Renk değiştirildi: {availableColors[index]}");
        }

        if (colorSelector != null) colorSelector.SetActive(false);
    }

    void ToggleColorSelector()
    {
        if (colorSelector != null)
            colorSelector.SetActive(!colorSelector.activeSelf);
    }

    // ========================
    // Araç yükseltme
    // ========================
    void UpgradeVehicle(string type)
    {
        if (vehicles == null || selectedVehicleIndex >= vehicles.Length) return;
        GarageVehicle v = vehicles[selectedVehicleIndex];

        if (v.upgradeData == null) v.upgradeData = new VehicleData();

        int currentLevel = 0;
        switch (type)
        {
            case "speed": currentLevel = v.upgradeData.speedLevel; break;
            case "brake": currentLevel = v.upgradeData.brakeLevel; break;
            case "nitro": currentLevel = v.upgradeData.nitroLevel; break;
            case "grip": currentLevel = v.upgradeData.gripLevel; break;
        }

        if (currentLevel >= 3)
        {
            Debug.Log("[Garage] Maksimum seviye!");
            return;
        }

        int cost = MoneySystem.GetUpgradeCost(currentLevel);
        if (!MoneySystem.Instance?.SpendMoney(cost) ?? true) return;

        switch (type)
        {
            case "speed": v.upgradeData.speedLevel++; break;
            case "brake": v.upgradeData.brakeLevel++; break;
            case "nitro": v.upgradeData.nitroLevel++; break;
            case "grip": v.upgradeData.gripLevel++; break;
        }

        SaveGarageData();
        UpdateGarageUI();
        AudioManager.Instance?.PlaySFX("upgrade");
        Debug.Log($"[Garage] {type} yükseltildi: {currentLevel} -> {currentLevel + 1}");
    }

    // ========================
    // Garaj UI güncelle
    // ========================
    void UpdateGarageUI()
    {
        if (vehicles == null || vehicles.Length == 0) return;
        GarageVehicle v = vehicles[selectedVehicleIndex];

        if (vehicleNameText != null) vehicleNameText.text = v.name;
        if (vehiclePreviewImage != null && v.previewSprite != null)
            vehiclePreviewImage.sprite = v.previewSprite;

        VehicleData data = v.upgradeData ?? new VehicleData();

        // Yükseltme seviyeleri
        UpdateUpgradeUI(speedLevelText, upgradeSpeedBtn, upgradeSpeedCostText, data.speedLevel, "HIZ");
        UpdateUpgradeUI(brakeLevelText, upgradeBrakeBtn, upgradeBrakeCostText, data.brakeLevel, "FREN");
        UpdateUpgradeUI(nitroLevelText, upgradeNitroBtn, upgradeNitroCostText, data.nitroLevel, "NİTRO");
        UpdateUpgradeUI(gripLevelText, upgradeGripBtn, upgradeGripCostText, data.gripLevel, "TUTUŞ");

        // Satın al / Seç butonu
        if (buyVehicleBtn != null) buyVehicleBtn.gameObject.SetActive(!v.isOwned);
        if (selectVehicleBtn != null) selectVehicleBtn.gameObject.SetActive(v.isOwned);
        if (buyVehicleCostText != null) buyVehicleCostText.text = $"{v.purchaseCost} $";

        // Renk önizleme
        if (vehiclePreviewRenderer != null)
        {
            Material mat = vehiclePreviewRenderer.material;
            if (mat != null) mat.color = v.vehicleColor;
        }
    }

    void UpdateUpgradeUI(Text levelText, Button btn, Text costText, int level, string label)
    {
        bool maxed = level >= 3;
        if (levelText != null)
        {
            string stars = new string('★', level) + new string('☆', 3 - level);
            levelText.text = $"{label}: {stars}";
        }
        if (btn != null) btn.interactable = !maxed && (MoneySystem.Instance?.HasEnoughMoney(MoneySystem.GetUpgradeCost(level)) ?? false);
        if (costText != null) costText.text = maxed ? "MAX" : $"{MoneySystem.GetUpgradeCost(level)} $";
    }

    // ========================
    // Kaydet / Yükle
    // ========================
    void SaveGarageData()
    {
        SaveLoadSystem.Instance?.SaveGarageData(vehicles);
    }

    void LoadGarageData()
    {
        SaveLoadSystem.Instance?.LoadGarageData(vehicles);

        // İlk araç varsayılan olarak sahip
        if (vehicles != null && vehicles.Length > 0)
            vehicles[0].isOwned = true;
    }
}
