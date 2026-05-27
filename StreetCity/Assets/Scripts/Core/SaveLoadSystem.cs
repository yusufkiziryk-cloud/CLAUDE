using UnityEngine;
using System.IO;
using System.Runtime.Serialization.Formatters.Binary;

/// <summary>
/// Street City: Open World Mobile
/// SaveLoadSystem - Kayıt ve yükleme sistemi
/// PlayerPrefs + JSON ile mobil uyumlu veri saklama
/// </summary>
public class SaveLoadSystem : MonoBehaviour
{
    public static SaveLoadSystem Instance { get; private set; }

    // ---- Save Data Yapısı ----
    [System.Serializable]
    public class GameSaveData
    {
        public int money = 1000;
        public int score = 0;
        public int[] vehicleSpeedLevels;
        public int[] vehicleBrakeLevels;
        public int[] vehicleNitroLevels;
        public int[] vehicleGripLevels;
        public bool[] vehiclesOwned;
        public string[] vehicleColors;
        public int lastSelectedVehicle = 0;
        public float masterVolume = 1f;
        public bool sfxEnabled = true;
        public bool musicEnabled = true;
        public int graphicsQuality = 1; // 0=Düşük, 1=Orta, 2=Yüksek
        public float controlSensitivity = 1f;
        public string language = "tr";
    }

