"""
Reflexology Agent Tool Definitions and Handlers
Refleksoloji Ajan Araç Tanımlamaları ve İşleyicileri
"""

import json
from knowledge import ALL_ZONES, FOOT_ZONES, HAND_ZONES, EAR_ZONES, SYMPTOM_MAP, GENERAL_TECHNIQUES, SAFETY_INFO


# ─── Tool Definitions (JSON Schema format for Anthropic SDK) ──────────────────

TOOL_DEFINITIONS = [
    {
        "name": "lookup_zone",
        "description": (
            "Look up detailed information about a specific reflexology zone by its ID. "
            "Belirli bir refleksoloji bölgesi hakkında kimliğine göre ayrıntılı bilgi getirir. "
            "Returns zone location, corresponding organ/system, health benefits, technique instructions, and cautions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone_id": {
                    "type": "string",
                    "description": (
                        "The zone identifier, e.g. 'beyin_sol', 'kalp', 'bobrek_sag', 'shen_men'. "
                        "Bölge kimliği, örn. 'beyin_sol', 'kalp', 'bobrek_sag', 'shen_men'."
                    )
                },
                "language": {
                    "type": "string",
                    "enum": ["tr", "en"],
                    "description": "Response language: 'tr' for Turkish (default), 'en' for English."
                }
            },
            "required": ["zone_id"]
        }
    },
    {
        "name": "find_zones_by_symptom",
        "description": (
            "Find reflexology zones that may help with a specific symptom or health concern. "
            "Belirli bir semptom veya sağlık sorununa yardımcı olabilecek refleksoloji bölgelerini bulur. "
            "Accepts symptom keywords in Turkish or English."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symptom": {
                    "type": "string",
                    "description": (
                        "Symptom or health concern keyword in Turkish or English. "
                        "Examples: 'baş ağrısı', 'headache', 'stres', 'stress', 'bel ağrısı', 'back pain', "
                        "'sindirim', 'digestion', 'yorgunluk', 'fatigue'."
                    )
                },
                "language": {
                    "type": "string",
                    "enum": ["tr", "en"],
                    "description": "Response language: 'tr' for Turkish (default), 'en' for English."
                }
            },
            "required": ["symptom"]
        }
    },
    {
        "name": "get_technique_guide",
        "description": (
            "Get detailed instructions for a specific reflexology massage technique. "
            "Belirli bir refleksoloji masaj tekniği için ayrıntılı talimatlar getirir. "
            "Techniques: thumb_walking, finger_walking, rotation, pinching, holding."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "technique_name": {
                    "type": "string",
                    "enum": ["thumb_walking", "finger_walking", "rotation", "pinching", "holding", "all"],
                    "description": (
                        "Technique name to retrieve. Use 'all' to get all techniques. "
                        "Teknik adı. Tüm teknikleri almak için 'all' kullanın."
                    )
                },
                "language": {
                    "type": "string",
                    "enum": ["tr", "en"],
                    "description": "Response language: 'tr' for Turkish (default), 'en' for English."
                }
            },
            "required": ["technique_name"]
        }
    },
    {
        "name": "get_safety_info",
        "description": (
            "Get safety information, contraindications, and medical disclaimers for reflexology. "
            "Refleksoloji için güvenlik bilgileri, kontrendikasyonlar ve tıbbi feragatnameleri getirir. "
            "Always call this when the user asks about risks, safety, or who should avoid reflexology."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "language": {
                    "type": "string",
                    "enum": ["tr", "en"],
                    "description": "Response language: 'tr' for Turkish (default), 'en' for English."
                }
            },
            "required": []
        }
    },
    {
        "name": "list_all_zones",
        "description": (
            "List all available reflexology zones, optionally filtered by body area (foot, hand, or ear). "
            "Tüm mevcut refleksoloji bölgelerini listeler, isteğe bağlı olarak vücut bölgesine göre filtreler "
            "(ayak, el veya kulak). Use this to give the user an overview of what's available."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "area": {
                    "type": "string",
                    "enum": ["foot", "hand", "ear", "all"],
                    "description": (
                        "Body area to filter: 'foot' (ayak), 'hand' (el), 'ear' (kulak), or 'all' (hepsi). "
                        "Defaults to 'all'."
                    )
                },
                "language": {
                    "type": "string",
                    "enum": ["tr", "en"],
                    "description": "Response language: 'tr' for Turkish (default), 'en' for English."
                }
            },
            "required": []
        }
    }
]


# ─── Tool Handler Functions ───────────────────────────────────────────────────

