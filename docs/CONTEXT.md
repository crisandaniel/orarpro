# OrarPro — Context Proiect

## Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind, Vercel
- **Backend**: Supabase (PostgreSQL + RLS), next-intl (RO/EN)
- **Solver**: Python FastAPI + Google OR-Tools CP-SAT pe Railway
- **Payments**: Stripe
- **Repo local**: `/Users/daniel.crisan/Documents/Personal/orarpro`

---

## Arhitectură generală

```
orarpro/
  src/
    app/
      [locale]/
        (dashboard)/
          resources/page.tsx          ← Resurse instituție
          schedules/[id]/
            school-setup/page.tsx     ← Configurare orar
    components/
      schedule/
        SchoolSetupClient.tsx         ← Orchestrator orar (516 linii)
        TimetableGrid.tsx             ← Grilă orar vizualizare
        school-setup/
          types.ts                    ← CellData, DEFAULT_SOFT_RULES, inp
          feasibility.ts              ← runFeasibilityCheck (client-side)
          MultiEditForm.tsx           ← Editare Ctrl+Click în bloc
          CurriculumMatrix.tsx        ← Tabel clasă×materie
          ConstraintsPanel.tsx        ← Hard/Soft constraints + slidere
          SolverDebugLog.tsx          ← Sumar + detalii solver
      resources/
        ResourcesClient.tsx           ← CRUD resurse (5 taburi)
    lib/
      dal/
        school.ts                     ← getSchoolResources, getCurriculumItems, getLessons
    types/index.ts                    ← Toate tipurile TypeScript
  supabase/
    migrations_refactored/
      000_drop_all.sql
      001_core.sql                    ← organizations cu days_per_week, slots_per_day
      005_school.sql                  ← Schema completă v3
```

---

## Model de date (TypeScript)

```typescript
// Org-level
type TimeConfig = { days: number; slotsPerDay: number }

type SchoolTeacher = {
  id, name, color
  unavailable_slots: string[]   // format "day-period" ex: "0-3"
  preferred_slots: string[]
  max_lessons_per_day?: number | null
  max_lessons_per_week?: number | null
  min_lessons_per_week?: number | null
}

type SchoolSubject = {
  id, name, short_name, color
  required_room_type?: RoomType | null
  difficulty: 'hard' | 'medium' | 'easy'
}

type SchoolClass = {
  id, name, grade_number, stage: ClassStage
  max_lessons_per_day: number
  homeroom_id?: string | null
}

type SchoolRoom = { id, name, type: RoomType, capacity?: number }

type RoomType = 'homeroom' | 'gym' | 'computer_lab' | 'chemistry_lab' | 'generic'

// Per orar
type CurriculumItem = {
  class_id, subject_id, teacher_id
  weekly_hours: number
  lesson_pattern: number[] | null   // null = [1,1,...,1]; [2,1] = bloc dublu + single
  preferred_room_id?: string | null
}

type ScheduleConfig = {
  days_per_week, slots_per_day, slot_duration, first_slot_start
  soft_rules: SoftRules
  solver_used, generated_at
}

type SoftRules = {
  avoidGapsForTeachers?: boolean
  avoidLastHourForStages?: ClassStage[] | false
  avoidSameSubjectTwicePerDay?: boolean
  hardSubjectsMorning?: boolean
  startFromFirstSlot?: boolean
  weights: {
    teacherGaps: number    // 0-100
    lastHour: number
    sameSubject: number
    hardMorning: number
    startFirst: number
  }
}

// Output solver
type SchoolLesson = {
  id, schedule_id, class_id, subject_id, teacher_id
  room_id?: string | null
  day: number      // 0-based
  period: number   // 0-based
  duration: number // 1 sau 2
  is_manual: boolean
}
```

---

## DB Schema (Supabase)

### Tabele principale
| Tabel | Scope | Descriere |
|---|---|---|
| `organizations` | org | + `days_per_week`, `slots_per_day` |
| `school_teachers` | org | Profesori cu `unavailable_slots` jsonb |
| `school_subjects` | org | Materii cu difficulty și required_room_type |
| `school_classes` | org | Clase cu stage și max_lessons_per_day |
| `school_rooms` | org | Săli cu tip și capacitate |
| `schedule_configs` | orar | TimeConfig + SoftRules jsonb |
| `curriculum_items` | orar | Asignări clasă×materie×profesor |
| `school_lessons` | orar | Output solver — lecții plasate |

---

## API Routes

