using UnityEngine;

/// <summary>
/// Street City: Open World Mobile
/// CheckpointTrigger - Yarış kontrol noktası tetikleyicisi
/// Oyuncu ve AI araçların geçişini algılar
/// </summary>
public class CheckpointTrigger : MonoBehaviour
{
    [Header("Checkpoint Ayarları")]
    public int checkpointIndex = 0;       // Bu checkpoint'in sırası
    public bool isStartLine = false;      // Başlangıç çizgisi mi?
    public bool isFinishLine = false;     // Bitiş çizgisi mi?

    [Header("Görsel Efektler")]
    public GameObject passEffect;         // Geçiş efekti
    public Color activeColor = Color.yellow;
    public Color passedColor = Color.green;

    private MeshRenderer meshRenderer;
    private bool playerPassed = false;

    void Start()
    {
        meshRenderer = GetComponent<MeshRenderer>();
        UpdateVisual(false);
    }

    void OnTriggerEnter(Collider other)
    {
        // Oyuncu aracı mı?
        if (other.CompareTag("Player") || other.CompareTag("PlayerCar"))
        {
            HandlePlayerPass();
        }

        // AI araç mı?
        AICarController aiCar = other.GetComponentInParent<AICarController>();
        if (aiCar != null && !aiCar.isPolice)
        {
            HandleAIPass(aiCar);
        }
    }

    void HandlePlayerPass()
    {
        if (!RaceManager.Instance?.IsRacing ?? true) return;

        RaceManager.Instance?.OnPlayerPassedCheckpoint(checkpointIndex);

        // Görsel feedback
        UpdateVisual(true);
        if (passEffect != null)
        {
            GameObject effect = Instantiate(passEffect, transform.position, Quaternion.identity);
            Destroy(effect, 2f);
        }

        // Ses
        AudioManager.Instance?.PlaySFX("checkpoint_pass");

        Debug.Log($"[Checkpoint] Oyuncu checkpoint {checkpointIndex} geçti");
    }

    void HandleAIPass(AICarController ai)
    {
        if (!RaceManager.Instance?.IsRacing ?? true) return;
        RaceManager.Instance?.OnAIPassedCheckpoint(ai, checkpointIndex);
    }

    void UpdateVisual(bool passed)
    {
        if (meshRenderer == null) return;
        Material mat = new Material(meshRenderer.material);
        mat.color = passed ? passedColor : activeColor;
        mat.SetColor("_EmissionColor", passed ? passedColor * 0.5f : activeColor * 0.5f);
        meshRenderer.material = mat;
    }

    // Yarış başlayınca reset
    public void ResetCheckpoint()
    {
        playerPassed = false;
        UpdateVisual(false);
    }
}
