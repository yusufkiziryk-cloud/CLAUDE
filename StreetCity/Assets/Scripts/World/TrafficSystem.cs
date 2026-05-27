using UnityEngine;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Street City: Open World Mobile
/// TrafficSystem - Trafik ve NPC araç sistemi
/// Object pooling ile optimize edilmiş trafik yönetimi
/// </summary>
public class TrafficSystem : MonoBehaviour
{
    public static TrafficSystem Instance { get; private set; }

    [System.Serializable]
    public class TrafficRoute
    {
        public string routeName;
        public Transform[] waypoints;    // Rota waypoint'leri
        public int maxCars = 3;          // Bu rotada maksimum araç
        public float spawnInterval = 10f; // Araç spawn aralığı
    }

    [Header("Trafik Ayarları")]
    public TrafficRoute[] routes;
    public GameObject[] trafficCarPrefabs;  // Farklı araç modelleri
    public int maxTotalCars = 15;           // Toplam maksimum trafik aracı
    public float despawnDistance = 80f;     // Oyuncudan ne kadar uzakta yok et
    public float activateDistance = 70f;    // Ne kadar yakında aktifleştir

    [Header("NPC Ayarları")]
    public GameObject pedestrianPrefab;    // Yaya prefab
    public Transform[] pedestrianPaths;    // Yaya yolları
    public int maxPedestrians = 10;        // Maksimum yaya

    // ---- Object Pool ----
    private List<GameObject> carPool = new List<GameObject>();
    private List<GameObject> activeCars = new List<GameObject>();
    private List<GameObject> activePedestrians = new List<GameObject>();

    private Transform playerTransform;
    private float spawnTimer = 0f;

    // Renk seçenekleri - canlı şehir havası için
    private readonly Color[] randomCarColors = {
        Color.red,
        Color.blue,
        Color.white,
        Color.gray,
        Color.black,
        new Color(0.2f, 0.6f, 0.2f), // Yeşil
        new Color(1f, 0.6f, 0f),     // Turuncu
        new Color(0.5f, 0.1f, 0.5f)  // Mor
    };

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        InitializePool();
        StartCoroutine(SpawnInitialTraffic());
    }

    void Update()
    {
        UpdatePlayerRef();
        ManageTrafficCars();
        spawnTimer += Time.deltaTime;

        if (spawnTimer > 5f)
        {
            spawnTimer = 0f;
            TrySpawnCars();
        }
    }

    // ========================
    // Object Pool başlatma
    // ========================
    void InitializePool()
    {
        if (trafficCarPrefabs == null || trafficCarPrefabs.Length == 0) return;

        for (int i = 0; i < maxTotalCars; i++)
        {
            GameObject prefab = trafficCarPrefabs[i % trafficCarPrefabs.Length];
            if (prefab == null) continue;

            GameObject car = Instantiate(prefab);
            car.SetActive(false);
            carPool.Add(car);
        }
    }

    // ========================
    // Başlangıç trafiği spawn et
    // ========================
    IEnumerator SpawnInitialTraffic()
    {
        yield return new WaitForSeconds(1f); // Oyun yüklensin

        if (routes == null) yield break;

        foreach (var route in routes)
        {
            for (int i = 0; i < route.maxCars; i++)
            {
                SpawnCarOnRoute(route);
                yield return new WaitForSeconds(0.2f); // FPS spike önleme
            }
        }

        SpawnPedestrians();
    }

    // ========================
    // Rotaya araç spawn et
    // ========================
    void SpawnCarOnRoute(TrafficRoute route)
    {
        if (route.waypoints == null || route.waypoints.Length < 2) return;
        if (activeCars.Count >= maxTotalCars) return;

        // Pool'dan araç al
        GameObject car = GetFromPool();
        if (car == null) return;

        // Rastgele waypoint'te başlat
        int startWP = Random.Range(0, route.waypoints.Length);
        Transform wp = route.waypoints[startWP];
        if (wp == null) return;

        car.transform.position = wp.position + Vector3.up * 0.3f;
        car.transform.rotation = wp.rotation;
        car.SetActive(true);

        // Rastgele renk ata
        ApplyRandomColor(car);

        // AI Controller'ı route waypoint'leriyle ayarla
        AICarController ai = car.GetComponent<AICarController>();
        if (ai != null)
        {
            ai.SetWaypoints(route.waypoints);
            ai.ReturnToPatrol();
        }

        // Basit trafik script ekle (WheelCollider olmadan basit hareket için)
        SimpleTrafficCar trafficCar = car.GetComponent<SimpleTrafficCar>();
        if (trafficCar == null)
        {
            trafficCar = car.AddComponent<SimpleTrafficCar>();
        }
        trafficCar.SetRoute(route.waypoints, startWP);

        activeCars.Add(car);
    }

    // ========================
    // Trafik araçlarını yönet
    // ========================
    void ManageTrafficCars()
    {
        if (playerTransform == null) return;

        List<GameObject> toDeactivate = new List<GameObject>();

        foreach (var car in activeCars)
        {
            if (car == null) continue;

            float dist = Vector3.Distance(car.transform.position, playerTransform.position);

            // Uzak araçları deaktive et
            if (dist > despawnDistance)
                toDeactivate.Add(car);
        }

        foreach (var car in toDeactivate)
        {
            activeCars.Remove(car);
            ReturnToPool(car);
        }
    }

    // ========================
    // Araç spawn etmeyi dene
    // ========================
    void TrySpawnCars()
    {
        if (activeCars.Count >= maxTotalCars) return;
        if (routes == null) return;

        foreach (var route in routes)
        {
            // Bu rotadaki aktif araç sayısını say
            int carsOnRoute = CountCarsOnRoute(route);
            if (carsOnRoute < route.maxCars)
            {
                SpawnCarOnRoute(route);
                break; // Her update'te 1 araç spawn et
            }
        }
    }

    int CountCarsOnRoute(TrafficRoute route)
    {
        int count = 0;
        foreach (var car in activeCars)
        {
            if (car == null) continue;
            SimpleTrafficCar tc = car.GetComponent<SimpleTrafficCar>();
            if (tc != null) count++;
        }
        return count;
    }

    // ========================
    // Rastgele renk uygula
    // ========================
    void ApplyRandomColor(GameObject car)
    {
        Color randomColor = randomCarColors[Random.Range(0, randomCarColors.Length)];
        MeshRenderer[] renderers = car.GetComponentsInChildren<MeshRenderer>();
        foreach (var r in renderers)
        {
            if (r.material != null)
            {
                Material mat = new Material(r.material); // Instance oluştur
                mat.color = randomColor;
                r.material = mat;
            }
        }
    }

    // ========================
    // Yaya spawn et
    // ========================
    void SpawnPedestrians()
    {
        if (pedestrianPrefab == null || pedestrianPaths == null) return;

        for (int i = 0; i < maxPedestrians; i++)
        {
            Transform path = pedestrianPaths[Random.Range(0, pedestrianPaths.Length)];
            if (path == null) continue;

            GameObject ped = Instantiate(pedestrianPrefab, path.position, Quaternion.identity);
            SimplePedestrian pedScript = ped.GetComponent<SimplePedestrian>();
            if (pedScript == null) pedScript = ped.AddComponent<SimplePedestrian>();
            pedScript.SetPaths(pedestrianPaths);

            activePedestrians.Add(ped);
        }
    }

    // ========================
    // Object Pool yönetimi
    // ========================
    GameObject GetFromPool()
    {
        foreach (var car in carPool)
        {
            if (car != null && !car.activeSelf)
                return car;
        }
        return null;
    }

    void ReturnToPool(GameObject car)
    {
        if (car == null) return;
        car.SetActive(false);
    }

    // ========================
    // Player ref güncelle
    // ========================
    void UpdatePlayerRef()
    {
        if (playerTransform == null)
        {
            var playerCar = GameManager.Instance?.GetPlayerCar();
            if (playerCar != null) playerTransform = playerCar.transform;
        }
    }
}

