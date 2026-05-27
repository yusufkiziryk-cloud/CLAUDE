using UnityEngine;
using UnityEngine.UI;
using System.Collections;

/// <summary>
/// Street City: Open World Mobile
/// VehicleEnterExitSystem - Araca binme ve arabadan inme sistemi
/// Oyuncu yakındaki araca binebilir, kontrol edebilir ve inebilir
/// </summary>
public class VehicleEnterExitSystem : MonoBehaviour
{
    public static VehicleEnterExitSystem Instance { get; private set; }

    [Header("Oyuncu Ayarları")]
    public GameObject playerCharacter;           // Yürüyen oyuncu karakteri
    public float enterDistance = 3f;             // Araca binmek için gereken mesafe
    public LayerMask vehicleLayer;               // Araç katmanı

    [Header("UI")]
    public Button enterExitButton;               // Bin/İn butonu
    public Text enterExitButtonText;             // Buton yazısı
    public GameObject enterPrompt;               // "Bin" göstergesi
    public Text nearestVehicleLabel;             // Yakın araç adı

    [Header("Kamera")]
    public MobileInputController inputController;

    // ---- Private değişkenler ----
    private PlayerCarController currentCar;      // Şu an kontrol edilen araç
    private PlayerCarController nearestCar;      // En yakın araç
    private bool isInCar = false;

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Update()
    {
        if (!isInCar)
        {
            FindNearestVehicle();
            UpdateEnterPrompt();
        }
    }

    // ========================
    // En yakın aracı bul
    // ========================
    void FindNearestVehicle()
    {
        PlayerCarController[] allCars = FindObjectsOfType<PlayerCarController>();
        float closestDist = float.MaxValue;
        nearestCar = null;

        Vector3 playerPos = playerCharacter != null
            ? playerCharacter.transform.position
            : transform.position;

        foreach (var car in allCars)
        {
            float dist = Vector3.Distance(playerPos, car.transform.position);
            if (dist < closestDist && dist <= enterDistance)
            {
                closestDist = dist;
                nearestCar = car;
            }
        }
    }

    // ========================
    // Bin/In göstergesini güncelle
    // ========================
    void UpdateEnterPrompt()
    {
        bool canEnter = nearestCar != null;

        if (enterPrompt != null)
            enterPrompt.SetActive(canEnter);

        if (nearestVehicleLabel != null)
            nearestVehicleLabel.text = canEnter ? nearestCar.vehicleName : "";

        if (enterExitButtonText != null)
            enterExitButtonText.text = isInCar ? "İN" : (canEnter ? "BİN" : "");

        if (enterExitButton != null)
            enterExitButton.gameObject.SetActive(isInCar || canEnter);
    }

    // ========================
    // Bin / In - Ana fonksiyon
    // ========================
    public void TryEnterOrExit()
    {
        if (isInCar)
            ExitVehicle();
        else if (nearestCar != null)
            EnterVehicle(nearestCar);
    }

    // ========================
    // Araca bin
    // ========================
    void EnterVehicle(PlayerCarController car)
    {
        currentCar = car;
        isInCar = true;

        // Oyuncu karakterini gizle
        if (playerCharacter != null)
        {
            playerCharacter.SetActive(false);
        }

        // Aracı araç konumuna taşı (araç kapısı animasyonu simülasyonu)
        StartCoroutine(EnterAnimation(car));

        // Input controller'ı araçla bağla
        if (inputController != null)
            inputController.SetTargetCar(car);

        // UI güncelle
        if (enterExitButtonText != null)
            enterExitButtonText.text = "İN";

        // Araca giriş yap
        car.EnterVehicle();

        // GameManager bildir
        GameManager.Instance?.OnPlayerEnteredVehicle(car);

        Debug.Log($"[VehicleSystem] Araca binildi: {car.vehicleName}");
    }

    IEnumerator EnterAnimation(PlayerCarController car)
    {
        // Kısa animasyon simülasyonu
        yield return new WaitForSeconds(0.2f);
        // Ekstra efektler buraya eklenebilir
    }

    // ========================
    // Arabadan in
    // ========================
    void ExitVehicle()
    {
        if (currentCar == null) return;

        // Oyuncu konumunu araç yanına ayarla
        Vector3 exitPos = currentCar.transform.position
            + currentCar.transform.right * 2f
            + Vector3.up * 0.5f;

        // Oyuncu karakterini aktifleştir
        if (playerCharacter != null)
        {
            playerCharacter.transform.position = exitPos;
            playerCharacter.SetActive(true);
        }

        // Araçtan çık
        currentCar.ExitVehicle();
        currentCar = null;
        isInCar = false;

        // Input controller'ı sıfırla
        if (inputController != null)
            inputController.SetTargetCar(null);

        // UI güncelle
        if (enterExitButtonText != null)
            enterExitButtonText.text = "";

        // GameManager bildir
        GameManager.Instance?.OnPlayerExitedVehicle();

        Debug.Log("[VehicleSystem] Araçtan inildi");
    }

    // ========================
    // Dışarıdan erişim
    // ========================
    public bool IsInCar() => isInCar;
    public PlayerCarController GetCurrentCar() => currentCar;

    // Zorla araçtan at (polis kontrolü için)
    public void ForceExit()
    {
        if (isInCar) ExitVehicle();
    }

    // Belirli araca bin (görev sistemi için)
    public void ForceEnterVehicle(PlayerCarController car)
    {
        if (!isInCar) EnterVehicle(car);
    }
}
