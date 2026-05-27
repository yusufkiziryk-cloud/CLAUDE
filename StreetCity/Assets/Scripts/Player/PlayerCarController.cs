using UnityEngine;
using System.Collections;

/// <summary>
/// Street City: Open World Mobile
/// PlayerCarController - Oyuncunun araç fizik ve kontrol sistemi
/// Mobil için optimize edilmiş, WheelCollider tabanlı araç fiziği
/// </summary>
public class PlayerCarController : MonoBehaviour
{
    [Header("Araç Ayarları")]
    public string vehicleName = "Sport Car";
    public float maxSpeed = 120f;           // Maksimum hız (km/h)
    public float acceleration = 1500f;       // Hızlanma kuvveti
    public float brakeForce = 3000f;         // Fren kuvveti
    public float handbrakeForce = 4000f;     // El freni kuvveti
    public float steerAngle = 30f;           // Maksimum dönüş açısı
    public float nitroSpeedBoost = 50f;      // Nitro hız artışı
    public float nitroDuration = 3f;         // Nitro süresi (saniye)
    public float nitroRechargeTime = 8f;     // Nitro şarj süresi

    [Header("Tekerlek Collider'ları")]
    public WheelCollider frontLeftWheel;
    public WheelCollider frontRightWheel;
    public WheelCollider rearLeftWheel;
    public WheelCollider rearRightWheel;

    [Header("Tekerlek Transform'ları (Görsel)")]
    public Transform frontLeftTransform;
    public Transform frontRightTransform;
    public Transform rearLeftTransform;
    public Transform rearRightTransform;

    [Header("Araç Merkezi Ağırlık")]
    public Transform centerOfMass;

    [Header("Geliştirme Seviyeleri (0-3)")]
    [Range(0, 3)] public int speedLevel = 0;
    [Range(0, 3)] public int brakeLevel = 0;
    [Range(0, 3)] public int nitroLevel = 0;
    [Range(0, 3)] public int gripLevel = 0;

    // ---- Private değişkenler ----
    private Rigidbody rb;
    private float currentSpeed;
    private float motorInput;
    private float steerInput;
    private bool brakeInput;
    private bool handbrakeInput;

    // Nitro sistemi
    private bool nitroActive = false;
    private float nitroTimer = 0f;
    private float nitroRechargeTimer = 0f;
    private bool nitroRecharging = false;
    public bool IsNitroActive => nitroActive;
    public float NitroCooldownRatio => nitroRecharging ? (nitroRechargeTimer / nitroRechargeTime) : 1f;

    // Araç durumu
    private bool isPlayerInCar = false;
    public bool IsPlayerInCar => isPlayerInCar;
    public float CurrentSpeed => currentSpeed;
    public float SpeedKMH => rb != null ? rb.linearVelocity.magnitude * 3.6f : 0f;

    // Polis sistemi için çarpışma
    public event System.Action OnCollision;
    public event System.Action OnHighSpeed;

    // Yüksek hız uyarısı eşiği
    private const float HIGH_SPEED_THRESHOLD = 100f;
    private bool highSpeedWarned = false;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();

        // Mobil için optimize edilmiş Rigidbody ayarları
        rb.mass = 1200f;
        rb.linearDamping = 0.05f;
        rb.angularDamping = 0.1f;
        rb.interpolation = RigidbodyInterpolation.Interpolate;

        // Merkezi ağırlık noktasını ayarla (stabilite için alçak)
        if (centerOfMass != null)
            rb.centerOfMass = centerOfMass.localPosition;
        else
            rb.centerOfMass = new Vector3(0, -0.5f, 0);

