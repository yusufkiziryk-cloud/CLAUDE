using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Street City: Open World Mobile
/// MiniMapController - Mini harita sistemi
/// Oyuncu konumu, görev noktası ve yarış rotası gösterimi
/// </summary>
public class MiniMapController : MonoBehaviour
{
    public static MiniMapController Instance { get; private set; }

    [Header("Mini Harita Kamerası")]
    public Camera miniMapCamera;           // Yukarıdan bakan ortografik kamera
    public float cameraHeight = 80f;       // Kamera yüksekliği
    public float mapZoom = 60f;            // Kamera ortografik boyutu

    [Header("Mini Harita UI")]
    public RawImage miniMapImage;          // Mini harita render texture
    public RectTransform playerIcon;       // Oyuncu ikon
    public RectTransform missionIcon;      // Görev hedef ikonu
    public RectTransform[] waypointIcons;  // Yarış waypoint ikonları
    public GameObject mapFullPanel;        // Tam harita paneli
    public RawImage fullMapImage;          // Tam harita görüntüsü

    [Header("Harita Boyutları")]
    public float mapWorldWidth = 200f;     // Haritanın dünya genişliği
    public float mapWorldHeight = 200f;    // Haritanın dünya yüksekliği
    public Vector2 mapCenter = Vector2.zero; // Harita merkezi (dünya koordinatı)

    // ---- Private değişkenler ----
    private Transform playerTransform;
    private Vector3 missionTargetPos = Vector3.zero;
    private bool hasMissionTarget = false;
    private bool isFullMapOpen = false;

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        SetupMiniMapCamera();
        HideMissionIcon();
    }

    void LateUpdate()
    {
        UpdatePlayerPosition();
        UpdateMiniMapCamera();
    }

    // ========================
    // Mini harita kamerası kurulumu
    // ========================
    void SetupMiniMapCamera()
    {
        if (miniMapCamera == null) return;

        miniMapCamera.orthographic = true;
        miniMapCamera.orthographicSize = mapZoom;
        miniMapCamera.clearFlags = CameraClearFlags.SolidColor;
        miniMapCamera.backgroundColor = new Color(0.1f, 0.15f, 0.1f);
        miniMapCamera.cullingMask = ~(1 << LayerMask.NameToLayer("Player")); // Oyuncuyu hariç tut
    }

    // ========================
    // Kamerayı oyuncu üzerinde tut
    // ========================
    void UpdateMiniMapCamera()
    {
        if (miniMapCamera == null) return;

        // Oyuncu transformunu bul
        if (playerTransform == null)
        {
            var car = GameManager.Instance?.GetPlayerCar();
            if (car != null) playerTransform = car.transform;
        }

        if (playerTransform == null) return;

        // Kamerayı oyuncunun üzerine taşı
        Vector3 newPos = playerTransform.position;
        newPos.y = cameraHeight;
        miniMapCamera.transform.position = newPos;
        miniMapCamera.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
    }

    // ========================
    // Oyuncu ikonunu güncelle
    // ========================
    void UpdatePlayerPosition()
    {
        if (playerTransform == null || miniMapImage == null || playerIcon == null) return;

        // Dünya koordinatını mini harita koordinatına çevir
        Vector2 mapPos = WorldToMapPosition(playerTransform.position);
        playerIcon.anchoredPosition = mapPos;

        // Oyuncu ikonunu araç yönüne göre döndür
        playerIcon.rotation = Quaternion.Euler(0, 0, -playerTransform.eulerAngles.y);

        // Görev ikonu güncelle
        if (hasMissionTarget && missionIcon != null)
        {
            Vector2 missionMapPos = WorldToMapPosition(missionTargetPos);
            missionIcon.anchoredPosition = missionMapPos;
        }
    }

    // ========================
    // Dünya -> Mini harita koordinatı
    // ========================
    Vector2 WorldToMapPosition(Vector3 worldPos)
    {
        if (miniMapImage == null) return Vector2.zero;

        Rect mapRect = miniMapImage.rectTransform.rect;

        // Dünya koordinatını normalize et (0-1 arası)
        float normX = (worldPos.x - (mapCenter.x - mapWorldWidth * 0.5f)) / mapWorldWidth;
        float normZ = (worldPos.z - (mapCenter.y - mapWorldHeight * 0.5f)) / mapWorldHeight;

        // Mini harita boyutuna çevir
        float mapX = (normX - 0.5f) * mapRect.width;
        float mapY = (normZ - 0.5f) * mapRect.height;

        return new Vector2(mapX, mapY);
    }

    // ========================
    // Görev hedefini ayarla
    // ========================
    public void SetMissionTarget(Vector3 worldPosition)
    {
        missionTargetPos = worldPosition;
        hasMissionTarget = true;
        if (missionIcon != null) missionIcon.gameObject.SetActive(true);
    }

    public void ClearMissionTarget()
    {
        hasMissionTarget = false;
        HideMissionIcon();
    }

    void HideMissionIcon()
    {
        if (missionIcon != null) missionIcon.gameObject.SetActive(false);
    }

    // ========================
    // Yarış waypoint'lerini göster
    // ========================
    public void ShowRaceWaypoints(Transform[] waypoints)
    {
        if (waypointIcons == null) return;

        for (int i = 0; i < waypointIcons.Length; i++)
        {
            if (waypointIcons[i] == null) continue;

            if (i < waypoints.Length)
            {
                waypointIcons[i].gameObject.SetActive(true);
                waypointIcons[i].anchoredPosition = WorldToMapPosition(waypoints[i].position);
            }
            else
            {
                waypointIcons[i].gameObject.SetActive(false);
            }
        }
    }

    public void HideRaceWaypoints()
    {
        if (waypointIcons == null) return;
        foreach (var icon in waypointIcons)
            if (icon != null) icon.gameObject.SetActive(false);
    }

    // ========================
    // Tam harita aç/kapat
    // ========================
    public void ToggleFullMap()
    {
        isFullMapOpen = !isFullMapOpen;
        if (mapFullPanel != null) mapFullPanel.SetActive(isFullMapOpen);

        // Tam haritada zoom değiştir
        if (miniMapCamera != null)
            miniMapCamera.orthographicSize = isFullMapOpen ? mapZoom * 3f : mapZoom;
    }

    // ========================
    // Harita zoom
    // ========================
    public void ZoomIn()
    {
        if (miniMapCamera != null)
            miniMapCamera.orthographicSize = Mathf.Max(20f, miniMapCamera.orthographicSize - 10f);
    }

    public void ZoomOut()
    {
        if (miniMapCamera != null)
            miniMapCamera.orthographicSize = Mathf.Min(120f, miniMapCamera.orthographicSize + 10f);
    }
}
