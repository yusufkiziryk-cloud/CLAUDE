using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using System.Collections.Generic;

/// <summary>
/// Street City: Open World Mobile
/// MobileInputController - Dokunmatik ekran kontrol sistemi
/// Joystick, butonlar ve kamera sürükleme yönetimi
/// </summary>
public class MobileInputController : MonoBehaviour
{
    public static MobileInputController Instance { get; private set; }

    [Header("Joystick Referansları")]
    public RectTransform joystickBackground;    // Sol joystick arka plan
    public RectTransform joystickHandle;        // Sol joystick topuzu
    public float joystickRadius = 60f;          // Joystick yarıçapı

    [Header("Buton Referansları")]
    public Button gasButton;          // Gaz butonu
    public Button brakeButton;        // Fren butonu
    public Button handbrakeButton;    // El freni butonu
    public Button nitroButton;        // Nitro butonu
    public Button enterExitButton;    // Araca bin/in butonu
    public Button missionButton;      // Görev butonu
    public Button mapButton;          // Harita butonu

    [Header("Kamera Döndürme")]
    public RectTransform cameraRotateArea;    // Sağ taraf kamera döndürme alanı
    public float cameraSensitivity = 2f;      // Kamera hassasiyeti

    [Header("Bağlı Araç")]
    public PlayerCarController playerCar;

    [Header("Kamera")]
    public Transform cameraRig;              // Kamera takipçisi
    public float cameraDistance = 6f;        // Kamera mesafesi
    public float cameraHeight = 2.5f;        // Kamera yüksekliği
    public float cameraSmoothing = 5f;       // Kamera yumuşatma

    // ---- Private değişkenler ----
    private int joystickTouchId = -1;
    private Vector2 joystickStartPos;
    private Vector2 joystickCurrentPos;
    private bool joystickActive = false;

    private int cameraTouchId = -1;
    private Vector2 cameraLastPos;
    private float cameraYaw = 0f;
    private float cameraPitch = 15f;

    private bool gasPressed = false;
    private bool brakePressed = false;
    private bool handbrakePressed = false;

    // Kamera target
    private Vector3 cameraTargetPos;
    private Quaternion cameraTargetRot;

    void Awake()
    {
        if (Instance == null)
            Instance = this;
        else
            Destroy(gameObject);
    }

    void Start()
    {
        SetupButtons();
        SetupJoystick();
    }

    void Update()
    {
        HandleTouchInput();
        UpdateCarInput();
        UpdateCamera();
    }

    // ========================
    // Buton kurulumu
    // ========================
    void SetupButtons()
    {
        // Gaz butonu - basılı tutma
        SetupHoldButton(gasButton, () => gasPressed = true, () => gasPressed = false);
        // Fren butonu - basılı tutma
        SetupHoldButton(brakeButton, () => brakePressed = true, () => brakePressed = false);
        // El freni - basılı tutma
        SetupHoldButton(handbrakeButton, () => handbrakePressed = true, () => handbrakePressed = false);

        // Nitro - tek tıklama
        if (nitroButton != null)
            nitroButton.onClick.AddListener(() => playerCar?.ActivateNitro());

        // Araca bin/in
        if (enterExitButton != null)
            enterExitButton.onClick.AddListener(OnEnterExitPressed);

        // Görev başlat
        if (missionButton != null)
            missionButton.onClick.AddListener(() => MissionManager.Instance?.StartNearestMission());

        // Harita
        if (mapButton != null)
            mapButton.onClick.AddListener(() => UIManager.Instance?.ToggleMap());
    }

    // Basılı tutma butonu helper
    void SetupHoldButton(Button button, System.Action onPress, System.Action onRelease)
    {
        if (button == null) return;

        EventTrigger trigger = button.gameObject.GetComponent<EventTrigger>()
                               ?? button.gameObject.AddComponent<EventTrigger>();

        // Basma
        EventTrigger.Entry pressEntry = new EventTrigger.Entry();
        pressEntry.eventID = EventTriggerType.PointerDown;
        pressEntry.callback.AddListener((_) => onPress());
        trigger.triggers.Add(pressEntry);

        // Bırakma
        EventTrigger.Entry releaseEntry = new EventTrigger.Entry();
        releaseEntry.eventID = EventTriggerType.PointerUp;
        releaseEntry.callback.AddListener((_) => onRelease());
        trigger.triggers.Add(releaseEntry);
    }