        ApplyUpgradeMultipliers();
    }

    void Start()
    {
        SetupWheelFriction();
    }

    void Update()
    {
        UpdateNitroSystem();
        CheckHighSpeed();
    }

    void FixedUpdate()
    {
        if (!isPlayerInCar) return;

        HandleMotor();
        HandleSteering();
        HandleBrakes();
        UpdateWheelVisuals();
        ClampSpeed();
    }

    // ========================
    // Geliştirme çarpanlarını uygula
    // ========================
    public void ApplyUpgradeMultipliers()
    {
        maxSpeed = 120f + (speedLevel * 20f);        // Her seviye +20 km/h
        brakeForce = 3000f + (brakeLevel * 500f);    // Her seviye +500
        nitroDuration = 3f + (nitroLevel * 1f);       // Her seviye +1 saniye
        // Grip için WheelCollider friction ayarlanır
    }

    // ========================
    // Tekerlek friksiyon kurulumu
    // ========================
    void SetupWheelFriction()
    {
        float gripMultiplier = 1f + (gripLevel * 0.2f);

        WheelFrictionCurve forwardFriction = new WheelFrictionCurve
        {
            extremumSlip = 0.4f,
            extremumValue = 1f * gripMultiplier,
            asymptoteSlip = 0.8f,
            asymptoteValue = 0.5f * gripMultiplier,
            stiffness = 1.5f
        };

        WheelFrictionCurve sidewaysFriction = new WheelFrictionCurve
        {
            extremumSlip = 0.2f,
            extremumValue = 1f * gripMultiplier,
            asymptoteSlip = 0.5f,
            asymptoteValue = 0.75f * gripMultiplier,
            stiffness = 2f
        };

        foreach (var wheel in new[] { frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel })
        {
            if (wheel == null) continue;
            wheel.forwardFriction = forwardFriction;
            wheel.sidewaysFriction = sidewaysFriction;
        }
    }

    // ========================
    // Motor kontrolü
    // ========================
    void HandleMotor()
    {
        float torque = motorInput * acceleration;

        // Nitro aktifse ek tork
        if (nitroActive)
            torque += acceleration * 0.5f;

        // Arka tekerleklere tork uygula (RWD - Rear Wheel Drive)
        if (rearLeftWheel != null)
            rearLeftWheel.motorTorque = torque;
        if (rearRightWheel != null)
            rearRightWheel.motorTorque = torque;

        // Anlık hız hesapla
        currentSpeed = rb.linearVelocity.magnitude * 3.6f;
    }

    // ========================
    // Direksiyon kontrolü
    // ========================
    void HandleSteering()
    {
        // Hıza göre direksiyon hassasiyeti azalt (yüksek hızda daha az dönüş)
        float speedFactor = Mathf.Clamp01(1f - (currentSpeed / maxSpeed) * 0.5f);
        float currentSteerAngle = steerAngle * speedFactor;

        float targetAngle = steerInput * currentSteerAngle;

        if (frontLeftWheel != null)
            frontLeftWheel.steerAngle = Mathf.Lerp(frontLeftWheel.steerAngle, targetAngle, Time.fixedDeltaTime * 8f);
        if (frontRightWheel != null)
            frontRightWheel.steerAngle = Mathf.Lerp(frontRightWheel.steerAngle, targetAngle, Time.fixedDeltaTime * 8f);
    }

    // ========================
    // Fren kontrolü
    // ========================
    void HandleBrakes()
    {
        float brake = brakeInput ? brakeForce : 0f;
        float handbrake = handbrakeInput ? handbrakeForce : 0f;

        // Normal fren - 4 tekerleğe
        if (frontLeftWheel != null) frontLeftWheel.brakeTorque = brake;
        if (frontRightWheel != null) frontRightWheel.brakeTorque = brake;
        if (rearLeftWheel != null) rearLeftWheel.brakeTorque = brake + handbrake;
        if (rearRightWheel != null) rearRightWheel.brakeTorque = brake + handbrake;

        // El freni aktifken arka tekerlek gribi azalt (drift etkisi)
        if (handbrakeInput)
        {
            WheelFrictionCurve rearSideways = rearLeftWheel != null ? rearLeftWheel.sidewaysFriction : new WheelFrictionCurve();
            rearSideways.stiffness = 0.5f;
            if (rearLeftWheel != null) rearLeftWheel.sidewaysFriction = rearSideways;
            if (rearRightWheel != null) rearRightWheel.sidewaysFriction = rearSideways;
        }
        else
        {
            SetupWheelFriction();
        }
    }

    // ========================
    // Hız sınırı
    // ========================
    void ClampSpeed()
    {
        float nitroMax = nitroActive ? maxSpeed + nitroSpeedBoost : maxSpeed;
        if (rb.linearVelocity.magnitude > nitroMax / 3.6f)
        {
            rb.linearVelocity = rb.linearVelocity.normalized * (nitroMax / 3.6f);
        }
    }

    // ========================
    // Tekerlek görsel güncelleme
    // ========================
    void UpdateWheelVisuals()
    {
        UpdateSingleWheel(frontLeftWheel, frontLeftTransform);
        UpdateSingleWheel(frontRightWheel, frontRightTransform);
        UpdateSingleWheel(rearLeftWheel, rearLeftTransform);
        UpdateSingleWheel(rearRightWheel, rearRightTransform);
    }

    void UpdateSingleWheel(WheelCollider collider, Transform wheelTransform)
    {
        if (collider == null || wheelTransform == null) return;

        Vector3 pos;
        Quaternion rot;
        collider.GetWorldPose(out pos, out rot);
        wheelTransform.position = pos;
        wheelTransform.rotation = rot;
    }

    // ========================
    // Nitro sistemi
    // ========================
    void UpdateNitroSystem()
    {
        if (nitroActive)
        {
            nitroTimer -= Time.deltaTime;
            if (nitroTimer <= 0f)
            {
                nitroActive = false;
                nitroRecharging = true;
                nitroRechargeTimer = 0f;

                // Ses: nitro bitti
                AudioManager.Instance?.PlaySFX("nitro_end");
            }
        }

        if (nitroRecharging)
        {
            nitroRechargeTimer += Time.deltaTime;
            if (nitroRechargeTimer >= nitroRechargeTime)
            {
                nitroRecharging = false;
                // Ses: nitro hazır
                AudioManager.Instance?.PlaySFX("nitro_ready");
            }
        }
    }

    public void ActivateNitro()
    {
        if (!nitroActive && !nitroRecharging && isPlayerInCar)
        {
            nitroActive = true;
            nitroTimer = nitroDuration;
            AudioManager.Instance?.PlaySFX("nitro_boost");
        }
    }

    // ========================
    // Yüksek hız kontrolü (polis için)
    // ========================
    void CheckHighSpeed()
    {
        if (currentSpeed > HIGH_SPEED_THRESHOLD && !highSpeedWarned)
        {
            highSpeedWarned = true;
            OnHighSpeed?.Invoke();
        }
        else if (currentSpeed <= HIGH_SPEED_THRESHOLD)
        {
            highSpeedWarned = false;
        }
    }

    // ========================
    // Giriş değerlerini ayarla (MobileInputController tarafından çağrılır)
    // ========================
    public void SetMotorInput(float value) => motorInput = Mathf.Clamp(value, -1f, 1f);
    public void SetSteerInput(float value) => steerInput = Mathf.Clamp(value, -1f, 1f);
    public void SetBrakeInput(bool value) => brakeInput = value;
    public void SetHandbrakeInput(bool value) => handbrakeInput = value;

    // ========================
    // Araca bin / in
    // ========================
    public void EnterVehicle()
    {
        isPlayerInCar = true;
        AudioManager.Instance?.PlaySFX("door_open");
        AudioManager.Instance?.PlayEngineSound(true);
    }

    public void ExitVehicle()
    {
        isPlayerInCar = false;
        // Motor sesini kapat
        AudioManager.Instance?.PlayEngineSound(false);
        // Tüm inputları sıfırla
        motorInput = 0f;
        steerInput = 0f;
        brakeInput = false;
        handbrakeInput = false;
        if (frontLeftWheel != null) frontLeftWheel.brakeTorque = brakeForce; // Arabayı durdur
        if (frontRightWheel != null) frontRightWheel.brakeTorque = brakeForce;
        if (rearLeftWheel != null) rearLeftWheel.brakeTorque = brakeForce;
        if (rearRightWheel != null) rearRightWheel.brakeTorque = brakeForce;
        AudioManager.Instance?.PlaySFX("door_close");
    }

    // ========================
    // Çarpışma algılama
    // ========================
    void OnCollisionEnter(Collision collision)
    {
        if (collision.relativeVelocity.magnitude > 5f)
        {
            OnCollision?.Invoke();
            AudioManager.Instance?.PlaySFX("crash");
        }
    }

    // ========================
    // Araç verilerini kaydetmek için
    // ========================
    public VehicleData GetVehicleData()
    {
        return new VehicleData
        {
            vehicleName = this.vehicleName,
            speedLevel = this.speedLevel,
            brakeLevel = this.brakeLevel,
            nitroLevel = this.nitroLevel,
            gripLevel = this.gripLevel
        };
    }

    public void LoadVehicleData(VehicleData data)
    {
        speedLevel = data.speedLevel;
        brakeLevel = data.brakeLevel;
        nitroLevel = data.nitroLevel;
        gripLevel = data.gripLevel;
        ApplyUpgradeMultipliers();
        SetupWheelFriction();
    }
}

// Araç verisi - kayıt sistemi için
[System.Serializable]
public class VehicleData
{
    public string vehicleName;
    public int speedLevel;
    public int brakeLevel;
    public int nitroLevel;
    public int gripLevel;
    public string color;
}
