using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Street City: Open World Mobile
/// MoneySystem - Para kazanma ve harcama sistemi
/// Görev ödülleri, araç yükseltmeleri ve renk değiştirme
/// </summary>
public class MoneySystem : MonoBehaviour
{
    public static MoneySystem Instance { get; private set; }

    [Header("Para UI")]
    public Text moneyText;
    public Text moneyEarnedText;     // Kazanılan para popup'u
    public Animator moneyPopupAnim;  // Para popup animasyonu

    [Header("Başlangıç Parası")]
    public int startingMoney = 1000;

    // ---- Private değişkenler ----
    private int currentMoney = 0;
    public int CurrentMoney => currentMoney;

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        // Kayıtlı para varsa yükle, yoksa başlangıç parası
        int savedMoney = SaveLoadSystem.Instance?.GetMoney() ?? startingMoney;
        currentMoney = savedMoney;
        UpdateMoneyUI();
    }

    // ========================
    // Para ekle
    // ========================
    public void AddMoney(int amount)
    {
        if (amount <= 0) return;

        currentMoney += amount;
        UpdateMoneyUI();
        ShowMoneyPopup(amount, true);
        SaveLoadSystem.Instance?.SaveMoney(currentMoney);

        Debug.Log($"[Money] +{amount} $ | Toplam: {currentMoney} $");
    }

    // ========================
    // Para harca
    // ========================
    public bool SpendMoney(int amount)
    {
        if (amount <= 0) return true;
        if (currentMoney < amount)
        {
            ShowMoneyPopup(-amount, false);
            Debug.Log($"[Money] Yetersiz para! Gereken: {amount}, Mevcut: {currentMoney}");
            return false;
        }

        currentMoney -= amount;
        UpdateMoneyUI();
        ShowMoneyPopup(-amount, false);
        SaveLoadSystem.Instance?.SaveMoney(currentMoney);

        Debug.Log($"[Money] -{amount} $ | Kalan: {currentMoney} $");
        return true;
    }

    // ========================
    // Yeterli para var mı?
    // ========================
    public bool HasEnoughMoney(int amount)
    {
        return currentMoney >= amount;
    }

    // ========================
    // Para UI güncelleme
    // ========================
    void UpdateMoneyUI()
    {
        if (moneyText != null)
            moneyText.text = $"${currentMoney:N0}";
    }

    // ========================
    // Para popup efekti
    // ========================
    void ShowMoneyPopup(int amount, bool positive)
    {
        if (moneyEarnedText == null) return;

        string sign = positive ? "+" : "";
        moneyEarnedText.text = $"{sign}{amount} $";
        moneyEarnedText.color = positive ? Color.green : Color.red;

        if (moneyPopupAnim != null)
            moneyPopupAnim.SetTrigger("Show");
    }

    // ========================
    // Yükseltme maliyetleri
    // ========================
    public static int GetUpgradeCost(int currentLevel)
    {
        switch (currentLevel)
        {
            case 0: return 500;    // Level 0 -> 1
            case 1: return 1000;   // Level 1 -> 2
            case 2: return 2500;   // Level 2 -> 3
            default: return 0;     // Maksimum
        }
    }

    // Renk değiştirme maliyeti
    public static int GetColorChangeCost() => 200;
}