def handle_lookup_zone(zone_id: str, language: str = "tr") -> dict:
    """Look up a specific reflexology zone by ID."""
    lang = language if language in ("tr", "en") else "tr"

    if zone_id not in ALL_ZONES:
        # Try partial match
        matches = [k for k in ALL_ZONES if zone_id.lower() in k.lower()]
        if not matches:
            if lang == "tr":
                return {
                    "success": False,
                    "error": f"'{zone_id}' kimliğiyle bölge bulunamadı. Mevcut bölgeleri görmek için list_all_zones aracını kullanın."
                }
            else:
                return {
                    "success": False,
                    "error": f"Zone with ID '{zone_id}' not found. Use list_all_zones tool to see available zones."
                }
        if len(matches) == 1:
            zone_id = matches[0]
        else:
            if lang == "tr":
                return {
                    "success": False,
                    "error": f"Birden fazla eşleşme bulundu: {', '.join(matches)}. Lütfen daha spesifik bir kimlik girin."
                }
            else:
                return {
                    "success": False,
                    "error": f"Multiple matches found: {', '.join(matches)}. Please provide a more specific ID."
                }

    zone = ALL_ZONES[zone_id]

    # Determine area type
    if zone_id in FOOT_ZONES:
        area_tr, area_en = "Ayak", "Foot"
    elif zone_id in HAND_ZONES:
        area_tr, area_en = "El", "Hand"
    else:
        area_tr, area_en = "Kulak", "Ear"

    if lang == "tr":
        return {
            "success": True,
            "zone_id": zone_id,
            "area": area_tr,
            "name": zone["tr"],
            "location": zone["location_tr"],
            "organ_system": zone["organ"],
            "benefits": zone["benefits_tr"],
            "technique": zone["technique_tr"],
            "caution": zone["caution_tr"]
        }
    else:
        return {
            "success": True,
            "zone_id": zone_id,
            "area": area_en,
            "name": zone["en"],
            "location": zone["location_en"],
            "organ_system": zone["organ"],
            "benefits": zone["benefits_en"],
            "technique": zone["technique_en"],
            "caution": zone["caution_en"]
        }


def handle_find_zones_by_symptom(symptom: str, language: str = "tr") -> dict:
    """Find reflexology zones related to a symptom keyword."""
    lang = language if language in ("tr", "en") else "tr"
    symptom_lower = symptom.lower().strip()

    matched_zone_ids = set()

    for key, zone_ids in SYMPTOM_MAP.items():
        if symptom_lower in key.lower() or key.lower() in symptom_lower:
            matched_zone_ids.update(zone_ids)

    if not matched_zone_ids:
        # Broader search in zone names and benefits
        for zone_id, zone in ALL_ZONES.items():
            if lang == "tr":
                search_text = f"{zone['tr']} {zone.get('benefits_tr', '')}".lower()
            else:
                search_text = f"{zone['en']} {zone.get('benefits_en', '')}".lower()
            if symptom_lower in search_text:
                matched_zone_ids.add(zone_id)

    if not matched_zone_ids:
        if lang == "tr":
            return {
                "success": False,
                "symptom": symptom,
                "message": f"'{symptom}' semptomu için eşleşen refleksoloji bölgesi bulunamadı. "
                           "Daha genel bir anahtar kelime deneyin (örn. 'baş', 'sırt', 'sindirim', 'stres')."
            }
        else:
            return {
                "success": False,
                "symptom": symptom,
                "message": f"No reflexology zones found for symptom '{symptom}'. "
                           "Try a more general keyword (e.g. 'head', 'back', 'digestion', 'stress')."
            }

    zones_info = []
    for zone_id in matched_zone_ids:
        if zone_id not in ALL_ZONES:
            continue
        zone = ALL_ZONES[zone_id]
        if zone_id in FOOT_ZONES:
            area_tr, area_en = "Ayak", "Foot"
        elif zone_id in HAND_ZONES:
            area_tr, area_en = "El", "Hand"
        else:
            area_tr, area_en = "Kulak", "Ear"

        if lang == "tr":
            zones_info.append({
                "zone_id": zone_id,
                "area": area_tr,
                "name": zone["tr"],
                "location": zone["location_tr"],
                "primary_benefit": zone["benefits_tr"][0] if isinstance(zone["benefits_tr"], list) and zone["benefits_tr"] else zone["benefits_tr"]
            })
        else:
            zones_info.append({
                "zone_id": zone_id,
                "area": area_en,
                "name": zone["en"],
                "location": zone["location_en"],
                "primary_benefit": zone["benefits_en"][0] if isinstance(zone["benefits_en"], list) and zone["benefits_en"] else zone["benefits_en"]
            })

    if lang == "tr":
        return {
            "success": True,
            "symptom": symptom,
            "found_zones_count": len(zones_info),
            "message": f"'{symptom}' için {len(zones_info)} refleksoloji bölgesi bulundu:",
            "zones": zones_info
        }
    else:
        return {
            "success": True,
            "symptom": symptom,
            "found_zones_count": len(zones_info),
            "message": f"Found {len(zones_info)} reflexology zone(s) for '{symptom}':",
            "zones": zones_info
        }