    private GameSaveData saveData;
    private const string SAVE_KEY = "StreetCityData";
    private const string SAVE_FILE = "streetcity_save.json";

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
            return;
        }

        LoadAll();
    }

    // ========================
    // Tüm veriyi kaydet
    // ========================
    public void SaveAll()
    {
        if (saveData == null) saveData = new GameSaveData();

        string json = JsonUtility.ToJson(saveData, true);
        PlayerPrefs.SetString(SAVE_KEY, json);
        PlayerPrefs.Save();

        // Ayrıca dosyaya da kaydet (daha güvenli)
        string path = Path.Combine(Application.persistentDataPath, SAVE_FILE);
        File.WriteAllText(path, json);

        Debug.Log($"[SaveLoad] Kaydedildi: {path}");
    }

    // ========================
    // Tüm veriyi yükle
    // ========================
    public void LoadAll()
    {
        saveData = null;

        // Önce dosyadan yüklemeyi dene
        string path = Path.Combine(Application.persistentDataPath, SAVE_FILE);
        if (File.Exists(path))
        {
            try
            {
                string json = File.ReadAllText(path);
                saveData = JsonUtility.FromJson<GameSaveData>(json);
                Debug.Log("[SaveLoad] Dosyadan yüklendi");
            }
            catch
            {
                Debug.LogWarning("[SaveLoad] Dosya okuma hatası, PlayerPrefs'ten yükleniyor");
            }
        }

        // Dosya yoksa PlayerPrefs'ten yükle
        if (saveData == null && PlayerPrefs.HasKey(SAVE_KEY))
        {
            try
            {
                string json = PlayerPrefs.GetString(SAVE_KEY);
                saveData = JsonUtility.FromJson<GameSaveData>(json);
                Debug.Log("[SaveLoad] PlayerPrefs'ten yüklendi");
            }
            catch
            {
                Debug.LogWarning("[SaveLoad] PlayerPrefs okuma hatası");
            }
        }

        // Kayıt yoksa yeni oluştur
        if (saveData == null)
        {
            saveData = new GameSaveData();
            Debug.Log("[SaveLoad] Yeni kayıt oluşturuldu");
        }
    }

    // ========================
    // Para
    // ========================
    public void SaveMoney(int amount)
    {
        EnsureSaveData();
        saveData.money = amount;
        QuickSave();
    }

    public int GetMoney() => saveData?.money ?? 1000;

    // ========================
    // Skor
    // ========================
    public void SaveScore(int score)
    {
        EnsureSaveData();
        saveData.score = score;
        QuickSave();
    }

    public int GetScore() => saveData?.score ?? 0;

    // ========================
    // Garaj verisi
    // ========================
    public void SaveGarageData(GarageManager.GarageVehicle[] vehicles)
    {
        EnsureSaveData();
        if (vehicles == null) return;

        int count = vehicles.Length;
        saveData.vehiclesOwned = new bool[count];
        saveData.vehicleSpeedLevels = new int[count];
        saveData.vehicleBrakeLevels = new int[count];
        saveData.vehicleNitroLevels = new int[count];
        saveData.vehicleGripLevels = new int[count];
        saveData.vehicleColors = new string[count];

        for (int i = 0; i < count; i++)
        {
            saveData.vehiclesOwned[i] = vehicles[i].isOwned;
            saveData.vehicleColors[i] = ColorUtility.ToHtmlStringRGBA(vehicles[i].vehicleColor);

            if (vehicles[i].upgradeData != null)
            {
                saveData.vehicleSpeedLevels[i] = vehicles[i].upgradeData.speedLevel;
                saveData.vehicleBrakeLevels[i] = vehicles[i].upgradeData.brakeLevel;
                saveData.vehicleNitroLevels[i] = vehicles[i].upgradeData.nitroLevel;
                saveData.vehicleGripLevels[i] = vehicles[i].upgradeData.gripLevel;
            }
        }

        SaveAll();
    }

    public void LoadGarageData(GarageManager.GarageVehicle[] vehicles)
    {
        if (saveData == null || vehicles == null) return;

        for (int i = 0; i < vehicles.Length; i++)
        {
            if (saveData.vehiclesOwned != null && i < saveData.vehiclesOwned.Length)
                vehicles[i].isOwned = saveData.vehiclesOwned[i];

            if (vehicles[i].upgradeData == null)
                vehicles[i].upgradeData = new VehicleData();

            if (saveData.vehicleSpeedLevels != null && i < saveData.vehicleSpeedLevels.Length)
                vehicles[i].upgradeData.speedLevel = saveData.vehicleSpeedLevels[i];
            if (saveData.vehicleBrakeLevels != null && i < saveData.vehicleBrakeLevels.Length)
                vehicles[i].upgradeData.brakeLevel = saveData.vehicleBrakeLevels[i];
            if (saveData.vehicleNitroLevels != null && i < saveData.vehicleNitroLevels.Length)
                vehicles[i].upgradeData.nitroLevel = saveData.vehicleNitroLevels[i];
            if (saveData.vehicleGripLevels != null && i < saveData.vehicleGripLevels.Length)
                vehicles[i].upgradeData.gripLevel = saveData.vehicleGripLevels[i];

            // Renk
            if (saveData.vehicleColors != null && i < saveData.vehicleColors.Length)
            {
                Color color;
                if (ColorUtility.TryParseHtmlString("#" + saveData.vehicleColors[i], out color))
                    vehicles[i].vehicleColor = color;
            }
        }
    }

    // ========================
    // Ayarlar
    // ========================
    public void SaveSettings(float masterVolume, bool sfxEnabled, bool musicEnabled,
                             int graphicsQuality, float controlSensitivity)
    {
        EnsureSaveData();
        saveData.masterVolume = masterVolume;
        saveData.sfxEnabled = sfxEnabled;
        saveData.musicEnabled = musicEnabled;
        saveData.graphicsQuality = graphicsQuality;
        saveData.controlSensitivity = controlSensitivity;
        SaveAll();
    }

    public float GetMasterVolume() => saveData?.masterVolume ?? 1f;
    public bool GetSFXEnabled() => saveData?.sfxEnabled ?? true;
    public bool GetMusicEnabled() => saveData?.musicEnabled ?? true;
    public int GetGraphicsQuality() => saveData?.graphicsQuality ?? 1;
    public float GetControlSensitivity() => saveData?.controlSensitivity ?? 1f;

    // ========================
    // Kayıt sil
    // ========================
    public void DeleteSave()
    {
        saveData = new GameSaveData();
        PlayerPrefs.DeleteKey(SAVE_KEY);
        PlayerPrefs.Save();

        string path = Path.Combine(Application.persistentDataPath, SAVE_FILE);
        if (File.Exists(path)) File.Delete(path);

        Debug.Log("[SaveLoad] Kayıt silindi");
    }

    // ========================
    // Yardımcı fonksiyonlar
    // ========================
    void EnsureSaveData()
    {
        if (saveData == null) saveData = new GameSaveData();
    }

    void QuickSave()
    {
        if (saveData == null) return;
        string json = JsonUtility.ToJson(saveData);
        PlayerPrefs.SetString(SAVE_KEY, json);
        PlayerPrefs.Save();
    }

    public bool HasSaveData()
    {
        return PlayerPrefs.HasKey(SAVE_KEY) ||
               File.Exists(Path.Combine(Application.persistentDataPath, SAVE_FILE));
    }
}
