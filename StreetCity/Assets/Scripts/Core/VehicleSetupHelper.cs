using UnityEngine;

/// <summary>
/// Street City: Open World Mobile
/// VehicleSetupHelper - Editor'da araç prefab kurulum yardımcısı
/// Bu script Unity Editor'da çalıştırılarak araç prefablarını otomatik kurar
/// </summary>
#if UNITY_EDITOR
using UnityEditor;

[ExecuteInEditMode]
public class VehicleSetupHelper : MonoBehaviour
{
    [Header("Araç Yapılandırması")]
    public string vehicleName = "My Car";
    public Color vehicleColor = Color.red;
    public float vehicleLength = 4.5f;
    public float vehicleWidth = 2.0f;
    public float vehicleHeight = 1.4f;
    public float wheelRadius = 0.35f;
    public float wheelWidth = 0.25f;

    [Header("PlayerCarController Ayarları")]
    public float maxSpeed = 120f;
    public float acceleration = 1500f;
    public float brakeForce = 3000f;
    public float steerAngle = 30f;

    [ContextMenu("Auto Setup Vehicle")]
    public void AutoSetupVehicle()
    {
        // Rigidbody
        Rigidbody rb = GetComponent<Rigidbody>();
        if (rb == null) rb = gameObject.AddComponent<Rigidbody>();
        rb.mass = 1200f;
        rb.linearDamping = 0.05f;
        rb.angularDamping = 0.1f;
        rb.interpolation = RigidbodyInterpolation.Interpolate;
        rb.centerOfMass = new Vector3(0, -0.5f, 0);

        // Box Collider (araç gövdesi)
        BoxCollider bodyCollider = GetComponent<BoxCollider>();
        if (bodyCollider == null) bodyCollider = gameObject.AddComponent<BoxCollider>();
        bodyCollider.size = new Vector3(vehicleWidth, vehicleHeight * 0.7f, vehicleLength);
        bodyCollider.center = new Vector3(0, vehicleHeight * 0.2f, 0);

        // PlayerCarController
        PlayerCarController controller = GetComponent<PlayerCarController>();
        if (controller == null) controller = gameObject.AddComponent<PlayerCarController>();
        controller.vehicleName = vehicleName;
        controller.maxSpeed = maxSpeed;
        controller.acceleration = acceleration;
        controller.brakeForce = brakeForce;
        controller.steerAngle = steerAngle;

        // WheelCollider'ları kur
        SetupWheelColliders(controller);

        // Araç gövdesi mesh
        SetupCarBodyMesh();

        // Tag ata
        gameObject.tag = "PlayerCar";
        gameObject.layer = LayerMask.NameToLayer("Vehicle");

        Debug.Log($"[VehicleSetup] {vehicleName} kurulumu tamamlandı!");
        EditorUtility.SetDirty(gameObject);
    }

