import { Note, Task, CalendarEvent, Goal, DailyEntry } from '../types'

const id = () => Math.random().toString(36).slice(2, 11)
const now = new Date()
const y = now.getFullYear()

export const demoNotes: Note[] = [
  {
    id: id(), title: 'Q1 Proje Planı', content: '## Çeyrek Hedefler\n\n- [ ] Yeni ürün lansmanı\n- [ ] Ekip genişletme\n- [x] Bütçe onayı\n\n### Notlar\nBu çeyrek için öncelik **kullanıcı deneyimini iyileştirmek**.',
    category: 'İş', tags: ['proje', 'planlama', 'Q1'], persons: ['Ahmet Bey', 'Ayşe Hanım'], organizations: ['TechCorp'],
    emotion: 'good', createdAt: `${y}-01-10T09:00:00`, updatedAt: `${y}-01-10T09:00:00`, pinned: true, archived: false, linkedTaskIds: [], linkedEventIds: []
  },
  {
    id: id(), title: 'Sağlık Rutini', content: '## Günlük Sağlık Planım\n\n- Sabah 7\'de kalk\n- 30 dk yürüyüş\n- Bol su iç\n- 22:30\'da uyu\n\n> Sağlık en büyük servet.',
    category: 'Sağlık', tags: ['sağlık', 'rutin', 'wellness'], persons: [], organizations: [],
    emotion: 'great', createdAt: `${y}-02-05T08:00:00`, updatedAt: `${y}-02-05T08:00:00`, pinned: false, archived: false, linkedTaskIds: [], linkedEventIds: []
  },
  {
    id: id(), title: 'Kitap Notları: Atomic Habits', content: '## Atomic Habits — James Clear\n\n**Anahtar Fikir:** Küçük alışkanlıklar büyük değişimlere yol açar.\n\n### Önemli Noktalar\n1. Sisteminiz hedeflerinizden daha önemlidir\n2. %1 gelişme her gün\n3. Kimlik odaklı alışkanlıklar\n\n`İpucu:` Her yeni alışkanlığı mevcut birine bağla.',
    category: 'Kitap', tags: ['kitap', 'alışkanlık', 'kişisel-gelişim'], persons: ['James Clear'], organizations: [],
    emotion: 'great', createdAt: `${y}-02-20T19:00:00`, updatedAt: `${y}-02-20T19:00:00`, pinned: false, archived: false, linkedTaskIds: [], linkedEventIds: []
  },
  {
    id: id(), title: 'Yıllık Bütçe Planı', content: '## 2026 Bütçe Hedefleri\n\n| Kategori | Hedef | Gerçek |\n|---|---|---|\n| Tasarruf | 20% | - |\n| Yatırım | 10% | - |\n| Eğitim | 5% | - |\n\n### Notlar\nEmergency fund: 6 aylık gider.',
    category: 'Finans', tags: ['bütçe', 'finans', 'tasarruf'], persons: [], organizations: ['Garanti BBVA'],
    emotion: 'neutral', createdAt: `${y}-01-03T10:00:00`, updatedAt: `${y}-01-15T10:00:00`, pinned: true, archived: false, linkedTaskIds: [], linkedEventIds: []
  },
  {
    id: id(), title: 'Toplantı Notları — Ürün Roadmap', content: '## 15 Mart Toplantısı\n\n**Katılımcılar:** Ahmet, Ayşe, Mehmet\n\n### Kararlar\n1. Mobil app Q2\'de\n2. API entegrasyonu öncelikli\n3. Haftalık sprint review devam\n\n**Sonraki adımlar:** Teknik spec hazırlama.',
    category: 'Toplantı', tags: ['toplantı', 'roadmap', 'ürün'], persons: ['Ahmet Bey', 'Ayşe Hanım', 'Mehmet Bey'], organizations: ['TechCorp'],
    emotion: 'good', createdAt: `${y}-03-15T14:00:00`, updatedAt: `${y}-03-15T14:00:00`, pinned: false, archived: false, linkedTaskIds: [], linkedEventIds: []
  },
  {
    id: id(), title: 'Fikir: Verimlilik Uygulaması', content: '## Fikir\n\nBir **kişisel verimlilik uygulaması** geliştirmek istiyorum.\n\n### Özellikler\n- Pomodoro timer\n- Alışkanlık takibi\n- Not alma\n- Raporlama\n\n**Hedef kitle:** Bilgi çalışanları',
    category: 'Fikir', tags: ['fikir', 'uygulama', 'verimlilik', 'startup'], persons: [], organizations: [],
    emotion: 'great', createdAt: `${y}-04-02T21:00:00`, updatedAt: `${y}-04-02T21:00:00`, pinned: false, archived: false, linkedTaskIds: [], linkedEventIds: []
  },
]

