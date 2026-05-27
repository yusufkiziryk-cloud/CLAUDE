using UnityEngine;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Street City: Open World Mobile
/// AICarController - Yapay zeka araç sürüş sistemi
/// Yol takibi, yarış modu, trafik modu ve polis modu
/// </summary>
[RequireComponent(typeof(Rigidbody))]
public class AICarController : MonoBehaviour
{
    // ---- AI Modu Enum ----
    public enum AIMode
    {
        Patrol,    // Normal trafik dolaşımı
        Racing,    // Yarış modu
        Police,    // Polis takip modu
        Stopped    // Durdu
    }

    [Header("Araç Ayarları")]
    public string vehicleName = "AI Car";
    public float maxSpeed = 80f;
    public float acceleration = 800f;
    public float brakeForce = 2000f;
    public float steerAngle = 30f;
    public bool isPolice = false;

    [Header("WheelCollider'lar")]
    public WheelCollider frontLeftWheel;
    public WheelCollider frontRightWheel;
    public WheelCollider rearLeftWheel;
    public WheelCollider rearRightWheel;

    [Header("Wheel Transform'lar")]
    public Transform frontLeftTransform;
    public Transform frontRightTransform;
    public Transform rearLeftTransform;
    public Transform rearRightTransform;

    [Header("AI Navigasyon")]
    public Transform[] waypoints;           // Devriye/yarış yol noktaları
    public float waypointReachDistance = 5f; // Waypoint'e ulaşma mesafesi
    public float avoidanceDistance = 8f;     // Engelden kaçınma mesafesi
    public LayerMask obstacleLayer;          // Engel katmanı

    [Header("Polis Ayarları")]
    public float policeChaseSpeed = 110f;   // Takip hızı
    public float policeRamDistance = 3f;    // Çarpmaya geçme mesafesi

    // ---- Private değişkenler ----
    private Rigidbody rb;
    private AIMode currentMode = AIMode.Patrol;
    private int currentWaypointIndex = 0;
    private Transform targetTransform;      // Takip hedefi (polis için)
    private float currentSpeed;

    // Steer ve motor değerleri
    private float motorInput;
    private float steerInput;
    private bool brakeInput;

    // Yarış checkpoint takibi
    private int raceCheckpointIndex = 0;

    // Engel kaçınma
    private float avoidanceTimer = 0f;
    private float avoidanceDirection = 0f;

    // Rastgele varyasyon (daha gerçekçi AI için)
    private float speedVariation;
    private float reactionDelay;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
        rb.mass = 1200f;
        rb.centerOfMass = new Vector3(0, -0.5f, 0);
        rb.interpolation = RigidbodyInterpolation.Interpolate;

