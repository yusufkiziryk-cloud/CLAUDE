> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `09_VERI_MODELI_VE_RULE_SCHEMA.md` (birleşik dosya DOSYA 10/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# VERİ MODELİ VE RULE SCHEMA

## Ana tablolar

- `people` — minimum kişisel veri
- `employment_periods`
- `positions`
- `titles`
- `institutions`
- `service_branches`
- `pay_periods`
- `coefficient_versions`
- `legal_sources`
- `rule_versions`
- `pay_item_catalog`
- `pay_item_entitlements`
- `payroll_runs`
- `payroll_lines`
- `tax_ledgers`
- `minimum_wage_exemption_ledgers`
- `social_security_ledgers`
- `deduction_orders`
- `retro_adjustments`
- `collective_agreement_rules`
- `validation_issues`
- `golden_master_cases`
- `audit_events`

## payroll_line örneği

```json
{
  "pay_item_id": "GENERAL_BASE_MONTHLY",
  "gross_raw": "0.000000000000",
  "gross_payable": "0.00",
  "income_tax_base_delta": "0.00",
  "stamp_tax_base_delta": "0.00",
  "sgk_pec_delta": "0.00",
  "pension_5434_base_delta": "0.00",
  "employee_deduction": "0.00",
  "employer_cost_delta": "0.00",
  "rule_ids": [],
  "explanation": []
}
```

## Zorunlu tarihsel alanlar

Her bordro run'ında:

- `calculation_period`
- `calculated_at`
- `rule_snapshot_hash`
- `source_manifest_hash`
- `software_version`

saklanmalı.

## Snapshot

Mevzuat veri tabanı güncellendiğinde eski bordronun sonucu değişmemeli. Bordronun kullandığı rule version ID'leri immutable tutulmalı.

## Override

Manuel override yalnız yetkili rol ile:

- eski değer
- yeni değer
- gerekçe
- kullanıcı
- tarih/saat
- dayanak belge

kaydıyla yapılmalı. Override sonucu raporda görünür olmalıdır.