    // ========================
    // Joystick kurulumu
    // ========================
    void SetupJoystick()
    {
        if (joystickBackground != null)
            joystickStartPos = joystickBackground.anchoredPosition;
    }

    // ========================
    // Dokunmatik giriş işleme
    // ========================
    void HandleTouchInput()
    {
        // Mobil dokunma
        for (int i = 0; i < Input.touchCount; i++)
        {
            Touch touch = Input.GetTouch(i);
            HandleTouch(touch.fingerId, touch.position, touch.phase);
        }

        // Editor'da mouse ile test
#if UNITY_EDITOR
        HandleMouseInput();
#endif
    }

    void HandleTouch(int touchId, Vector2 position, TouchPhase phase)
    {
        // Joystick bölgesi - sol yarı ekran
        bool isLeftSide = position.x < Screen.width * 0.4f;
        // Kamera bölgesi - sağ yarı ekran (buton bölgesi hariç)
        bool isRightSide = position.x > Screen.width * 0.5f;

        if (phase == TouchPhase.Began)
        {
            if (isLeftSide && joystickTouchId == -1 && !IsPointerOverUI(position))
            {
                joystickTouchId = touchId;
                joystickActive = true;
                // Joystick pozisyonunu parmak pozisyonuna taşı
                if (joystickBackground != null)
                {
                    Vector2 localPos;
                    RectTransformUtility.ScreenPointToLocalPointInRectangle(
                        joystickBackground.parent as RectTransform,
                        position, null, out localPos);
                    joystickBackground.anchoredPosition = localPos;
                    joystickCurrentPos = localPos;
                }
            }
            else if (isRightSide && cameraTouchId == -1 && !IsPointerOverUI(position))
            {
                cameraTouchId = touchId;
                cameraLastPos = position;
            }
        }
        else if (phase == TouchPhase.Moved || phase == TouchPhase.Stationary)
        {
            if (touchId == joystickTouchId)
                UpdateJoystick(position);
            else if (touchId == cameraTouchId)
                UpdateCamera(position);
        }
        else if (phase == TouchPhase.Ended || phase == TouchPhase.Canceled)
        {
            if (touchId == joystickTouchId)
                ResetJoystick();
            else if (touchId == cameraTouchId)
                cameraTouchId = -1;
        }
    }

    // ========================
    // Joystick güncelleme
    // ========================
    void UpdateJoystick(Vector2 touchPos)
    {
        if (joystickBackground == null || joystickHandle == null) return;

        Vector2 localPos;
        RectTransformUtility.ScreenPointToLocalPointInRectangle(
            joystickBackground, touchPos, null, out localPos);

        localPos = Vector2.ClampMagnitude(localPos, joystickRadius);
        joystickHandle.anchoredPosition = localPos;
        joystickCurrentPos = localPos / joystickRadius;
    }

    void ResetJoystick()
    {
        joystickTouchId = -1;
        joystickActive = false;
        joystickCurrentPos = Vector2.zero;

        if (joystickHandle != null)
            joystickHandle.anchoredPosition = Vector2.zero;

        // Joystick'i orijinal konumuna geri döndür
        if (joystickBackground != null)
            joystickBackground.anchoredPosition = joystickStartPos;
    }

    // ========================
    // Kamera döndürme
    // ========================
    void UpdateCamera(Vector2 currentPos)
    {
        Vector2 delta = currentPos - cameraLastPos;
        cameraYaw += delta.x * cameraSensitivity * 0.1f;
        cameraPitch -= delta.y * cameraSensitivity * 0.1f;
        cameraPitch = Mathf.Clamp(cameraPitch, -5f, 45f);
        cameraLastPos = currentPos;
    }

