# Finan Speciality Dental Clinic ERP - Operations Manual
## (excluding HRM and Feedback modules)

## Table of Contents
1. [Patient Management](#1-patient-management)
2. [Appointment Management](#2-appointment-management)
3. [Service Management](#3-service-management)
4. [Message Templates & Campaigns](#4-message-templates--campaigns)
5. [Public Website Booking](#5-public-website-booking)
6. [Age Management](#6-age-management)
7. [Site Assets Management](#7-site-assets-management)

---

## 1. Patient Management

### 1.1 Adding a New Patient (Desktop)
- **Path**: `/patients` → "New Patient" button
- **Fields required**:
  - Full Name (Amharic/English)
  - Age (whole number, 0-130)
  - Birth Date (auto-derived from age; keep month/day when editing)
  - Sex (Male/Female/Other)
  - Phone (Ethiopian format accepted; normalized when possible)
  - Address
- **Steps**:
  1. Click "New Patient"
  2. Enter name in both English and Amharic fields
  3. Enter age in the age text box (not birth date)
  4. Phone: Enter any format (e.g., `+1 555 000 1111`, `0911111111`); system normalizes Ethiopian phones
  5. Set address and sex
  6. Click "Save"
- **Phone normalization**: Raw trimmed phone stored; Ethiopian numbers prefixed with `+251` when possible

### 1.2 Editing Patient Age (Desktop)
- When editing a patient's age, the system derives approximate DOB from age
- **Important**: Stored month/day is preserved when one already exists, so birthday campaigns are not shifted
- If no month/day stored previously, defaults to January 1st
- Age edit adjusts birth year back one day when the stored birthday has not yet occurred this year

### 1.3 Viewing Patients (Mobile/Phone)
- **Path**: Mobile browser → `/patients`
- **Display**: Each patient row shows "Age" instead of birth date
- **Age format**: Whole number displayed; `—` if age is missing
- **Actions**: Edit, view details from the patient list

### 1.4 Patient Search (Both)
- Search by name, age, or phone
- Results show age column prominently
- Amharic/English name toggle available

---

## 2. Appointment Management

### 2.1 Scheduling a New Appointment (Desktop)
- **Path**: `/appointments` → "New Appointment" or from patient profile
- **Steps**:
  1. Select patient (or create new patient)
  2. Choose service from dental service list
  3. Select doctor (optional)
  4. Set date and time
  5. Appointment status: SCHEDULED → CONFIRMED → COMPLETED/NO_SHOW/CANCELLED
  6. Send appointment reminder message (automatic or manual)

### 2.2 Appointment Status Workflow
- **SCHEDULED** → Initial state
- **CONFIRMED** → When patient confirms or staff confirms
- **COMPLETED** → After visit
- **NO_SHOW** → Patient missed appointment; triggers "Hello {name}, we missed you..." message
- **CANCELLED** → Patient or staff cancelled

### 2.2 Viewing Appointments (Mobile)
- **Path**: Mobile browser → `/appointments`
- **Filter**: By date, status, doctor
- **Quick view**: Patient name, service, date/time, status
- **Actions**: Reschedule, confirm, cancel from mobile interface

---

## 3. Service Management

### 3.1 Adding a New Dental Service (Desktop)
- **Path**: `/services/new`
- **Fields**:
  - Service name (e.g., "Teeth Whitening", "Root Canal")
  - Category (General, Specialist, Preventive, etc.)
  - Price (in ETB)
  - Duration (minutes)
  - Description (Amharic/English)
  - Is active? (toggle)

### 3.2 Service Categories
- Pre-defined categories available
- Rebranded from eye-clinic to dental thematic
- Example categories: "General Checkup", "Orthodontics", "Oral Surgery", "Cosmetic Dentistry"

### 3.3 Viewing Services (Mobile)
- **Path**: Mobile browser → `/services`
- **List**: Grid or list view of all dental services
- **Each service shows**: Name, short description, price, duration
- **Tap**: Opens service details page

---

## 4. Message Templates & Campaigns

### 4.1 Message Template Library (Both)
- **Path**: `/messages/library`
- **Categories**: REMINDER, GREETING, ANNOUNCEMENT, FOLLOWUP, OTHER
- **Each template has**: English body, Amharic body, title, category
- **Library messages include** (dental-themed):
  - Appointment reminders (with "eye" → "dental" rebranded)
  - Birthday greetings
  - Happy New Year (new: `HAPPY_NEW_YEAR`)
  - New service announcements
  - Post-surgery follow-ups
  - Patient feedback requests

### 4.2 Sending a Message Template
1. Select template from library
2. Replace variables: `{name}`, `{clinic}`, `{date}`, `{time}`, `{doctor}`, `{review_link}`
3. Choose language: English or Amharic
4. Send to: Specific patient, audience, or campaign

### 4.3 Creating a Campaign (Desktop)
- **Path**: `/messages/campaigns/new`
- **Settings**:
  - Template selection
  - Audience filter (language, last visit date, SMS consent)
  - Schedule: Send now or schedule for later
  - Track: Opened, sent, skipped rates
- **Launch**: Campaign goes to outbox; tasks created per recipient

### 4.4 Campaign Dashboard
- View: Number of tasks, campaigns, drafts
- Track: Per-recipient status (PENDING → OPENED → SENT → SKIPPED → EXPIRED)
- Cancel: Any active campaign can be stopped

---

## 5. Public Website Booking

### 5.1 Public Appointment Request (Desktop & Mobile)
- **Path**: `/book` or homepage "Book Appointment" button
- **Form fields**:
  - Name
  - Phone (any format accepted — no format restriction)
  - Email (optional)
  - Preferred date/time
  - Service interest
  - Message (optional)
- **Phone format**: Any format accepted; system normalizes Ethiopian phones
- **Validation**: No `validationError` for phone fields; raw trimmed phone stored

### 5.2 Submission Flow
1. User fills form and clicks "Book"
2. System creates appointment request (website_request source)
3. Owner/staff receives notification
4. Appointment can be confirmed, modified, or cancelled from internal system
5. Confirmation message sent via selected template

### 5.3 Mobile View
- **Path**: Mobile browser → `/book`
- **Responsive form**: Fields stack vertically
- **Phone keypad**: Optimized for number entry
- **Touch targets**: Large enough for thumb tapping
- **Back button**: Returns to homepage

---

## 6. Age Management

### 6.1 Age Input everywhere Patients are Shown
- **Replaces**: Birth date input/display
- **Displays**: Whole number age (0-130)
- **Format**: `—` when age is null/missing

### 6.2 Converting Age to/from Birth Date
- **ageFromBirthDate(dob)**: Returns whole years; `null` if date invalid or in future
- **birthDateFromAge(age, existing_dob)**: Returns approximate DOB
  - Keeps stored month/day when editing (so campaigns don't shift)
  - Defaults to January 1st for new patients
  - Adjusts year back one when birthday hasn't occurred yet this year

### 6.3 Age Validation
- **Invalid age message**: "Enter a whole age between 0 and 130"
- **Applies to**: Patient form age field
- **Range**: 0 (newborn) to 130 (supercentenarian)

### 6.4 Age on Public Pages
- **Patient list page (`/patients`)**: Shows age column
- **Patient detail page**: Age displayed prominently
- **No birth date exposure**: Privacy-friendly; only age shown

---

## 7. Site Assets Management

### 7.1 Logo Management
- **Current logo**: `/finan-dental-logo.png` (extracted from Finan Dental Logo.png)
- **Dimensions**: Square aspect ratio (~1:1); width follows height × 1.0025
- **Alt text**: "Finan Speciality Dental Clinic"
- **Locations**: 
  - Header (`/`, `/about`, `/services`, etc.): height=36px
  - Homepage: height=60px (with clinic name below)
  - Mobile header: height=34px
- **Dark surface variant**: Auto-uses dark version when needed (dark background detection)

### 7.2 Hero Background Image
- **Current hero**: `/hero-serene-tooth.jpg` (Serene Tooth in Blue and Green.png converted to JPG)
- **Location**: Homepage `/` (hero section)
- **Styling**:
  - Gradient overlay: `from-white via-white/85 to-white/25`
  - Accent color tint: `bg-[#129CF4]/10`
  - Parallax effect: Slight scale transform on desktop
  - Mobile: Full-width, responsive image
- **Accessibility**: `alt=""` (decorative); gradient ensures text readability

### 7.3 Favicon & App Icon
- **Favicon**: `/favicon.ico` (4 sizes: 16, 32, 48, 64 px; from logo)
- **App icon**: `/icon.png` (512×512 PNG; from logo center crop)
- **Both generated**: From the new Finan Dental Logo.png

### 7.4 Updating Assets (Developer/Admin)
- **Replace logo**: Put new PNG in `1st 20 service providers/Finan Dental Logo.png`; run extraction script
- **Replace hero**: Put new image in `1st 20 service providers/Serene Tooth in Blue and Green.png`; run conversion script
- **Regenerate icons**: Use the source PNG to regenerate `icon.png` and `favicon.ico`
- **Commit and push**: All changes go to `main` branch

---

## Appendix: Key Technical Notes

### Age Computation Logic
```
ageFromBirthDate(birthDate):
  - Calculates whole years between DOB and today
  - Returns null if DOB is null or in future
  - Adjusts down if birthday hasn't occurred this year

birthDateFromAge(age, existing_dob = null):
  - If existing_dob has month/day: preserves them
  - If no existing_dob: defaults to January 1st
  - Adjusts year back one when birthday hasn't happened yet this year
  - New patients: 1 January of birth year
```

### Phone Normalization
- Ethiopian numbers: Automatically prefixed with `+251` when possible
- International formats: Stored as-is (e.g., `+1 555 000 1111`)
- Local formats: Trimmed and stored raw
- No validationError on phone fields in public booking

### Message Template Variables
- Limited to: `TEMPLATE_VARIABLES` = `{name}`, `{clinic}`, `{date}`, `{time}`, `{doctor}`, `{review_link}`
- Amharic bodies are first-pass drafts marked "needs native review"
- English/Amharic never collide due to normalized hash per language

### Public Booking Workflow
- Turnstile skipped when `TURNSTILE_SECRET_KEY` unset (including production)
- No `validationError` for phone format restrictions
- Appointment request created; staff converts to confirmed appointment

---

## Change Log Highlights (Recent)
- **Logo & hero**: Replaced vision assets with Finan Dental logo + Serene Tooth hero
- **Age**: Full implementation without DB migration; age shown everywhere patients appear
- **Messaging**: HAPPY_NEW_YEAR template; requestAlreadyConverted message; dental-themed library
- **Public booking**: No phone format restrictions; any format accepted
- **Rebranding**: shortName Vision ERP → Finan ERP; all eye→dental thematic updates