def handle_get_technique_guide(technique_name: str, language: str = "tr") -> dict:
    """Get technique instructions."""
    lang = language if language in ("tr", "en") else "tr"

    if technique_name == "all":
        result = {}
        for tech_key, tech_data in GENERAL_TECHNIQUES.items():
            result[tech_key] = tech_data[lang]
        return {
            "success": True,
            "techniques": result
        }

    if technique_name not in GENERAL_TECHNIQUES:
        available = list(GENERAL_TECHNIQUES.keys())
        if lang == "tr":
            return {
                "success": False,
                "error": f"'{technique_name}' tekniği bulunamadı. Mevcut teknikler: {', '.join(available)}"
            }
        else:
            return {
                "success": False,
                "error": f"Technique '{technique_name}' not found. Available techniques: {', '.join(available)}"
            }

    return {
        "success": True,
        "technique_name": technique_name,
        "instructions": GENERAL_TECHNIQUES[technique_name][lang]
    }


def handle_get_safety_info(language: str = "tr") -> dict:
    """Get safety information and contraindications."""
    lang = language if language in ("tr", "en") else "tr"

    return {
        "success": True,
        "contraindications": SAFETY_INFO["contraindications"][lang],
        "disclaimer": SAFETY_INFO["disclaimer"][lang]
    }


def handle_list_all_zones(area: str = "all", language: str = "tr") -> dict:
    """List all zones, optionally filtered by area."""
    lang = language if language in ("tr", "en") else "tr"

    area_map = {
        "foot": FOOT_ZONES,
        "hand": HAND_ZONES,
        "ear": EAR_ZONES,
        "all": ALL_ZONES
    }

    if area not in area_map:
        area = "all"

    zones_dict = area_map[area]
    result_zones = []

    for zone_id, zone in zones_dict.items():
        if zone_id in FOOT_ZONES:
            area_tr, area_en = "Ayak", "Foot"
        elif zone_id in HAND_ZONES:
            area_tr, area_en = "El", "Hand"
        else:
            area_tr, area_en = "Kulak", "Ear"

        if lang == "tr":
            result_zones.append({
                "zone_id": zone_id,
                "area": area_tr,
                "name": zone["tr"],
                "location": zone["location_tr"],
                "organ": zone["organ"]
            })
        else:
            result_zones.append({
                "zone_id": zone_id,
                "area": area_en,
                "name": zone["en"],
                "location": zone["location_en"],
                "organ": zone["organ"]
            })

    if lang == "tr":
        label = {
            "foot": "Ayak Refleksoloji Bölgeleri",
            "hand": "El Refleksoloji Bölgeleri",
            "ear": "Kulak Refleksoloji Bölgeleri",
            "all": "Tüm Refleksoloji Bölgeleri"
        }.get(area, "Tüm Refleksoloji Bölgeleri")
    else:
        label = {
            "foot": "Foot Reflexology Zones",
            "hand": "Hand Reflexology Zones",
            "ear": "Ear Reflexology Zones",
            "all": "All Reflexology Zones"
        }.get(area, "All Reflexology Zones")

    return {
        "success": True,
        "label": label,
        "total_count": len(result_zones),
        "zones": result_zones
    }


# ─── Tool Dispatcher ──────────────────────────────────────────────────────────

def dispatch_tool(tool_name: str, tool_input: dict) -> str:
    """
    Dispatch a tool call to the appropriate handler and return the result as JSON string.
    Bir araç çağrısını uygun işleyiciye yönlendirir ve sonucu JSON dizisi olarak döndürür.
    """
    try:
        if tool_name == "lookup_zone":
            result = handle_lookup_zone(
                zone_id=tool_input["zone_id"],
                language=tool_input.get("language", "tr")
            )
        elif tool_name == "find_zones_by_symptom":
            result = handle_find_zones_by_symptom(
                symptom=tool_input["symptom"],
                language=tool_input.get("language", "tr")
            )
        elif tool_name == "get_technique_guide":
            result = handle_get_technique_guide(
                technique_name=tool_input["technique_name"],
                language=tool_input.get("language", "tr")
            )
        elif tool_name == "get_safety_info":
            result = handle_get_safety_info(
                language=tool_input.get("language", "tr")
            )
        elif tool_name == "list_all_zones":
            result = handle_list_all_zones(
                area=tool_input.get("area", "all"),
                language=tool_input.get("language", "tr")
            )
        else:
            result = {
                "success": False,
                "error": f"Unknown tool: {tool_name}"
            }
    except Exception as e:
        result = {
            "success": False,
            "error": f"Tool execution error: {str(e)}"
        }

    return json.dumps(result, ensure_ascii=False, indent=2)