    // ========================
    // Araç girişini güncelle
    // ========================
    void UpdateCarInput()
    {
        if (playerCar == null || !playerCar.IsPlayerInCar) return;

        // Joystick X ekseni = direksiyon
        float steer = joystickActive ? joystickCurrentPos.x : 0f;
        // Joystick Y ekseni = gaz/geri (veya buton)
        float motor = joystickActive ? joystickCurrentPos.y : 0f;

        // Gaz butonu da gazı kontrol ediyor
        if (gasPressed) motor = Mathf.Max(motor, 1f);

        playerCar.SetSteerInput(steer);
        playerCar.SetMotorInput(motor);
        playerCar.SetBrakeInput(brakePressed);
        playerCar.SetHandbrakeInput(handbrakePressed);
    }

    // ========================
    // Kamera takip sistemi
    // ========================
    void UpdateCamera()
    {
        if (playerCar == null || cameraRig == null) return;

        // Hedef pozisyon: araç arkası + yükseklik
        Quaternion rotation = Quaternion.Euler(cameraPitch, playerCar.transform.eulerAngles.y + cameraYaw, 0);
        Vector3 targetPosition = playerCar.transform.position
            + rotation * new Vector3(0, 0, -cameraDistance)
            + Vector3.up * cameraHeight;

        // Yumuşak hareket
        cameraRig.position = Vector3.Lerp(cameraRig.position, targetPosition, Time.deltaTime * cameraSmoothing);
        cameraRig.LookAt(playerCar.transform.position + Vector3.up * 1f);
    }

    // ========================
    // Araca bin/in butonu
    // ========================
    void OnEnterExitPressed()
    {
        VehicleEnterExitSystem.Instance?.TryEnterOrExit();
    }

    // ========================
    // UI üzerinde mi kontrolü
    // ========================
    bool IsPointerOverUI(Vector2 position)
    {
        PointerEventData eventData = new PointerEventData(EventSystem.current)
        {
            position = position
        };
        List<RaycastResult> results = new List<RaycastResult>();
        EventSystem.current?.RaycastAll(eventData, results);
        return results.Count > 0;
    }

    // ========================
    // Editor mouse testi
    // ========================
#if UNITY_EDITOR
    void HandleMouseInput()
    {
        // Sol tık = joystick simülasyonu
        if (Input.GetMouseButtonDown(0))
        {
            Vector2 pos = Input.mousePosition;
            if (pos.x < Screen.width * 0.4f && !IsPointerOverUI(pos))
            {
                joystickTouchId = 99;
                joystickActive = true;
            }
        }
        if (Input.GetMouseButton(0) && joystickTouchId == 99)
        {
            UpdateJoystick(Input.mousePosition);
        }
        if (Input.GetMouseButtonUp(0) && joystickTouchId == 99)
        {
            ResetJoystick();
        }

        // Sağ tık = kamera döndürme
        if (Input.GetMouseButtonDown(1))
        {
            cameraTouchId = 98;
            cameraLastPos = Input.mousePosition;
        }
        if (Input.GetMouseButton(1) && cameraTouchId == 98)
        {
            UpdateCamera(Input.mousePosition);
        }
        if (Input.GetMouseButtonUp(1) && cameraTouchId == 98)
        {
            cameraTouchId = -1;
        }

        // Klavye test girişi
        float h = Input.GetAxis("Horizontal");
        float v = Input.GetAxis("Vertical");
        bool space = Input.GetKey(KeyCode.Space);
        bool shift = Input.GetKey(KeyCode.LeftShift);
        bool ctrl = Input.GetKey(KeyCode.LeftControl);

        if (playerCar != null && playerCar.IsPlayerInCar)
        {
            if (Mathf.Abs(h) > 0.01f || Mathf.Abs(v) > 0.01f || space || shift)
            {
                playerCar.SetSteerInput(h);
                playerCar.SetMotorInput(v);
                playerCar.SetBrakeInput(space);
                playerCar.SetHandbrakeInput(shift);
            }
            if (ctrl) playerCar.ActivateNitro();
        }
    }
#endif

    // ========================
    // Dışarıdan erişim
    // ========================
    public void SetTargetCar(PlayerCarController car)
    {
        playerCar = car;
    }

    public void SetCameraYaw(float yaw)
    {
        cameraYaw = yaw;
    }
}