    void SetupWheelColliders(PlayerCarController controller)
    {
        float halfLength = vehicleLength * 0.35f;
        float halfWidth = vehicleWidth * 0.55f;
        float wheelY = wheelRadius - vehicleHeight * 0.3f;

        // Tekerlek pozisyonları
        Vector3[] wheelPositions = {
            new Vector3(-halfWidth, wheelY, halfLength),   // FL
            new Vector3(halfWidth, wheelY, halfLength),    // FR
            new Vector3(-halfWidth, wheelY, -halfLength),  // RL
            new Vector3(halfWidth, wheelY, -halfLength)    // RR
        };
        string[] wheelNames = { "Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR" };

        WheelCollider[] colliders = new WheelCollider[4];
        Transform[] meshTransforms = new Transform[4];

        for (int i = 0; i < 4; i++)
        {
            // Tekerlek parent objesi
            GameObject wheelGO = new GameObject(wheelNames[i] + "_Collider");
            wheelGO.transform.SetParent(transform);
            wheelGO.transform.localPosition = wheelPositions[i];

            // WheelCollider ekle
            WheelCollider wc = wheelGO.AddComponent<WheelCollider>();
            wc.radius = wheelRadius;
            wc.mass = 20f;
            wc.wheelDampingRate = 0.25f;
            wc.suspensionDistance = 0.15f;
            wc.forceAppPointDistance = 0f;

            JointSpring suspension = wc.suspensionSpring;
            suspension.spring = 35000f;
            suspension.damper = 4500f;
            suspension.targetPosition = 0.5f;
            wc.suspensionSpring = suspension;

            SetWheelFriction(wc);
            colliders[i] = wc;

            // Tekerlek mesh (görsel)
            GameObject wheelMeshGO = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            wheelMeshGO.name = wheelNames[i] + "_Mesh";
            wheelMeshGO.transform.SetParent(transform);
            wheelMeshGO.transform.localPosition = wheelPositions[i];
            wheelMeshGO.transform.localRotation = Quaternion.Euler(0, 0, 90f);
            wheelMeshGO.transform.localScale = new Vector3(wheelWidth, wheelRadius, wheelRadius);
            Destroy(wheelMeshGO.GetComponent<CapsuleCollider>()); // Collider'ı kaldır
            meshTransforms[i] = wheelMeshGO.transform;
        }

        // Controller'a ata
        controller.frontLeftWheel = colliders[0];
        controller.frontRightWheel = colliders[1];
        controller.rearLeftWheel = colliders[2];
        controller.rearRightWheel = colliders[3];

        controller.frontLeftTransform = meshTransforms[0];
        controller.frontRightTransform = meshTransforms[1];
        controller.rearLeftTransform = meshTransforms[2];
        controller.rearRightTransform = meshTransforms[3];
    }

    void SetWheelFriction(WheelCollider wc)
    {
        WheelFrictionCurve fwdFriction = wc.forwardFriction;
        fwdFriction.extremumSlip = 0.4f;
        fwdFriction.extremumValue = 1f;
        fwdFriction.asymptoteSlip = 0.8f;
        fwdFriction.asymptoteValue = 0.5f;
        fwdFriction.stiffness = 1.5f;
        wc.forwardFriction = fwdFriction;

        WheelFrictionCurve sideFriction = wc.sidewaysFriction;
        sideFriction.extremumSlip = 0.2f;
        sideFriction.extremumValue = 1f;
        sideFriction.asymptoteSlip = 0.5f;
        sideFriction.asymptoteValue = 0.75f;
        sideFriction.stiffness = 2f;
        wc.sidewaysFriction = sideFriction;
    }

    void SetupCarBodyMesh()
    {
        // Basit low-poly araba gövdesi (box tabanlı)
        GameObject body = new GameObject("CarBody");
        body.transform.SetParent(transform);
        body.transform.localPosition = new Vector3(0, vehicleHeight * 0.3f, 0);

        // Ana gövde
        GameObject mainBody = GameObject.CreatePrimitive(PrimitiveType.Cube);
        mainBody.name = "Body_Main";
        mainBody.transform.SetParent(body.transform);
        mainBody.transform.localPosition = Vector3.zero;
        mainBody.transform.localScale = new Vector3(vehicleWidth, vehicleHeight * 0.6f, vehicleLength);
        Destroy(mainBody.GetComponent<BoxCollider>());

        // Kabin
        GameObject cabin = GameObject.CreatePrimitive(PrimitiveType.Cube);
        cabin.name = "Body_Cabin";
        cabin.transform.SetParent(body.transform);
        cabin.transform.localPosition = new Vector3(0, vehicleHeight * 0.5f, 0);
        cabin.transform.localScale = new Vector3(vehicleWidth * 0.85f, vehicleHeight * 0.4f, vehicleLength * 0.55f);
        Destroy(cabin.GetComponent<BoxCollider>());

        // Renk uygula
        Material mat = new Material(Shader.Find("Mobile/Diffuse"));
        if (mat != null)
        {
            mat.color = vehicleColor;
            mainBody.GetComponent<MeshRenderer>().material = mat;
            cabin.GetComponent<MeshRenderer>().material = mat;
        }
    }
}
#else
// Runtime'da boş - sadece Editor'da kullanılır
public class VehicleSetupHelper : MonoBehaviour { }
#endif
