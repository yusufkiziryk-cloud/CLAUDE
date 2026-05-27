using UnityEngine;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Street City: Open World Mobile
/// AudioManager - Ses yönetim sistemi
/// Motor sesi, SFX, müzik ve ses havuzu
/// </summary>
public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance { get; private set; }

    // ---- Ses Klipleri ----
    [System.Serializable]
    public class SoundClip
    {
        public string name;
        public AudioClip clip;
        [Range(0f, 1f)] public float volume = 1f;
        [Range(0.8f, 1.2f)] public float pitch = 1f;
        public bool loop = false;
    }

    [Header("SFX Listesi")]
    public SoundClip[] sfxClips;

    [Header("Müzik Listesi")]
    public SoundClip[] musicTracks;

    [Header("Motor Sesi")]
    public AudioClip engineIdleClip;      // Boşta motor sesi
    public AudioClip engineRevClip;       // Gaz motor sesi
    [Range(0f, 1f)] public float engineVolume = 0.7f;
    public float enginePitchMin = 0.8f;
    public float enginePitchMax = 2.2f;

    [Header("Genel Ses Ayarları")]
    [Range(0f, 1f)] public float masterVolume = 1f;
    [Range(0f, 1f)] public float sfxVolume = 0.8f;
    [Range(0f, 1f)] public float musicVolume = 0.5f;
    public bool sfxEnabled = true;
    public bool musicEnabled = true;

    // ---- Private değişkenler ----
    private AudioSource musicSource;
    private AudioSource engineSource;
    private Dictionary<string, AudioSource> loopingSFX = new Dictionary<string, AudioSource>();
    private List<AudioSource> sfxPool = new List<AudioSource>();
    private const int POOL_SIZE = 10;

    private bool engineRunning = false;
    private float targetEnginePitch = 1f;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
            return;
        }

        InitializeAudioSources();
        LoadVolumeSettings();
    }

    void Start()
    {
        PlayMenuMusic();
    }

    void Update()
    {
        UpdateEngineSound();
    }

    // ========================
    // Audio source başlatma
    // ========================
    void InitializeAudioSources()
    {
        // Müzik kaynağı
        musicSource = gameObject.AddComponent<AudioSource>();
        musicSource.loop = true;
        musicSource.playOnAwake = false;

        // Motor sesi kaynağı
        engineSource = gameObject.AddComponent<AudioSource>();
        engineSource.loop = true;
        engineSource.playOnAwake = false;
        engineSource.spatialBlend = 0f; // 2D ses

        // SFX Pool oluştur
        for (int i = 0; i < POOL_SIZE; i++)
        {
            AudioSource src = gameObject.AddComponent<AudioSource>();
            src.playOnAwake = false;
            src.spatialBlend = 0f;
            sfxPool.Add(src);
        }
    }

    // ========================
    // SFX çal
    // ========================
    public void PlaySFX(string name)
    {
        if (!sfxEnabled) return;

        SoundClip sound = FindSound(name, sfxClips);
        if (sound == null || sound.clip == null)
        {
            Debug.LogWarning($"[Audio] SFX bulunamadı: {name}");
            return;
        }

        AudioSource source = GetAvailableSFXSource();
        if (source == null) return;

        source.clip = sound.clip;
        source.volume = sound.volume * sfxVolume * masterVolume;
        source.pitch = sound.pitch + Random.Range(-0.05f, 0.05f); // Hafif varyasyon
        source.loop = false;
        source.Play();
    }

    // Döngülü SFX
    public void PlayLoopSFX(string name)
    {
        if (!sfxEnabled) return;
        if (loopingSFX.ContainsKey(name)) return; // Zaten çalıyor

        SoundClip sound = FindSound(name, sfxClips);
        if (sound == null || sound.clip == null) return;

        AudioSource source = gameObject.AddComponent<AudioSource>();
        source.clip = sound.clip;
        source.volume = sound.volume * sfxVolume * masterVolume;
        source.pitch = sound.pitch;
        source.loop = true;
        source.Play();
        loopingSFX[name] = source;
    }

    public void StopSFX(string name)
    {
        if (!loopingSFX.ContainsKey(name)) return;

        AudioSource source = loopingSFX[name];
        if (source != null)
        {
            source.Stop();
            Destroy(source);
        }
        loopingSFX.Remove(name);
    }

    // ========================
    // Motor sesi
    // ========================
    public void PlayEngineSound(bool start)
    {
        engineRunning = start;

        if (start)
        {
            if (engineIdleClip != null)
            {
                engineSource.clip = engineIdleClip;
                engineSource.volume = engineVolume * masterVolume;
                engineSource.Play();
            }
        }
        else
        {
            StartCoroutine(FadeOutEngine());
        }
    }

    void UpdateEngineSound()
    {
        if (!engineRunning || engineSource == null) return;

        // Motor pitch'ini araç hızına göre ayarla
        var playerCar = GameManager.Instance?.GetPlayerCar();
        if (playerCar != null)
        {
            float speedRatio = Mathf.Clamp01(playerCar.SpeedKMH / playerCar.maxSpeed);
            targetEnginePitch = Mathf.Lerp(enginePitchMin, enginePitchMax, speedRatio);
            engineSource.pitch = Mathf.Lerp(engineSource.pitch, targetEnginePitch, Time.deltaTime * 3f);

            // Nitro sesini güncelle
            if (playerCar.IsNitroActive)
                engineSource.volume = engineVolume * 1.3f * masterVolume;
            else
                engineSource.volume = engineVolume * masterVolume;
        }
    }

    IEnumerator FadeOutEngine()
    {
        float startVol = engineSource.volume;
        float t = 0f;
        while (t < 1f)
        {
            t += Time.deltaTime * 2f;
            engineSource.volume = Mathf.Lerp(startVol, 0f, t);
            yield return null;
        }
        engineSource.Stop();
    }

    // ========================
    // Müzik
    // ========================
    public void PlayMenuMusic()
    {
        if (!musicEnabled) return;
        PlayMusic("menu_music");
    }

    public void PlayGameMusic()
    {
        if (!musicEnabled) return;
        PlayMusic("game_music");
    }

    public void PlayRaceMusic()
    {
        if (!musicEnabled) return;
        PlayMusic("race_music");
    }

    void PlayMusic(string name)
    {
        SoundClip track = FindSound(name, musicTracks);
        if (track == null || track.clip == null) return;

        if (musicSource.clip == track.clip) return; // Zaten çalıyor

        StartCoroutine(CrossfadeMusic(track));
    }

    IEnumerator CrossfadeMusic(SoundClip newTrack)
    {
        // Mevcut müziği fade out
        float startVol = musicSource.volume;
        float t = 0f;
        while (t < 1f && musicSource.isPlaying)
        {
            t += Time.deltaTime * 3f;
            musicSource.volume = Mathf.Lerp(startVol, 0f, t);
            yield return null;
        }

        // Yeni müziği başlat
        musicSource.clip = newTrack.clip;
        musicSource.volume = 0f;
        musicSource.Play();

        // Fade in
        t = 0f;
        float targetVol = newTrack.volume * musicVolume * masterVolume;
        while (t < 1f)
        {
            t += Time.deltaTime * 2f;
            musicSource.volume = Mathf.Lerp(0f, targetVol, t);
            yield return null;
        }
    }

    public void StopMusic()
    {
        StartCoroutine(FadeOutMusic());
    }

    IEnumerator FadeOutMusic()
    {
        float startVol = musicSource.volume;
        float t = 0f;
        while (t < 1f)
        {
            t += Time.deltaTime * 2f;
            musicSource.volume = Mathf.Lerp(startVol, 0f, t);
            yield return null;
        }
        musicSource.Stop();
    }

    // ========================
    // Ses ayarları
    // ========================
    public void SetMasterVolume(float vol)
    {
        masterVolume = vol;
        ApplyVolumeSettings();
        SaveVolumeSettings();
    }

    public void SetSFXEnabled(bool enabled)
    {
        sfxEnabled = enabled;
        SaveVolumeSettings();
    }

    public void SetMusicEnabled(bool enabled)
    {
        musicEnabled = enabled;
        if (!enabled) StopMusic();
        else PlayGameMusic();
        SaveVolumeSettings();
    }

    void ApplyVolumeSettings()
    {
        if (musicSource != null)
            musicSource.volume = musicVolume * masterVolume;
        if (engineSource != null)
            engineSource.volume = engineVolume * masterVolume;
    }

    void SaveVolumeSettings()
    {
        PlayerPrefs.SetFloat("MasterVolume", masterVolume);
        PlayerPrefs.SetInt("SFXEnabled", sfxEnabled ? 1 : 0);
        PlayerPrefs.SetInt("MusicEnabled", musicEnabled ? 1 : 0);
        PlayerPrefs.Save();
    }

    void LoadVolumeSettings()
    {
        masterVolume = PlayerPrefs.GetFloat("MasterVolume", 1f);
        sfxEnabled = PlayerPrefs.GetInt("SFXEnabled", 1) == 1;
        musicEnabled = PlayerPrefs.GetInt("MusicEnabled", 1) == 1;
    }

    // ========================
    // Yardımcı fonksiyonlar
    // ========================
    SoundClip FindSound(string name, SoundClip[] clips)
    {
        if (clips == null) return null;
        foreach (var clip in clips)
        {
            if (clip.name == name) return clip;
        }
        return null;
    }

    AudioSource GetAvailableSFXSource()
    {
        foreach (var src in sfxPool)
        {
            if (src != null && !src.isPlaying)
                return src;
        }
        // Tüm kaynaklar doluysa en eskisini kullan
        return sfxPool.Count > 0 ? sfxPool[0] : null;
    }
}
