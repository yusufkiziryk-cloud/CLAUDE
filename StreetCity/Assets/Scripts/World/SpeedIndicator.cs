using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Street City: Open World Mobile
/// SpeedIndicator - Gerçekçi analog hız göstergesi (iğneli)
/// Hem dijital hem analog mod destekli
/// </summary>
public class SpeedIndicator : MonoBehaviour
{
    [Header("Dijital Mod")]
    public Text speedText;
    public Text speedUnitText;

    [Header("Analog Mod (Opsiyonel)")]
    public RectTransform needleTransform;  // Hız ibresi
    public float minAngle = -135f;         // 0 km/h açısı
    public float maxAngle = 135f;          // maxSpeed km/h açısı
    public float maxSpeedDisplay = 200f;   // Maksimum gösterge hızı

    [Header("Renk Değişimi")]
    public Image speedBackground;
    public Color normalColor = new Color(0.1f, 0.1f, 0.1f, 0.8f);
    public Color warningColor = new Color(0.8f, 0.4f, 0f, 0.9f);  // 80% hızda
    public Color dangerColor = new Color(0.8f, 0f, 0f, 0.9f);     // 95% hızda

    private PlayerCarController playerCar;
    private float currentDisplaySpeed = 0f;
    private float smoothSpeed = 0f;

    void Start()
    {
        if (speedUnitText != null) speedUnitText.text = "km/h";
    }

    void Update()
    {
        UpdatePlayerRef();
        if (playerCar == null) return;

        float targetSpeed = playerCar.SpeedKMH;
        smoothSpeed = Mathf.Lerp(smoothSpeed, targetSpeed, Time.deltaTime * 8f);

        UpdateDigitalDisplay(smoothSpeed);
        UpdateAnalogDisplay(smoothSpeed);
        UpdateColorFeedback(smoothSpeed);
    }

    void UpdatePlayerRef()
    {
        if (playerCar == null)
            playerCar = GameManager.Instance?.GetPlayerCar();
    }

    void UpdateDigitalDisplay(float speed)
    {
        if (speedText != null)
            speedText.text = ((int)speed).ToString();
    }

    void UpdateAnalogDisplay(float speed)
    {
        if (needleTransform == null) return;

        float normalizedSpeed = Mathf.Clamp01(speed / maxSpeedDisplay);
        float angle = Mathf.Lerp(minAngle, maxAngle, normalizedSpeed);
        needleTransform.localRotation = Quaternion.Euler(0, 0, -angle);
    }

    void UpdateColorFeedback(float speed)
    {
        if (speedBackground == null || playerCar == null) return;

        float speedRatio = speed / playerCar.maxSpeed;
        Color targetColor;

        if (speedRatio > 0.95f)
            targetColor = dangerColor;
        else if (speedRatio > 0.8f)
            targetColor = warningColor;
        else
            targetColor = normalColor;

        speedBackground.color = Color.Lerp(speedBackground.color, targetColor, Time.deltaTime * 3f);
    }
}
