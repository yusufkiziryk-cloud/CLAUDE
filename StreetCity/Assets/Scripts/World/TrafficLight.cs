using UnityEngine;
using System.Collections;

/// <summary>
/// Street City: Open World Mobile
/// TrafficLight - Trafik ışığı sistemi
/// Kırmızı/Sarı/Yeşil döngüsü ve trafik akışı
/// </summary>
public class TrafficLight : MonoBehaviour
{
    [Header("Işık Nesneleri")]
    public MeshRenderer redLight;
    public MeshRenderer yellowLight;
    public MeshRenderer greenLight;

    [Header("Materyaller")]
    public Material redOnMaterial;
    public Material yellowOnMaterial;
    public Material greenOnMaterial;
    public Material lightOffMaterial;

    [Header("Zamanlama")]
    public float greenDuration = 8f;
    public float yellowDuration = 2f;
    public float redDuration = 8f;
    public float startDelay = 0f;  // Farklı kavşakları senkronize etmek için

    public enum LightState { Red, Yellow, Green }
    private LightState currentState = LightState.Red;

    public LightState CurrentState => currentState;

    // Yakındaki AI araçları durdurma için trigger
    public bool IsStop => currentState == LightState.Red || currentState == LightState.Yellow;

    void Start()
    {
        StartCoroutine(TrafficLightCycle());
    }

    IEnumerator TrafficLightCycle()
    {
        yield return new WaitForSeconds(startDelay);

        while (true)
        {
            // YEŞİL
            SetState(LightState.Green);
            yield return new WaitForSeconds(greenDuration);

            // SARI
            SetState(LightState.Yellow);
            yield return new WaitForSeconds(yellowDuration);

            // KIRMIZI
            SetState(LightState.Red);
            yield return new WaitForSeconds(redDuration);
        }
    }

    void SetState(LightState state)
    {
        currentState = state;

        // Işıkları söndür
        SetLightOff(redLight);
        SetLightOff(yellowLight);
        SetLightOff(greenLight);

        // Aktif ışığı yak
        switch (state)
        {
            case LightState.Red:
                SetLightOn(redLight, redOnMaterial);
                break;
            case LightState.Yellow:
                SetLightOn(yellowLight, yellowOnMaterial);
                break;
            case LightState.Green:
                SetLightOn(greenLight, greenOnMaterial);
                break;
        }
    }

    void SetLightOn(MeshRenderer light, Material mat)
    {
        if (light != null && mat != null) light.material = mat;
    }

    void SetLightOff(MeshRenderer light)
    {
        if (light != null && lightOffMaterial != null) light.material = lightOffMaterial;
    }

    // Trigger - AI araçları durdur
    void OnTriggerEnter(Collider other)
    {
        if (!IsStop) return;
        AICarController ai = other.GetComponentInParent<AICarController>();
        if (ai != null && ai.GetMode() == AICarController.AIMode.Patrol)
        {
            // AI yavaşla - TrafficSystem bunu yönetiyor
        }
    }
}