export const demoTasks: Task[] = [
  {
    id: id(), title: 'Yıllık raporu tamamla', description: '2025 yıl sonu raporunu hazırla ve müdüre sun.', dueDate: `${y}-01-31`,
    priority: 'high', status: 'done', tags: ['rapor', 'iş'], category: 'İş',
    createdAt: `${y}-01-05T09:00:00`, updatedAt: `${y}-01-28T17:00:00`, completedAt: `${y}-01-28T17:00:00`
  },
  {
    id: id(), title: 'Sağlık kontrolü randevusu al', description: 'Yıllık kontrol için doktor randevusu.', dueDate: `${y}-03-15`,
    priority: 'medium', status: 'done', tags: ['sağlık'], category: 'Sağlık',
    createdAt: `${y}-02-10T09:00:00`, updatedAt: `${y}-03-10T09:00:00`, completedAt: `${y}-03-10T09:00:00`
  },
  {
    id: id(), title: 'Yeni proje teklifini hazırla', description: 'Q2 için yeni proje teklifini detaylandır ve sunum hazırla.', dueDate: `${y}-04-30`,
    priority: 'critical', status: 'in-progress', tags: ['proje', 'teklif'], category: 'İş',
    createdAt: `${y}-04-01T09:00:00`, updatedAt: `${y}-04-10T09:00:00`
  },
  {
    id: id(), title: 'Online kurs tamamla', description: 'TypeScript advanced kursunu bitir.', dueDate: `${y}-05-31`,
    priority: 'medium', status: 'in-progress', tags: ['eğitim', 'typescript'], category: 'Eğitim',
    createdAt: `${y}-03-20T09:00:00`, updatedAt: `${y}-04-05T09:00:00`
  },
  {
    id: id(), title: 'Vergi beyannamesi', description: 'Gelir vergisi beyannamesini hazırla ve ver.', dueDate: `${y}-03-31`,
    priority: 'critical', status: 'done', tags: ['vergi', 'finans', 'resmi'], category: 'Resmi İşler',
    createdAt: `${y}-02-20T09:00:00`, updatedAt: `${y}-03-25T09:00:00`, completedAt: `${y}-03-25T09:00:00`
  },
  {
    id: id(), title: 'Haftalık egzersiz rutini başlat', description: 'Haftada 3 gün spor salonuna git.', dueDate: undefined,
    priority: 'high', status: 'todo', tags: ['sağlık', 'spor'], category: 'Sağlık', recurring: 'weekly',
    createdAt: `${y}-04-15T09:00:00`, updatedAt: `${y}-04-15T09:00:00`
  },
  {
    id: id(), title: 'Portfolio websitesi güncelle', description: 'Yeni projelerle portfolio\'yu güncelle.', dueDate: `${y}-05-15`,
    priority: 'low', status: 'todo', tags: ['web', 'kişisel'], category: 'Kişisel',
    createdAt: `${y}-04-20T09:00:00`, updatedAt: `${y}-04-20T09:00:00`
  },
]

export const demoEvents: CalendarEvent[] = [
  {
    id: id(), title: 'Doktor Randevusu', description: 'Yıllık genel kontrol', date: `${y}-03-10`, time: '10:00',
    type: 'meeting', importance: 'high', category: 'Sağlık', color: '#10b981',
    createdAt: `${y}-02-20T09:00:00`
  },
  {
    id: id(), title: 'Proje Sunum', description: 'Q1 proje sunumu yöneticiye', date: `${y}-04-15`, time: '14:00',
    type: 'meeting', importance: 'critical', category: 'İş', color: '#6366f1',
    createdAt: `${y}-04-01T09:00:00`
  },
  {
    id: id(), title: 'Aile Yemeği', description: 'Haftalık aile yemeği', date: `${y}-05-18`, time: '19:00',
    type: 'event', importance: 'medium', category: 'Aile', color: '#f59e0b',
    createdAt: `${y}-05-10T09:00:00`
  },
  {
    id: id(), title: 'Kurs Sınavı', description: 'TypeScript sertifika sınavı', date: `${y}-05-28`, time: '09:00',
    type: 'deadline', importance: 'high', category: 'Eğitim', color: '#8b5cf6',
    createdAt: `${y}-05-01T09:00:00`
  },
]