| Route | Metodă | Descriere |
|---|---|---|
| `/api/resources` | POST/PUT/DELETE | CRUD resurse org |
| `/api/resources/time-config` | PUT | Salvează days/slots în organizations |
| `/api/schedules/[id]/school-setup` | POST | Salvează config + curriculum |
| `/api/schedules/[id]/generate-school` | POST | Generează orar via CP-SAT |
| `/api/schedules/[id]/lessons` | GET | Lecții cu joins |

---

## Solver Python (Railway)

**URL**: `process.env.SOLVER_URL`  
**Fișiere**: `main.py` + `solvers/school.py`

### Flow
1. Next.js construiește `Lesson[]` cu `allowed_slots` pre-calculate
2. Wake-up call la `/health` (Railway cold start)
3. POST `/solve/school` cu payload complet
4. Solver returnează `timetable[]` + `violations[]` + `debug_log[]`

### Payload trimis la solver
```python
{
  lessons: [{ id, class_id, subject_id, teacher_id, duration, allowed_slots }],
  teachers: [{ id, name, max_lessons_per_day, max_lessons_per_week, preferred_slots }],
  classes: [{ id, name, stage, max_lessons_per_day }],
  rooms: [{ id, name, type }],
  days_per_week, slots_per_day,
  soft_rules: { avoidGapsForTeachers, avoidLastHourForStages, ..., weights },
  solver_time_limit_seconds: 50
}
```

### Constrângeri hard (CP-SAT)
1. Fiecare lecție plasată exact o dată
2. Lecție doar în `allowed_slots`
3. Profesor max 1 lecție/slot
4. Clasă max 1 lecție/slot
5. `max_lessons_per_day/week` per profesor
6. `max_lessons_per_week` min (normă)
7. `max_lessons_per_day` per clasă
8. Duration=2: sloturi consecutive aceeași zi

### Soft constraints (în objective, penalizare pătratică)
- `avoidGapsForTeachers` — penalizare slot^2 per profesor
- `startFromFirstSlot` — penalizare slot^2 per clasă
- `avoidLastHourForStages` — penalizare pe ultimul slot
- `avoidSameSubjectTwicePerDay` — excess count per materie/zi
- `preferred_slots` — penalizare mică dacă nu respectat

---

## UI — Flux utilizator

```
Resurse (org-level, reutilizate)
  Tabs: Profesori | Materii | Săli | Clase | Timp
  → SlotPicker pentru unavailable/preferred slots

Orar nou → school-setup
  1. Curriculum — tabel clasă×materie, Ctrl+Click editare în bloc
  2. Constrângeri — hard (info) + soft (checkbox + slider 0-100)
  3. Verifică (fast-check client-side)
  4. Generează → CP-SAT
  5. TimetableGrid — filtrare Clasă/Profesor/Sală
```

---

## Probleme rezolvate recent
- ✅ `model.minimize` lipsea — soft constraints nu aveau efect (objective=0)
- ✅ `avoidLastHourForStages` tip `list | false` — Pydantic 422 fix
- ✅ Duration=2 bug în HARD 2/3 — variabile duplicate → INFEASIBLE
- ✅ `max_lessons_per_day` trimitea obiectul `admin` în loc de număr
- ✅ Tabel curriculum redus (64px celule, font 11px)
- ✅ Scroll orizontal pe tabel și filtru TimetableGrid
- ✅ Statistici ore/săpt per profesor sub tabelul curriculum
- ✅ `SchoolSetupClient.tsx` spart în 6 subcomponente în `school-setup/`

## Pending / De făcut
- [ ] `TimetableGrid` — editare sală per lecție (click pe card)
- [ ] Export Excel orar
- [ ] SEO: og-image.html creat, trebuie convertit în PNG + adăugat sitemap/robots
- [ ] Google Search Console — cod verificare diferit de GA ID
- [ ] Metadata per pagină în `page.tsx`
- [ ] `hardSubjectsMorning` soft constraint — neimplementat în solver

---

## Seed SQL
`seed_school.sql` — 15 profesori, 12 materii, 55 săli (S101-S150 + 5 speciale), 18 clase (9A-12D)

## Fișiere care NU mai există
- `src/lib/algorithms/greedy-school.ts` — marcat DEPRECATED
- `src/lib/algorithms/school-generator.ts` — de șters

## Note importante
- Sloturile sunt format `"day-period"` ex: `"0-3"` = Luni ora 4 (0-based)
- `avoidLastHourForStages` poate fi `false` (debifat) sau `ClassStage[]` — ambele valide
- Soft constraints se salvează în `schedule_configs.soft_rules` jsonb
- La reload pagină, `soft_rules` se normalizează față de `DEFAULT_SOFT_RULES`
- CP-SAT timeout: 50s; Railway wake-up: `/health` cu 10s timeout înainte de `/solve/school`
