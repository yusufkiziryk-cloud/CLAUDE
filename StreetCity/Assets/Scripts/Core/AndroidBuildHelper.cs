using UnityEngine;

/// <summary>
/// Street City: Open World Mobile
/// AndroidBuildHelper - Android build öncesi otomatik ayarları yapar
/// Uygulama başlangıcında çalışır
/// </summary>
public class AndroidBuildHelper : MonoBehaviour
{
    void Awake()
    {
        ApplyMobileSettings();
    }

    void ApplyMobileSettings()
    {
        // Ekranı asla kapatma (oyun sırasında)
        Screen.sleepTimeout = SleepTimeout.NeverSleep;

        // Landscape mod zorla
        Screen.orientation = ScreenOrientation.LandscapeLeft;

        // FPS hedefi
        Application.targetFrameRate = 60;
        QualitySettings.vSyncCount = 0;

        // Android'e özel optimizasyonlar
#if UNITY_ANDROID
        // GPU throttling önleme (bazı cihazlarda)
        Application.targetFrameRate = 60;

        // Bellek baskısı callback
        Application.lowMemory += OnLowMemory;
#endif

        Debug.Log("[Build] Android ayarları uygulandı");
        Debug.Log($"[Build] Cihaz: {SystemInfo.deviceModel}");
        Debug.Log($"[Build] RAM: {SystemInfo.systemMemorySize}MB");
        Debug.Log($"[Build] GPU: {SystemInfo.graphicsDeviceName}");
        Debug.Log($"[Build] API: {SystemInfo.graphicsDeviceType}");
    }

    void OnLowMemory()
    {
        // Düşük bellek uyarısı - cache'leri temizle
        Resources.UnloadUnusedAssets();
        System.GC.Collect();
        Debug.LogWarning("[Build] Düşük bellek uyarısı! Cache temizlendi.");
    }

    void OnDestroy()
    {
#if UNITY_ANDROID
        Application.lowMemory -= OnLowMemory;
#endif
    }
}