export const demoGoals: Goal[] = [
  {
    id: id(), title: 'Kitap Okuma: Yılda 24 Kitap', description: 'Her ay 2 kitap okuyarak yılda 24 kitap hedefi.',
    startDate: `${y}-01-01`, endDate: `${y}-12-31`, progress: 33, status: 'active', category: 'Eğitim',
    linkedNoteIds: [], monthlyReviews: [
      { month: `${y}-01`, note: '2 kitap tamamlandı', progress: 8 },
      { month: `${y}-02`, note: '2 kitap tamamlandı', progress: 17 },
      { month: `${y}-03`, note: '2 kitap tamamlandı', progress: 25 },
      { month: `${y}-04`, note: '2 kitap tamamlandı', progress: 33 },
    ],
    createdAt: `${y}-01-01T09:00:00`, updatedAt: `${y}-04-30T09:00:00`
  },
  {
    id: id(), title: 'Sağlıklı Yaşam: 10 kg Ver', description: 'Yıl sonuna kadar 10 kg vererek ideal kiloya ulaş.',
    startDate: `${y}-01-01`, endDate: `${y}-12-31`, progress: 40, status: 'active', category: 'Sağlık',
    linkedNoteIds: [], monthlyReviews: [
      { month: `${y}-01`, note: '2 kg verildi', progress: 20 },
      { month: `${y}-02`, note: '2 kg daha', progress: 40 },
    ],
    createdAt: `${y}-01-01T09:00:00`, updatedAt: `${y}-02-28T09:00:00`
  },
  {
    id: id(), title: 'Kariyer: Senior Developer Terfi', description: 'Yıl sonunda senior developer seviyesine yüksel.',
    startDate: `${y}-01-01`, endDate: `${y}-12-31`, progress: 60, status: 'active', category: 'İş',
    linkedNoteIds: [], monthlyReviews: [],
    createdAt: `${y}-01-01T09:00:00`, updatedAt: `${y}-04-15T09:00:00`
  },
]

export const demoDailyEntries: DailyEntry[] = [
  {
    id: id(), date: `${y}-05-20`, title: 'Verimli Bir Salı', summary: 'Proje sunumunu tamamladım, spora gittim.',
    mainNote: 'Bugün harika bir gündü. Uzun süredir üzerinde çalıştığım proje sunumunu bitirdim.',
    importantEvents: 'Proje sunumu 14:00\'te tamamlandı. Müdür memnun kaldı.',
    learnings: 'Sunum hazırlarken görsel ağırlıklı içerik daha etkili oluyor.',
    ideas: 'Sunumu bir template olarak kaydetmek ve gelecekte kullanmak.',
    todos: '- [x] Sunum hazırla\n- [x] Spor\n- [ ] Kitap oku',
    emotion: 'great', energy: 4, tags: ['verimli', 'sunum', 'spor'], category: 'İş',
    links: [], persons: ['Ahmet Bey'], organizations: ['TechCorp'],
    createdAt: `${y}-05-20T22:00:00`, updatedAt: `${y}-05-20T22:00:00`
  },
  {
    id: id(), date: `${y}-05-19`, title: 'Normal Bir Pazartesi', summary: 'Haftalık toplantı, kod review.',
    mainNote: 'Haftaya iyi başladım. Toplantılar biraz uzun sürdü ama verimli geçti.',
    importantEvents: '', learnings: 'Code review sırasında önemli bir bug buldum.',
    ideas: '', todos: '- [x] Haftalık toplantı\n- [x] Code review',
    emotion: 'good', energy: 3, tags: ['toplantı', 'kod'], category: 'İş',
    links: [], persons: [], organizations: [],
    createdAt: `${y}-05-19T21:00:00`, updatedAt: `${y}-05-19T21:00:00`
  },
]
