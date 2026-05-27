"""
Refleksoloji Bilgi Tabanı / Reflexology Knowledge Base
Ayak, el ve kulak refleks noktaları / Foot, hand, and ear reflex zones
"""

# ─────────────────────────────────────────────────────────────────────────────
# AYAK REFLEKSOLOJİSİ / FOOT REFLEXOLOGY
# ─────────────────────────────────────────────────────────────────────────────

FOOT_ZONES = {
    # ── BAŞ / HEAD ──────────────────────────────────────────────────────────
    "beyin_sol": {
        "tr": "Sol Beyin",
        "en": "Left Brain",
        "location_tr": "Sağ ayak başparmağının üst kısmı",
        "location_en": "Top of right big toe",
        "organ": "Beyin (sol yarım küre) / Brain (left hemisphere)",
        "benefits_tr": [
            "Zihinsel netlik ve konsantrasyon",
            "Analitik düşünce kapasitesi",
            "Konuşma ve dil becerileri",
            "Sağ taraf vücut koordinasyonu",
        ],
        "benefits_en": [
            "Mental clarity and concentration",
            "Analytical thinking capacity",
            "Speech and language skills",
            "Right-side body coordination",
        ],
        "technique_tr": "Başparmağın tepesine küçük yuvarlak baskılar uygulayın; 3-5 dakika sürdürün.",
        "technique_en": "Apply small circular pressures to the tip of the big toe; maintain for 3-5 minutes.",
        "caution_tr": "Baş ağrısı varsa çok güçlü baskıdan kaçının.",
        "caution_en": "Avoid very strong pressure if headache is present.",
        "zone_id": "beyin_sol",
        "foot": "right",
        "grid_row": 1,
        "grid_col": 1,
    },
    "beyin_sag": {
        "tr": "Sağ Beyin",
        "en": "Right Brain",
        "location_tr": "Sol ayak başparmağının üst kısmı",
        "location_en": "Top of left big toe",
        "organ": "Beyin (sağ yarım küre) / Brain (right hemisphere)",
        "benefits_tr": [
            "Yaratıcılık ve sezgi",
            "Sanatsal beceriler",
            "Uzamsal farkındalık",
            "Sol taraf vücut koordinasyonu",
        ],
        "benefits_en": [
            "Creativity and intuition",
            "Artistic skills",
            "Spatial awareness",
            "Left-side body coordination",
        ],
        "technique_tr": "Sol ayak başparmağının tepesine nazik döngüsel baskılar uygulayın.",
        "technique_en": "Apply gentle circular pressures to the tip of the left big toe.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "beyin_sag",
        "foot": "left",
        "grid_row": 1,
        "grid_col": 1,
    },
    "hipofiz": {
        "tr": "Hipofiz Bezi",
        "en": "Pituitary Gland",
        "location_tr": "Her iki ayağın başparmağının ortası",
        "location_en": "Center of both big toes",
        "organ": "Hipofiz Bezi / Pituitary Gland",
        "benefits_tr": [
            "Hormonal denge",
            "Büyüme hormonu düzenlemesi",
            "Tiroid ve adrenal bezlerin uyarılması",
            "Üreme hormonları dengesi",
            "Metabolizmanın dengelenmesi",
        ],
        "benefits_en": [
            "Hormonal balance",
            "Growth hormone regulation",
            "Stimulation of thyroid and adrenal glands",
            "Reproductive hormones balance",
            "Metabolism balancing",
        ],
        "technique_tr": "Başparmağın tam ortasına iğne ucu baskısı uygulayın (baş parmağınızın tırnağıyla veya küçük bir alet kullanarak).",
        "technique_en": "Apply pinpoint pressure to the exact center of the big toe (using your thumbnail or a small tool).",
        "caution_tr": "Hormonal ilaç kullananlar doktor danışmanlığı almalıdır.",
        "caution_en": "Those on hormonal medications should consult a doctor.",
        "zone_id": "hipofiz",
        "foot": "both",
        "grid_row": 1,
        "grid_col": 2,
    },
    "boyun": {
        "tr": "Boyun & Servikal Omurga",
        "en": "Neck & Cervical Spine",
        "location_tr": "Her iki ayağın başparmağının tabanı ve tabanın iç kenarı",
        "location_en": "Base of both big toes and inner edge of the base",
        "organ": "Boyun ve servikal omurga / Neck and cervical spine",
        "benefits_tr": [
            "Boyun gerginliği ve ağrısı",
            "Servikal spondiloz",
            "Baş dönmesi",
            "Omuz ağrısı ile birlikte boyun sorunları",
        ],
        "benefits_en": [
            "Neck tension and pain",
            "Cervical spondylosis",
            "Dizziness",
            "Neck issues associated with shoulder pain",
        ],
        "technique_tr": "Başparmağın tabanında soldan sağa kısa sürüşler ve baskılar uygulayın.",
        "technique_en": "Apply short strokes and pressures from left to right at the base of the big toe.",
        "caution_tr": "Servikal yaralanma geçirenler dikkatli olmalıdır.",
        "caution_en": "Those with cervical injuries should be careful.",
        "zone_id": "boyun",
        "foot": "both",
        "grid_row": 2,
        "grid_col": 2,
    },
    "goz_sag": {
        "tr": "Sağ Göz",
        "en": "Right Eye",
        "location_tr": "Sağ ayak 2. ve 3. parmak tabanı",
        "location_en": "Base of 2nd and 3rd toes on right foot",
        "organ": "Sağ göz / Right eye",
        "benefits_tr": [
            "Göz yorgunluğu",
            "Görüş netliği",
            "Göz tansiyonu",
            "Yaşa bağlı görüş bozuklukları",
        ],
        "benefits_en": [
            "Eye fatigue",
            "Visual clarity",
            "Eye pressure (glaucoma support)",
            "Age-related vision changes",
        ],
        "technique_tr": "2. ve 3. parmakların tabanına küçük dairesel hareketler uygulayın.",
        "technique_en": "Apply small circular movements to the base of the 2nd and 3rd toes.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "goz_sag",
        "foot": "right",
        "grid_row": 1,
        "grid_col": 3,
    },
    "kulak_sag": {
        "tr": "Sağ Kulak",
        "en": "Right Ear",
        "location_tr": "Sağ ayak 4. ve 5. parmak tabanı",
        "location_en": "Base of 4th and 5th toes on right foot",
        "organ": "Sağ kulak / Right ear",
        "benefits_tr": [
            "İşitme sorunları",
            "Kulak çınlaması (tinnitus)",
            "Kulak tıkanıklığı",
            "Orta kulak enfeksiyonları",
        ],
        "benefits_en": [
            "Hearing issues",
            "Tinnitus (ringing in ears)",
            "Ear congestion",
            "Middle ear infections",
        ],
        "technique_tr": "4. ve 5. parmakların tabanına nazik bir baskı uygulayın.",
        "technique_en": "Apply gentle pressure to the base of the 4th and 5th toes.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "kulak_sag",
        "foot": "right",
        "grid_row": 1,
        "grid_col": 4,
    },

    # ── GÖĞÜS / CHEST ───────────────────────────────────────────────────────
    "akciger_sag": {
        "tr": "Sağ Akciğer",
        "en": "Right Lung",
        "location_tr": "Sağ ayağın üst orta bölgesi (top bölgesi)",
        "location_en": "Upper middle area of right foot (ball of foot)",
        "organ": "Sağ Akciğer / Right Lung",
        "benefits_tr": [
            "Solunum kapasitesini artırma",
            "Astım belirtileri",
            "Bronşit",
            "Sigara bırakma desteği",
            "Öksürük ve tıkanıklık",
        ],
        "benefits_en": [
            "Improving breathing capacity",
            "Asthma symptoms",
            "Bronchitis",
            "Smoking cessation support",
            "Cough and congestion",
        ],
        "technique_tr": "Ayak topuğundan parmaklara doğru sürme hareketi uygulayın. Soluk alırken baskı, soluk verirken serbest bırakın.",
        "technique_en": "Apply sweeping movement from heel to toes. Press during inhale, release during exhale.",
        "caution_tr": "Akut solunum enfeksiyonunda bölge hassas olabilir.",
        "caution_en": "Area may be sensitive during acute respiratory infections.",
        "zone_id": "akciger_sag",
        "foot": "right",
        "grid_row": 3,
        "grid_col": 2,
    },
    "kalp": {
        "tr": "Kalp",
        "en": "Heart",
        "location_tr": "Sol ayak orta üst bölgesi (top kısmı)",
        "location_en": "Middle upper area of left foot (ball of foot)",
        "organ": "Kalp / Heart",
        "benefits_tr": [
            "Dolaşım iyileştirme",
            "Kan basıncı dengeleme",
            "Kalp ritim düzenleme",
            "Stres kaynaklı kalp çarpıntısı",
        ],
        "benefits_en": [
            "Circulation improvement",
            "Blood pressure balancing",
            "Heart rhythm regulation",
            "Stress-related palpitations",
        ],
        "technique_tr": "Sol ayak topunun iç kısmına çok nazik, yavaş dairesel baskılar uygulayın.",
        "technique_en": "Apply very gentle, slow circular pressures to the inner ball of the left foot.",
        "caution_tr": "Kalp hastalığı olanlarda hafif dokunuşla sınırlı tutun. Akut kalp sorunlarında uygulamayın.",
        "caution_en": "Limit to light touch for those with heart disease. Do not apply during acute cardiac issues.",
        "zone_id": "kalp",
        "foot": "left",
        "grid_row": 3,
        "grid_col": 2,
    },

    # ── KARIN / ABDOMEN ─────────────────────────────────────────────────────
    "mide": {
        "tr": "Mide",
        "en": "Stomach",
        "location_tr": "Her iki ayağın iç kenarı, orta bölge",
        "location_en": "Inner edge of both feet, middle section",
        "organ": "Mide / Stomach",
        "benefits_tr": [
            "Sindirim sorunları",
            "Mide bulantısı",
            "Hazımsızlık",
            "Asit reflü",
            "Mide şişkinliği",
        ],
        "benefits_en": [
            "Digestive problems",
            "Nausea",
            "Indigestion",
            "Acid reflux",
            "Stomach bloating",
        ],
        "technique_tr": "Ayağın iç kenarında küçük daireler çizerek ilerleyin. Saat yönünde hareketler sindirimi destekler.",
        "technique_en": "Progress with small circles on the inner edge of the foot. Clockwise movements support digestion.",
        "caution_tr": "Yemekten hemen sonra uygulamayın.",
        "caution_en": "Do not apply immediately after meals.",
        "zone_id": "mide",
        "foot": "both",
        "grid_row": 5,
        "grid_col": 1,
    },
    "karaciger": {
        "tr": "Karaciğer",
        "en": "Liver",
        "location_tr": "Sağ ayağın orta dış bölgesi",
        "location_en": "Middle outer area of right foot",
        "organ": "Karaciğer / Liver",
        "benefits_tr": [
            "Detoksifikasyon desteği",
            "Yorgunluk ve letarji",
            "Sindirimi destekleme",
            "Alerjik reaksiyonlar",
            "Cilt sorunları (karaciğer kaynaklı)",
        ],
        "benefits_en": [
            "Detoxification support",
            "Fatigue and lethargy",
            "Supporting digestion",
            "Allergic reactions",
            "Skin issues (liver-related)",
        ],
        "technique_tr": "Sağ ayağın orta bölgesinde kısa, hızlı sürme hareketleri uygulayın.",
        "technique_en": "Apply short, brisk sweeping movements in the middle area of the right foot.",
        "caution_tr": "Hepatit veya karaciğer hastalığında doktora danışın.",
        "caution_en": "Consult doctor in cases of hepatitis or liver disease.",
        "zone_id": "karaciger",
        "foot": "right",
        "grid_row": 5,
        "grid_col": 3,
    },
    "bobrek_sag": {
        "tr": "Sağ Böbrek",
        "en": "Right Kidney",
        "location_tr": "Sağ ayağın ortası, merkez bölge",
        "location_en": "Center of right foot, middle zone",
        "organ": "Sağ Böbrek / Right Kidney",
        "benefits_tr": [
            "Böbrek fonksiyonunu destekleme",
            "İdrar yolu sağlığı",
            "Vücuttan toksin atılımı",
            "Ödem azaltma",
            "Tansiyona katkı",
        ],
        "benefits_en": [
            "Supporting kidney function",
            "Urinary tract health",
            "Toxin elimination from body",
            "Reducing edema",
            "Contributing to blood pressure",
        ],
        "technique_tr": "Ayağın ortasına derin, sabit bir baskı uygulayın ve yavaşça serbest bırakın.",
        "technique_en": "Apply deep, steady pressure to the center of the foot and release slowly.",
        "caution_tr": "Böbrek taşı atağında veya akut böbrek hastalığında uygulamayın.",
        "caution_en": "Do not apply during kidney stone attack or acute kidney disease.",
        "zone_id": "bobrek_sag",
        "foot": "right",
        "grid_row": 5,
        "grid_col": 2,
    },

    # ── BEL / LOWER BODY ────────────────────────────────────────────────────
    "bel_omurga": {
        "tr": "Bel (Lomber Omurga)",
        "en": "Lower Back (Lumbar Spine)",
        "location_tr": "Her iki ayağın iç kenarının alt yarısı",
        "location_en": "Lower half of inner edge of both feet",
        "organ": "Bel ve lomber omurga / Lower back and lumbar spine",
        "benefits_tr": [
            "Bel ağrısı",
            "Bel fıtığı semptomları",
            "Siyatik sinir ağrısı",
            "Kas tutulması",
        ],
        "benefits_en": [
            "Lower back pain",
            "Herniated disc symptoms",
            "Sciatic nerve pain",
            "Muscle tension",
        ],
        "technique_tr": "Ayağın iç kenarı boyunca topuktan orta noktaya doğru kısa baskılı sürüşler uygulayın.",
        "technique_en": "Apply short pressured strokes from heel to midpoint along the inner edge of the foot.",
        "caution_tr": "Akut bel fıtığında hafif dokunuşla sınırlı tutun.",
        "caution_en": "Limit to light touch in acute herniated disc.",
        "zone_id": "bel_omurga",
        "foot": "both",
        "grid_row": 7,
        "grid_col": 1,
    },
    "sikatik_sinir": {
        "tr": "Siyatik Sinir",
        "en": "Sciatic Nerve",
        "location_tr": "Her iki ayağın topuk üstü iç bölgesi",
        "location_en": "Inner heel area of both feet",
        "organ": "Siyatik sinir / Sciatic nerve",
        "benefits_tr": [
            "Siyatik sinir ağrısı",
            "Bacak uyuşması",
            "Bel-bacak yayılan ağrı",
        ],
        "benefits_en": [
            "Sciatic nerve pain",
            "Leg numbness",
            "Radiating lower back-leg pain",
        ],
        "technique_tr": "Topuğun iç üst kısmına derin noktasal baskı uygulayın.",
        "technique_en": "Apply deep point pressure to the inner upper part of the heel.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "sikatik_sinir",
        "foot": "both",
        "grid_row": 8,
        "grid_col": 1,
    },

    # ── ÜROGENITAL / UROGENITAL ─────────────────────────────────────────────
    "uterus_over": {
        "tr": "Uterus & Yumurtalık",
        "en": "Uterus & Ovaries",
        "location_tr": "Her iki ayağın topuk iç ve dış kenarı",
        "location_en": "Inner and outer heel edges of both feet",
        "organ": "Uterus ve yumurtalıklar / Uterus and ovaries",
        "benefits_tr": [
            "Adet düzensizlikleri",
            "Premenstrüel sendrom (PMS)",
            "Menopoz semptomları",
            "Fertilite desteği",
        ],
        "benefits_en": [
            "Menstrual irregularities",
            "Premenstrual syndrome (PMS)",
            "Menopause symptoms",
            "Fertility support",
        ],
        "technique_tr": "Topuğun iç kenarına (uterus) ve dış kenarına (yumurtalıklar) yavaş dairesel baskılar uygulayın.",
        "technique_en": "Apply slow circular pressures to the inner (uterus) and outer (ovaries) edges of the heel.",
        "caution_tr": "Hamilelik süresince uygulamayın.",
        "caution_en": "Do not apply during pregnancy.",
        "zone_id": "uterus_over",
        "foot": "both",
        "grid_row": 9,
        "grid_col": 1,
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# EL REFLEKSOLOJİSİ / HAND REFLEXOLOGY
# ─────────────────────────────────────────────────────────────────────────────

HAND_ZONES = {
    "beyin_el": {
        "tr": "Beyin (El)",
        "en": "Brain (Hand)",
        "location_tr": "Her iki elin baş parmak ucu",
        "location_en": "Tip of both thumbs",
        "organ": "Beyin / Brain",
        "benefits_tr": ["Baş ağrısı", "Zihinsel yorgunluk", "Konsantrasyon", "Hafıza"],
        "benefits_en": ["Headache", "Mental fatigue", "Concentration", "Memory"],
        "technique_tr": "Baş parmağın ucuna küçük döngüsel baskılar uygulayın.",
        "technique_en": "Apply small circular pressures to the tip of the thumb.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "beyin_el",
        "hand": "both",
    },
    "omurga_el": {
        "tr": "Omurga (El)",
        "en": "Spine (Hand)",
        "location_tr": "Her iki elin iç kenarı (baş parmak tarafı)",
        "location_en": "Inner edge of both hands (thumb side)",
        "organ": "Omurga / Spine",
        "benefits_tr": ["Sırt ağrısı", "Postür sorunları", "Boyun gerginliği", "Bel ağrısı"],
        "benefits_en": ["Back pain", "Posture problems", "Neck tension", "Lower back pain"],
        "technique_tr": "El iç kenarı boyunca baş parmağın tabanından bileğe doğru sürme hareketi.",
        "technique_en": "Sweeping movement from thumb base to wrist along the inner edge of the hand.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "omurga_el",
        "hand": "both",
    },
    "kalp_el": {
        "tr": "Kalp (El)",
        "en": "Heart (Hand)",
        "location_tr": "Sol elin orta avuç içi",
        "location_en": "Middle of left palm",
        "organ": "Kalp / Heart",
        "benefits_tr": ["Dolaşım", "Kalp çarpıntısı", "Stres azaltma"],
        "benefits_en": ["Circulation", "Palpitations", "Stress reduction"],
        "technique_tr": "Sol avuç içinin ortasına nazik dairesel baskılar uygulayın.",
        "technique_en": "Apply gentle circular pressures to the center of the left palm.",
        "caution_tr": "Kalp hastalığında çok hafif dokunuşla sınırlı tutun.",
        "caution_en": "Limit to very light touch for heart disease.",
        "zone_id": "kalp_el",
        "hand": "left",
    },
    "bos_noktalar_el": {
        "tr": "El Bilek Solosal Noktası",
        "en": "Solar Plexus Hand Point",
        "location_tr": "Her iki elin avuç içi merkezi",
        "location_en": "Center of both palms",
        "organ": "Solar Pleksus / Solar Plexus",
        "benefits_tr": ["Genel stres", "Kaygı bozukluğu", "Nefes düzenleme", "Sindirim desteği"],
        "benefits_en": ["General stress", "Anxiety", "Breathing regulation", "Digestive support"],
        "technique_tr": "Her iki avuç içinin ortasına güçlü, derin bir noktasal baskı uygulayın ve 30 saniye tutun.",
        "technique_en": "Apply strong, deep point pressure to the center of both palms and hold for 30 seconds.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "bos_noktalar_el",
        "hand": "both",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# KULAK REFLEKSOLOJİSİ (AURİKULOTERAPİ) / EAR REFLEXOLOGY (AURICULOTHERAPY)
# ─────────────────────────────────────────────────────────────────────────────

EAR_ZONES = {
    "shen_men": {
        "tr": "Shen Men (Tanrı Kapısı)",
        "en": "Shen Men (Gate of God)",
        "location_tr": "Kulak üçgeninin üst kısmı (triangular fossa)",
        "location_en": "Upper part of triangular fossa",
        "organ": "Sinir sistemi / Nervous system",
        "benefits_tr": [
            "Derin rahatlama",
            "Anksiyete ve stres azaltma",
            "Ağrı yönetimi",
            "Uyku kalitesi",
            "Bağımlılık desteği",
        ],
        "benefits_en": [
            "Deep relaxation",
            "Anxiety and stress reduction",
            "Pain management",
            "Sleep quality",
            "Addiction support",
        ],
        "technique_tr": "Nazikçe bastırın ve 1-2 dakika hafif döngüsel hareketler uygulayın. Bu nokta auriculotherapy'nin en önemli noktasıdır.",
        "technique_en": "Gently press and apply light circular movements for 1-2 minutes. This is the most important point in auriculotherapy.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "shen_men",
        "ear": "both",
    },
    "kulak_omurga": {
        "tr": "Omurga (Kulak)",
        "en": "Spine (Ear)",
        "location_tr": "Anti-helix boyunca dikey bir şerit",
        "location_en": "Vertical strip along the anti-helix",
        "organ": "Tüm omurga / Entire spine",
        "benefits_tr": [
            "Boyun ağrısı",
            "Sırt ağrısı",
            "Bel ağrısı",
            "Omurga gerginliği",
        ],
        "benefits_en": [
            "Neck pain",
            "Back pain",
            "Lower back pain",
            "Spinal tension",
        ],
        "technique_tr": "Anti-helix boyunca yukarıdan aşağıya nazik sürme hareketleri uygulayın.",
        "technique_en": "Apply gentle sweeping movements from top to bottom along the anti-helix.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "kulak_omurga",
        "ear": "both",
    },
    "kulak_goz": {
        "tr": "Göz (Kulak)",
        "en": "Eye (Ear)",
        "location_tr": "Kulak memesinin üst bölgesi",
        "location_en": "Upper part of earlobe",
        "organ": "Göz / Eye",
        "benefits_tr": ["Göz yorgunluğu", "Görüş sorunları", "Dijital göz yorgunluğu"],
        "benefits_en": ["Eye fatigue", "Vision problems", "Digital eye strain"],
        "technique_tr": "Kulak memesinin üstüne nazik döngüsel baskılar uygulayın.",
        "technique_en": "Apply gentle circular pressures to the upper earlobe.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "kulak_goz",
        "ear": "both",
    },
    "kulak_mide": {
        "tr": "Mide (Kulak)",
        "en": "Stomach (Ear)",
        "location_tr": "Tragus'un arkası (kulak kapakçığının iç yüzü)",
        "location_en": "Behind the tragus (inner face of ear flap)",
        "organ": "Mide / Stomach",
        "benefits_tr": ["İştah düzenleme", "Mide bulantısı", "Sindirim sorunları"],
        "benefits_en": ["Appetite regulation", "Nausea", "Digestive issues"],
        "technique_tr": "Tragus'un arkasına hafif noktasal baskı uygulayın.",
        "technique_en": "Apply light point pressure behind the tragus.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "kulak_mide",
        "ear": "both",
    },
    "noktazero": {
        "tr": "Sıfır Noktası",
        "en": "Zero Point (Master Point)",
        "location_tr": "Kulak kanalı üstünde helix tabanında",
        "location_en": "Above ear canal at base of helix",
        "organ": "Genel denge noktası / General balance point",
        "benefits_tr": [
            "Genel beden dengesi",
            "Homeostazı sağlama",
            "Kronik hastalıklar için destekleyici",
        ],
        "benefits_en": [
            "General body balance",
            "Maintaining homeostasis",
            "Supportive for chronic conditions",
        ],
        "technique_tr": "Derin, sakin bir nefes alırken bu noktaya baskı uygulayın.",
        "technique_en": "Apply pressure to this point while taking a deep, calm breath.",
        "caution_tr": None,
        "caution_en": None,
        "zone_id": "noktazero",
        "ear": "both",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# SEMPTOM → BÖLGE HARİTASI / SYMPTOM → ZONE MAP
# ─────────────────────────────────────────────────────────────────────────────

SYMPTOM_MAP = {
    # ── Baş & Sinir Sistemi / Head & Nervous System ─────────────────────────
    "baş ağrısı": ["beyin_sol", "beyin_sag", "boyun", "beyin_el"],
    "headache": ["beyin_sol", "beyin_sag", "boyun", "beyin_el"],
    "migren": ["hipofiz", "beyin_sol", "beyin_sag"],
    "migraine": ["hipofiz", "beyin_sol", "beyin_sag"],
    "stres": ["shen_men", "bos_noktalar_el", "hipofiz"],
    "stress": ["shen_men", "bos_noktalar_el", "hipofiz"],
    "uykusuzluk": ["shen_men", "hipofiz", "beyin_sag"],
    "insomnia": ["shen_men", "hipofiz", "beyin_sag"],
    "anksiyete": ["shen_men", "bos_noktalar_el"],
    "anxiety": ["shen_men", "bos_noktalar_el"],
    "konsantrasyon": ["beyin_sol", "beyin_sag", "hipofiz"],
    "concentration": ["beyin_sol", "beyin_sag", "hipofiz"],

    # ── Kas & İskelet / Musculoskeletal ─────────────────────────────────────
    "bel ağrısı": ["bel_omurga", "sikatik_sinir", "omurga_el"],
    "lower back pain": ["bel_omurga", "sikatik_sinir", "omurga_el"],
    "boyun ağrısı": ["boyun", "kulak_omurga", "omurga_el"],
    "neck pain": ["boyun", "kulak_omurga", "omurga_el"],
    "siyatik": ["sikatik_sinir", "bel_omurga"],
    "sciatica": ["sikatik_sinir", "bel_omurga"],
    "sırt ağrısı": ["omurga_el", "kulak_omurga"],
    "back pain": ["omurga_el", "kulak_omurga"],

    # ── Sindirim / Digestive ─────────────────────────────────────────────────
    "sindirim": ["mide", "karaciger", "noktazero"],
    "digestion": ["mide", "karaciger", "noktazero"],
    "mide bulantısı": ["mide", "kulak_mide"],
    "nausea": ["mide", "kulak_mide"],
    "hazımsızlık": ["mide", "karaciger"],
    "indigestion": ["mide", "karaciger"],
    "şişkinlik": ["mide", "karaciger"],
    "bloating": ["mide", "karaciger"],

    # ── Solunum / Respiratory ────────────────────────────────────────────────
    "astım": ["akciger_sag"],
    "asthma": ["akciger_sag"],
    "öksürük": ["akciger_sag"],
    "cough": ["akciger_sag"],

    # ── Dolaşım & Kalp / Circulatory & Heart ────────────────────────────────
    "tansiyon": ["bobrek_sag", "kalp", "kalp_el"],
    "blood pressure": ["bobrek_sag", "kalp", "kalp_el"],
    "kalp": ["kalp", "kalp_el"],
    "heart": ["kalp", "kalp_el"],

    # ── Ürogenital / Urogenital ──────────────────────────────────────────────
    "adet": ["uterus_over", "hipofiz"],
    "menstrual": ["uterus_over", "hipofiz"],
    "hormonal": ["hipofiz", "uterus_over"],
    "menopoz": ["hipofiz", "uterus_over"],
    "menopause": ["hipofiz", "uterus_over"],

    # ── Göz / Eye ────────────────────────────────────────────────────────────
    "göz": ["goz_sag", "kulak_goz"],
    "eye": ["goz_sag", "kulak_goz"],

    # ── Kulak / Ear ──────────────────────────────────────────────────────────
    "kulak": ["kulak_sag", "kulak_omurga"],
    "ear": ["kulak_sag", "kulak_omurga"],
    "tinnitus": ["kulak_sag"],
    "çınlama": ["kulak_sag"],

    # ── Genel / General ──────────────────────────────────────────────────────
    "yorgunluk": ["karaciger", "bobrek_sag", "shen_men"],
    "fatigue": ["karaciger", "bobrek_sag", "shen_men"],
    "enerji": ["hipofiz", "karaciger", "noktazero"],
    "energy": ["hipofiz", "karaciger", "noktazero"],
    "bağışıklık": ["hipofiz", "karaciger"],
    "immunity": ["hipofiz", "karaciger"],
    "detoks": ["karaciger", "bobrek_sag"],
    "detox": ["karaciger", "bobrek_sag"],
}

# Tüm bölgeleri birleştir / Combine all zones
ALL_ZONES = {**FOOT_ZONES, **HAND_ZONES, **EAR_ZONES}

# Genel teknikler / General techniques
GENERAL_TECHNIQUES = {
    "tr": {
        "thumb_walking": {
            "name": "Baş Parmak Yürüyüşü",
            "description": (
                "Baş parmağı bükün ve küçük adımlarla, katerpillar gibi ilerleyin. "
                "Her adımda hafif bir baskı uygulayın. Refleksolojinin temel tekniğidir."
            ),
        },
        "finger_walking": {
            "name": "Parmak Yürüyüşü",
            "description": (
                "Baş parmak yerine işaret parmağıyla aynı teknik uygulanır. "
                "Daha hassas bölgeler için kullanılır."
            ),
        },
        "rotation": {
            "name": "Rotasyon/Döndürme Tekniği",
            "description": (
                "Bölgeye baskı uygularken aynı anda küçük daireler çizin. "
                "Gergin bölgeleri rahatlatmak için etkilidir."
            ),
        },
        "pinching": {
            "name": "Sıkıştırma Tekniği",
            "description": (
                "Başparmak ve işaret parmağı arasına alarak nazikçe sıkıştırın. "
                "Kulak ve el refleksolojisinde sık kullanılır."
            ),
        },
        "holding": {
            "name": "Sabit Tutma",
            "description": (
                "Bir noktaya baskı uygulayın ve 30-60 saniye hiç hareket etmeden tutun. "
                "Derin gevşeme sağlar."
            ),
        },
    },
    "en": {
        "thumb_walking": {
            "name": "Thumb Walking",
            "description": (
                "Bend the thumb and advance in small steps like a caterpillar. "
                "Apply slight pressure at each step. This is the fundamental reflexology technique."
            ),
        },
        "finger_walking": {
            "name": "Finger Walking",
            "description": (
                "Same technique applied with the index finger instead of thumb. "
                "Used for more sensitive areas."
            ),
        },
        "rotation": {
            "name": "Rotation Technique",
            "description": (
                "While applying pressure to an area, simultaneously draw small circles. "
                "Effective for relaxing tense areas."
            ),
        },
        "pinching": {
            "name": "Pinching Technique",
            "description": (
                "Hold between thumb and index finger and gently squeeze. "
                "Frequently used in ear and hand reflexology."
            ),
        },
        "holding": {
            "name": "Holding",
            "description": (
                "Apply pressure to a point and hold completely still for 30-60 seconds. "
                "Provides deep relaxation."
            ),
        },
    },
}

# Güvenlik bilgileri / Safety information
SAFETY_INFO = {
    "contraindications_tr": [
        "Gebelik (özellikle uterus, yumurtalık, hipofiz noktaları)",
        "Derin ven trombozu (DVT)",
        "Ayak veya bacakta pıhtılaşma",
        "Akut enfeksiyonlar ve ateş",
        "Açık yaralar, kesikler veya cilt hastalıkları",
        "Kırık kemik bölgeleri",
        "Son 6 ay içinde kalp krizi",
        "Şiddetli osteoporoz",
    ],
    "contraindications_en": [
        "Pregnancy (especially uterus, ovary, pituitary points)",
        "Deep vein thrombosis (DVT)",
        "Blood clots in feet or legs",
        "Acute infections and fever",
        "Open wounds, cuts, or skin diseases",
        "Fractured bone areas",
        "Heart attack within last 6 months",
        "Severe osteoporosis",
    ],
    "disclaimer_tr": (
        "⚠️ Refleksoloji tamamlayıcı bir terapidir ve tıbbi tedavinin yerini alamaz. "
        "Herhangi bir sağlık sorununuz varsa, refleksoloji uygulamadan önce mutlaka doktorunuza danışınız."
    ),
    "disclaimer_en": (
        "⚠️ Reflexology is a complementary therapy and cannot replace medical treatment. "
        "If you have any health condition, please consult your doctor before applying reflexology."
    ),
}
