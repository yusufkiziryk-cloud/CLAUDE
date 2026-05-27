using UnityEngine;

/// <summary>
/// Street City: Open World Mobile
/// CityBuilder - Şehir yapıları ve dünya kurulumu için yardımcı script
/// Low-poly şehir elementlerini procedural olarak yerleştir
/// </summary>
public class CityBuilder : MonoBehaviour
{
    [Header("Şehir Elementleri")]
    public GameObject[] buildingPrefabs;      // Bina prefabları (low-poly)
    public GameObject[] treePrefabs;          // Ağaç prefabları
    public GameObject streetLampPrefab;       // Sokak lambası
    public GameObject trafficLightPrefab;     // Trafik ışığı
    public GameObject benchPrefab;            // Bank
    public GameObject trashCanPrefab;         // Çöp kutusu

    [Header("Yol Elementleri")]
    public Material roadMaterial;             // Yol materyali (gri/siyah)
    public Material sidewalkMaterial;         // Kaldırım materyali
    public Material grassMaterial;            // Çimen materyali

    [Header("Harita Sınırları")]
    public float mapWidth = 200f;
    public float mapHeight = 200f;

    [Header("Otomatik Kurulum")]
    public bool autoBuildOnStart = false;

    void Start()
    {
        if (autoBuildOnStart)
            BuildCity();
    }

    // ========================
    // Şehri otomatik kur
    // ========================
    [ContextMenu("Build City")]
    public void BuildCity()
    {
        PlaceBuildings();
        PlaceTrees();
        PlaceStreetLamps();
        Debug.Log("[CityBuilder] Şehir kurulumu tamamlandı");
    }

    // ========================
    // Bina yerleştirme
    // ========================
    void PlaceBuildings()
    {
        if (buildingPrefabs == null || buildingPrefabs.Length == 0) return;

        // Şehir bloklarına bina yerleştir
        // Bu fonksiyon Unity Editor'da çalıştırılır
        int buildingCount = 30;
        float spacing = 15f;

        for (int i = 0; i < buildingCount; i++)
        {
            // Grid bazlı yerleştirme (yol bölgelerini atla)
            float x = Random.Range(-mapWidth * 0.4f, mapWidth * 0.4f);
            float z = Random.Range(-mapHeight * 0.4f, mapHeight * 0.4f);

            // Yol bölgelerini atla (basit kontrol)
            if (IsOnRoad(new Vector3(x, 0, z))) continue;

            GameObject prefab = buildingPrefabs[Random.Range(0, buildingPrefabs.Length)];
            GameObject building = Instantiate(prefab, new Vector3(x, 0, z),
                Quaternion.Euler(0, Random.Range(0, 4) * 90f, 0), transform);
            building.name = $"Building_{i}";
        }
    }

    // ========================
    // Ağaç yerleştirme
    // ========================
    void PlaceTrees()
    {
        if (treePrefabs == null || treePrefabs.Length == 0) return;

        int treeCount = 50;
        for (int i = 0; i < treeCount; i++)
        {
            float x = Random.Range(-mapWidth * 0.45f, mapWidth * 0.45f);
            float z = Random.Range(-mapHeight * 0.45f, mapHeight * 0.45f);

            if (IsOnRoad(new Vector3(x, 0, z))) continue;
            if (IsNearBuilding(new Vector3(x, 0, z))) continue;

            GameObject prefab = treePrefabs[Random.Range(0, treePrefabs.Length)];
            Instantiate(prefab, new Vector3(x, 0, z),
                Quaternion.Euler(0, Random.Range(0f, 360f), 0), transform);
        }
    }

    // ========================
    // Sokak lambası yerleştirme
    // ========================
    void PlaceStreetLamps()
    {
        if (streetLampPrefab == null) return;

        // Yollar boyunca lambalar
        // Bu gerçek projedeki yol waypoint'lerine göre düzenlenmeli
        float lampSpacing = 12f;
        for (float x = -mapWidth * 0.4f; x < mapWidth * 0.4f; x += lampSpacing)
        {
            // Ana yol boyunca lambalar
            Instantiate(streetLampPrefab, new Vector3(x, 0, 5f), Quaternion.identity, transform);
            Instantiate(streetLampPrefab, new Vector3(x, 0, -5f), Quaternion.Euler(0, 180f, 0), transform);
        }
    }

    // ========================
    // Yol kontrolü (basit AABB)
    // ========================
    bool IsOnRoad(Vector3 pos)
    {
        // Ana yollar: X ekseni boyunca (-5 to +5 Z)
        // Y ekseni boyunca (-5 to +5 X)
        bool mainRoadX = Mathf.Abs(pos.z) < 8f;
        bool mainRoadZ = Mathf.Abs(pos.x) < 8f;
        bool sideRoadX = Mathf.Abs(pos.z - 40f) < 6f || Mathf.Abs(pos.z + 40f) < 6f;
        bool sideRoadZ = Mathf.Abs(pos.x - 60f) < 6f || Mathf.Abs(pos.x + 60f) < 6f;

        return mainRoadX || mainRoadZ || sideRoadX || sideRoadZ;
    }

    bool IsNearBuilding(Vector3 pos)
    {
        Collider[] colliders = Physics.OverlapSphere(pos, 5f);
        foreach (var col in colliders)
        {
            if (col.CompareTag("Building")) return true;
        }
        return false;
    }
}