        // Rastgele varyasyon
        speedVariation = Random.Range(-10f, 10f);
        reactionDelay = Random.Range(0f, 0.3f);
    }

    void Start()
    {
        // Yarış için checkpointlerden başla
        if (waypoints != null && waypoints.Length > 0)
        {
            currentWaypointIndex = Random.Range(0, waypoints.Length);
        }
    }

    void FixedUpdate()
    {
        switch (currentMode)
        {
            case AIMode.Patrol:
                PatrolBehavior();
                break;
            case AIMode.Racing:
                RacingBehavior();
                break;
            case AIMode.Police:
                PoliceBehavior();
                break;
            case AIMode.Stopped:
                BrakeFully();
                break;
        }

        ApplyMotorAndSteering();
        UpdateWheelVisuals();
        LimitSpeed();
    }

    // ========================
    // Devriye davranışı - Normal trafik
    // ========================
    void PatrolBehavior()
    {
        if (waypoints == null || waypoints.Length == 0) return;

        Transform target = waypoints[currentWaypointIndex];
        NavigateToTarget(target, maxSpeed + speedVariation);

        // Waypoint'e ulaştıysa sonrakine geç
        if (Vector3.Distance(transform.position, target.position) < waypointReachDistance)
        {
            currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.Length;
        }
    }

    // ========================
    // Yarış davranışı
    // ========================
    void RacingBehavior()
    {
        var raceManager = RaceManager.Instance;
        if (raceManager == null || raceManager.checkpoints == null) return;

        if (raceManager.checkpoints.Length == 0) return;

        Transform checkpoint = raceManager.checkpoints[raceCheckpointIndex % raceManager.checkpoints.Length];
        NavigateToTarget(checkpoint, maxSpeed + 15f); // Yarışta biraz daha hızlı

        // Checkpoint'e ulaştıysa
        if (Vector3.Distance(transform.position, checkpoint.position) < waypointReachDistance)
        {
            raceManager.OnAIPassedCheckpoint(this, raceCheckpointIndex % raceManager.checkpoints.Length);
            raceCheckpointIndex++;
        }
    }

    // ========================
    // Polis takip davranışı
    // ========================
    void PoliceBehavior()
    {
        if (targetTransform == null) return;

        float distToTarget = Vector3.Distance(transform.position, targetTransform.position);

        // Çok yakınsa çarpma manevrası
        if (distToTarget < policeRamDistance)
        {
            NavigateToTarget(targetTransform, policeChaseSpeed);
            // Sert frenleme yapma - çarpmak için
            brakeInput = false;
        }
        else
        {
            NavigateToTarget(targetTransform, policeChaseSpeed);
        }
    }

    // ========================
    // Hedefe navigasyon (ana AI mantığı)
    // ========================
    void NavigateToTarget(Transform target, float targetSpeed)
    {
        if (target == null) return;

        // Hedefe yön vektörü
        Vector3 dirToTarget = (target.position - transform.position).normalized;
        float steerAngleDeg = Vector3.SignedAngle(transform.forward, dirToTarget, Vector3.up);

        // Direksiyon - açıya göre
        steerInput = Mathf.Clamp(steerAngleDeg / steerAngle, -1f, 1f);

        // Motor - hedef hıza göre
        float speedDiff = targetSpeed - (rb.linearVelocity.magnitude * 3.6f);
        motorInput = Mathf.Clamp(speedDiff / 20f, -1f, 1f);

        // Keskin virajlarda fren
        if (Mathf.Abs(steerAngleDeg) > 35f)
        {
            motorInput *= 0.5f;
            brakeInput = Mathf.Abs(steerAngleDeg) > 60f;
        }
        else
        {
            brakeInput = false;
        }

        // Önündeki engeli kontrol et
        DetectAndAvoidObstacles();
    }

    // ========================
    // Engel kaçınma (Raycast)
    // ========================
    void DetectAndAvoidObstacles()
    {
        Vector3 frontRay = transform.position + Vector3.up * 0.5f;

        // Merkez ray
        if (Physics.Raycast(frontRay, transform.forward, avoidanceDistance, obstacleLayer))
        {
            // Sol ray
            bool leftBlocked = Physics.Raycast(frontRay, transform.forward - transform.right * 0.5f,
                                                avoidanceDistance * 0.7f, obstacleLayer);
            // Sağ ray
            bool rightBlocked = Physics.Raycast(frontRay, transform.forward + transform.right * 0.5f,
                                                 avoidanceDistance * 0.7f, obstacleLayer);

            if (!rightBlocked)
                steerInput = Mathf.Lerp(steerInput, 1f, 0.3f);
            else if (!leftBlocked)
                steerInput = Mathf.Lerp(steerInput, -1f, 0.3f);
            else
            {
                // Her iki taraf da bloke - frenleme
                brakeInput = true;
                motorInput = 0f;
            }

            avoidanceTimer = 0.5f;
        }
    }

    // ========================
    // Motor ve direksiyon uygula
    // ========================
    void ApplyMotorAndSteering()
    {
        float torque = motorInput * acceleration;

        if (rearLeftWheel != null) rearLeftWheel.motorTorque = torque;
        if (rearRightWheel != null) rearRightWheel.motorTorque = torque;

        float targetSteer = steerInput * steerAngle;
        if (frontLeftWheel != null)
            frontLeftWheel.steerAngle = Mathf.Lerp(frontLeftWheel.steerAngle, targetSteer, Time.fixedDeltaTime * 5f);
        if (frontRightWheel != null)
            frontRightWheel.steerAngle = Mathf.Lerp(frontRightWheel.steerAngle, targetSteer, Time.fixedDeltaTime * 5f);

        float brake = brakeInput ? brakeForce : 0f;
        if (frontLeftWheel != null) frontLeftWheel.brakeTorque = brake;
        if (frontRightWheel != null) frontRightWheel.brakeTorque = brake;
        if (rearLeftWheel != null) rearLeftWheel.brakeTorque = brake;
        if (rearRightWheel != null) rearRightWheel.brakeTorque = brake;
    }

    void BrakeFully()
    {
        motorInput = 0f;
        float b = brakeForce * 2f;
        if (frontLeftWheel != null) frontLeftWheel.brakeTorque = b;
        if (frontRightWheel != null) frontRightWheel.brakeTorque = b;
        if (rearLeftWheel != null) rearLeftWheel.brakeTorque = b;
        if (rearRightWheel != null) rearRightWheel.brakeTorque = b;
    }

    void LimitSpeed()
    {
        float limit = currentMode == AIMode.Police ? policeChaseSpeed : maxSpeed + speedVariation;
        if (rb.linearVelocity.magnitude > limit / 3.6f)
        {
            rb.linearVelocity = rb.linearVelocity.normalized * (limit / 3.6f);
        }
        currentSpeed = rb.linearVelocity.magnitude * 3.6f;
    }

    // ========================
    // Tekerlek görsel güncellleme
    // ========================
    void UpdateWheelVisuals()
    {
        UpdateWheel(frontLeftWheel, frontLeftTransform);
        UpdateWheel(frontRightWheel, frontRightTransform);
        UpdateWheel(rearLeftWheel, rearLeftTransform);
        UpdateWheel(rearRightWheel, rearRightTransform);
    }

    void UpdateWheel(WheelCollider col, Transform t)
    {
        if (col == null || t == null) return;
        col.GetWorldPose(out Vector3 pos, out Quaternion rot);
        t.SetPositionAndRotation(pos, rot);
    }

    // ========================
    // Mod değiştirme (dışarıdan)
    // ========================
    public void StartRacing()
    {
        currentMode = AIMode.Racing;
        raceCheckpointIndex = 0;
        maxSpeed = 90f + Random.Range(-10f, 20f); // Her AI farklı hızda
    }

    public void StopRacing()
    {
        currentMode = AIMode.Stopped;
        StartCoroutine(ReturnToPatrolDelayed(3f));
    }

    public void StartPoliceChase(Transform target)
    {
        currentMode = AIMode.Police;
        targetTransform = target;
        isPolice = true;
    }

    public void StopPoliceChase()
    {
        currentMode = AIMode.Patrol;
        targetTransform = null;
    }

    public void ReturnToPatrol()
    {
        currentMode = AIMode.Patrol;
        targetTransform = null;
    }

    IEnumerator ReturnToPatrolDelayed(float delay)
    {
        yield return new WaitForSeconds(delay);
        ReturnToPatrol();
    }

    // ========================
    // Waypoint ayarla
    // ========================
    public void SetWaypoints(Transform[] newWaypoints)
    {
        waypoints = newWaypoints;
        currentWaypointIndex = 0;
    }

    public float GetCurrentSpeed() => currentSpeed;
    public AIMode GetMode() => currentMode;
}