// ========================
// Basit Trafik Araç Scripti (WheelCollider gerektirmez - performans)
// ========================
public class SimpleTrafficCar : MonoBehaviour
{
    private Transform[] waypoints;
    private int currentWP = 0;
    private float speed = 0f;
    private float maxSpeed;

    void Start()
    {
        maxSpeed = Random.Range(25f, 45f); // km/h - şehir içi hız
    }

    public void SetRoute(Transform[] wps, int startIndex = 0)
    {
        waypoints = wps;
        currentWP = startIndex;
    }

    void Update()
    {
        if (waypoints == null || waypoints.Length == 0) return;

        Transform target = waypoints[currentWP];
        if (target == null) return;

        // Hedefe doğru hareket
        Vector3 direction = (target.position - transform.position).normalized;
        direction.y = 0;

        speed = Mathf.Lerp(speed, maxSpeed / 3.6f, Time.deltaTime * 2f);

        // Hareket
        transform.position += direction * speed * Time.deltaTime;

        // Yön
        if (direction != Vector3.zero)
        {
            Quaternion targetRot = Quaternion.LookRotation(direction);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, Time.deltaTime * 5f);
        }

        // Waypoint değiştir
        if (Vector3.Distance(transform.position, target.position) < 3f)
        {
            currentWP = (currentWP + 1) % waypoints.Length;
        }
    }
}

// ========================
// Basit Yaya Scripti
// ========================
public class SimplePedestrian : MonoBehaviour
{
    private Transform[] paths;
    private int currentPath = 0;
    private float speed = 1.2f; // m/s yürüme hızı
    private float waitTimer = 0f;
    private bool waiting = false;

    public void SetPaths(Transform[] newPaths)
    {
        paths = newPaths;
        currentPath = Random.Range(0, paths.Length);
    }

    void Update()
    {
        if (paths == null || paths.Length == 0) return;

        if (waiting)
        {
            waitTimer -= Time.deltaTime;
            if (waitTimer <= 0f) waiting = false;
            return;
        }

        Transform target = paths[currentPath];
        if (target == null) return;

        Vector3 direction = (target.position - transform.position).normalized;
        direction.y = 0;
        transform.position += direction * speed * Time.deltaTime;

        if (direction != Vector3.zero)
            transform.rotation = Quaternion.LookRotation(direction);

        if (Vector3.Distance(transform.position, target.position) < 1.5f)
        {
            currentPath = Random.Range(0, paths.Length);
            // Kısa bekleme
            waiting = true;
            waitTimer = Random.Range(1f, 4f);
        }
    }
}
