/**
 * Reference data for the adaptive "Request a Tutor" wizard.
 *
 * Kept out of `seed.js` because it is long and because it is reference data
 * rather than demo data: the wizard reads all of it from the database at
 * runtime, and an operator adding a country or a level is expected to edit the
 * database rather than this file. Nothing here is invented — every row is a
 * factual mapping (which currency a country uses, which timezone it sits in,
 * which subjects a curriculum covers) that the form then lets the person
 * override.
 *
 * Notes on the shape:
 *  - `CURRENCIES`/`COUNTRIES` carry the codes and identifiers. ISO 4217 for
 *    currencies, ISO 3166-1 alpha-2 for countries, IANA for timezones. The
 *    wizard displays these verbatim, so a wrong value here is a wrong value in
 *    the browser: they are worth getting right rather than approximating.
 *  - `EDUCATION_SYSTEMS` is the indirection that lets a country have its own
 *    curriculum. Adding a third country with a distinct structure means adding
 *    a system, not branching on a country code in application code.
 *  - `LEVEL_SUBJECTS` is a suggestion table, not a constraint. The wizard offers
 *    these first and keeps the full catalogue available.
 */

/** ISO 4217 currencies offered in the budget step. `decimals` is minor units. */
const CURRENCIES = [
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'Pound Sterling', symbol: '£', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 2 },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 0 },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', decimals: 0 },
  { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh', decimals: 0 },
  { code: 'SSP', name: 'South Sudanese Pound', symbol: 'SSP', decimals: 2 },
  { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj', decimals: 0 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P', decimals: 2 },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', decimals: 2 },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', decimals: 0 },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', decimals: 0 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2 },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD', decimals: 2 },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'DT', decimals: 3 },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'DA', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'NPR', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', decimals: 2 },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR', decimals: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', decimals: 3 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', decimals: 3 },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JD', decimals: 3 },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimals: 2 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimals: 2 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 2 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', decimals: 2 },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  { code: 'ARS', name: 'Argentine Peso', symbol: 'AR$', decimals: 2 },
  { code: 'CLP', name: 'Chilean Peso', symbol: 'CLP$', decimals: 0 },
  { code: 'COP', name: 'Colombian Peso', symbol: 'COL$', decimals: 2 },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', decimals: 2 },
];

/**
 * Education configurations.
 *
 * `ETH` is the Ethiopian curriculum (primary through grade 12, TVET, higher
 * education). `INT` is the generic structure used by everyone else, and is the
 * default: a country that has no configuration of its own inherits it, so
 * adding a country to the marketplace never means inventing its grades first.
 */
const EDUCATION_SYSTEMS = [
  {
    code: 'INT',
    name: 'International (general)',
    description: 'The common structure used across most national systems.',
    isDefault: true,
  },
  {
    code: 'ETH',
    name: 'Ethiopian education system',
    description: 'Ethiopian grades 1–12, TVET and higher education.',
    isDefault: false,
  },
];

/**
 * Countries, in the order the wizard lists them: Ethiopia first (it is where
 * the marketplace began), then East Africa, then the wider world grouped
 * roughly by region so the `<select>` is navigable rather than alphabetical
 * soup. `sortOrder` is what preserves this order in the database.
 */
const COUNTRIES = [
  // Horn of Africa and East Africa
  { code: 'ET', name: 'Ethiopia', currencyCode: 'ETB', timezone: 'Africa/Addis_Ababa', educationSystemCode: 'ETH' },
  { code: 'KE', name: 'Kenya', currencyCode: 'KES', timezone: 'Africa/Nairobi' },
  { code: 'TZ', name: 'Tanzania', currencyCode: 'TZS', timezone: 'Africa/Dar_es_Salaam' },
  { code: 'UG', name: 'Uganda', currencyCode: 'UGX', timezone: 'Africa/Kampala' },
  { code: 'RW', name: 'Rwanda', currencyCode: 'RWF', timezone: 'Africa/Kigali' },
  { code: 'SO', name: 'Somalia', currencyCode: 'SOS', timezone: 'Africa/Mogadishu' },
  { code: 'SS', name: 'South Sudan', currencyCode: 'SSP', timezone: 'Africa/Juba' },
  { code: 'DJ', name: 'Djibouti', currencyCode: 'DJF', timezone: 'Africa/Djibouti' },
  { code: 'EG', name: 'Egypt', currencyCode: 'EGP', timezone: 'Africa/Cairo' },
  { code: 'MA', name: 'Morocco', currencyCode: 'MAD', timezone: 'Africa/Casablanca' },
  { code: 'TN', name: 'Tunisia', currencyCode: 'TND', timezone: 'Africa/Tunis' },
  { code: 'DZ', name: 'Algeria', currencyCode: 'DZD', timezone: 'Africa/Algiers' },

  // West, Central and Southern Africa
  { code: 'NG', name: 'Nigeria', currencyCode: 'NGN', timezone: 'Africa/Lagos' },
  { code: 'GH', name: 'Ghana', currencyCode: 'GHS', timezone: 'Africa/Accra' },
  { code: 'SN', name: 'Senegal', currencyCode: 'XOF', timezone: 'Africa/Dakar' },
  { code: 'CM', name: 'Cameroon', currencyCode: 'XAF', timezone: 'Africa/Douala' },
  { code: 'ZA', name: 'South Africa', currencyCode: 'ZAR', timezone: 'Africa/Johannesburg' },
  { code: 'BW', name: 'Botswana', currencyCode: 'BWP', timezone: 'Africa/Gaborone' },
  { code: 'ZM', name: 'Zambia', currencyCode: 'ZMW', timezone: 'Africa/Lusaka' },

  // North America
  { code: 'US', name: 'United States', currencyCode: 'USD', timezone: 'America/New_York' },
  { code: 'CA', name: 'Canada', currencyCode: 'CAD', timezone: 'America/Toronto' },
  { code: 'MX', name: 'Mexico', currencyCode: 'MXN', timezone: 'America/Mexico_City' },

  // South America
  { code: 'BR', name: 'Brazil', currencyCode: 'BRL', timezone: 'America/Sao_Paulo' },
  { code: 'AR', name: 'Argentina', currencyCode: 'ARS', timezone: 'America/Argentina/Buenos_Aires' },
  { code: 'CL', name: 'Chile', currencyCode: 'CLP', timezone: 'America/Santiago' },
  { code: 'CO', name: 'Colombia', currencyCode: 'COP', timezone: 'America/Bogota' },
  { code: 'PE', name: 'Peru', currencyCode: 'PEN', timezone: 'America/Lima' },

  // Europe
  { code: 'GB', name: 'United Kingdom', currencyCode: 'GBP', timezone: 'Europe/London' },
  { code: 'IE', name: 'Ireland', currencyCode: 'EUR', timezone: 'Europe/Dublin' },
  { code: 'DE', name: 'Germany', currencyCode: 'EUR', timezone: 'Europe/Berlin' },
  { code: 'FR', name: 'France', currencyCode: 'EUR', timezone: 'Europe/Paris' },
  { code: 'NL', name: 'Netherlands', currencyCode: 'EUR', timezone: 'Europe/Amsterdam' },
  { code: 'BE', name: 'Belgium', currencyCode: 'EUR', timezone: 'Europe/Brussels' },
  { code: 'ES', name: 'Spain', currencyCode: 'EUR', timezone: 'Europe/Madrid' },
  { code: 'PT', name: 'Portugal', currencyCode: 'EUR', timezone: 'Europe/Lisbon' },
  { code: 'IT', name: 'Italy', currencyCode: 'EUR', timezone: 'Europe/Rome' },
  { code: 'CH', name: 'Switzerland', currencyCode: 'CHF', timezone: 'Europe/Zurich' },
  { code: 'SE', name: 'Sweden', currencyCode: 'SEK', timezone: 'Europe/Stockholm' },
  { code: 'NO', name: 'Norway', currencyCode: 'NOK', timezone: 'Europe/Oslo' },
  { code: 'DK', name: 'Denmark', currencyCode: 'DKK', timezone: 'Europe/Copenhagen' },
  { code: 'PL', name: 'Poland', currencyCode: 'PLN', timezone: 'Europe/Warsaw' },
  { code: 'CZ', name: 'Czechia', currencyCode: 'CZK', timezone: 'Europe/Prague' },
  { code: 'HU', name: 'Hungary', currencyCode: 'HUF', timezone: 'Europe/Budapest' },
  { code: 'RO', name: 'Romania', currencyCode: 'RON', timezone: 'Europe/Bucharest' },
  { code: 'BG', name: 'Bulgaria', currencyCode: 'BGN', timezone: 'Europe/Sofia' },
  { code: 'TR', name: 'Türkiye', currencyCode: 'TRY', timezone: 'Europe/Istanbul' },

  // Middle East
  { code: 'AE', name: 'United Arab Emirates', currencyCode: 'AED', timezone: 'Asia/Dubai' },
  { code: 'SA', name: 'Saudi Arabia', currencyCode: 'SAR', timezone: 'Asia/Riyadh' },
  { code: 'QA', name: 'Qatar', currencyCode: 'QAR', timezone: 'Asia/Qatar' },
  { code: 'KW', name: 'Kuwait', currencyCode: 'KWD', timezone: 'Asia/Kuwait' },
  { code: 'OM', name: 'Oman', currencyCode: 'OMR', timezone: 'Asia/Muscat' },
  { code: 'JO', name: 'Jordan', currencyCode: 'JOD', timezone: 'Asia/Amman' },
  { code: 'IL', name: 'Israel', currencyCode: 'ILS', timezone: 'Asia/Jerusalem' },

  // South and Central Asia
  { code: 'IN', name: 'India', currencyCode: 'INR', timezone: 'Asia/Kolkata' },
  { code: 'PK', name: 'Pakistan', currencyCode: 'PKR', timezone: 'Asia/Karachi' },
  { code: 'BD', name: 'Bangladesh', currencyCode: 'BDT', timezone: 'Asia/Dhaka' },
  { code: 'NP', name: 'Nepal', currencyCode: 'NPR', timezone: 'Asia/Kathmandu' },
  { code: 'LK', name: 'Sri Lanka', currencyCode: 'LKR', timezone: 'Asia/Colombo' },

  // East and Southeast Asia
  { code: 'JP', name: 'Japan', currencyCode: 'JPY', timezone: 'Asia/Tokyo' },
  { code: 'CN', name: 'China', currencyCode: 'CNY', timezone: 'Asia/Shanghai' },
  { code: 'SG', name: 'Singapore', currencyCode: 'SGD', timezone: 'Asia/Singapore' },
  { code: 'MY', name: 'Malaysia', currencyCode: 'MYR', timezone: 'Asia/Kuala_Lumpur' },
  { code: 'ID', name: 'Indonesia', currencyCode: 'IDR', timezone: 'Asia/Jakarta' },
  { code: 'TH', name: 'Thailand', currencyCode: 'THB', timezone: 'Asia/Bangkok' },
  { code: 'VN', name: 'Vietnam', currencyCode: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'PH', name: 'Philippines', currencyCode: 'PHP', timezone: 'Asia/Manila' },

  // Oceania
  { code: 'AU', name: 'Australia', currencyCode: 'AUD', timezone: 'Australia/Sydney' },
  { code: 'NZ', name: 'New Zealand', currencyCode: 'NZD', timezone: 'Pacific/Auckland' },
];

/**
 * Education levels per system.
 *
 * `aliases` exist so a link built against older wording keeps resolving: the
 * homepage has always linked `/request-tutor?level=University`, and renaming the
 * level to "University / College" must not break every one of those links.
 */
const EDUCATION_LEVELS = [
  // --- International ------------------------------------------------------
  {
    code: 'int-primary',
    name: 'Primary School',
    stage: 'Primary',
    system: 'INT',
    aliases: ['Elementary School', 'Primary'],
    subjects: [
      'Mathematics', 'English', 'General Science', 'Art & Music', 'Physical Education',
    ],
  },
  {
    code: 'int-middle',
    name: 'Middle School',
    stage: 'Junior Secondary',
    system: 'INT',
    aliases: ['Lower Secondary', 'Junior High'],
    subjects: [
      'Mathematics', 'English', 'General Science', 'Biology', 'Chemistry', 'Physics',
      'Geography', 'History', 'Art & Music', 'Physical Education',
    ],
  },
  {
    code: 'int-high',
    name: 'High School',
    stage: 'Senior Secondary',
    system: 'INT',
    aliases: ['Senior Secondary', 'Upper Secondary'],
    subjects: [
      'Mathematics', 'English', 'Biology', 'Chemistry', 'Physics', 'Geography',
      'History', 'Civics and Ethical Education', 'Economics', 'Accounting',
      'Information and Communication Technology', 'Computer Science',
      'Exam Preparation', 'Art & Music', 'Physical Education',
    ],
  },
  {
    code: 'int-vocational',
    name: 'Vocational or Technical College',
    stage: 'Technical & Vocational',
    system: 'INT',
    aliases: ['TVET', 'Technical College', 'Polytechnic'],
    subjects: [
      'Computer Science', 'Programming', 'Web Development',
      'Information and Communication Technology', 'Business Studies',
      'Mathematics', 'English', 'Art & Music', 'Physical Education',
    ],
  },
  {
    code: 'int-university',
    name: 'University or College',
    stage: 'Higher Education',
    system: 'INT',
    aliases: ['University', 'Undergraduate', 'College'],
    subjects: [
      'University Course', 'Mathematics', 'Computer Science', 'Programming',
      'Data Science', 'Economics', 'Accounting', 'Business Studies',
      'Academic Writing', 'English',
    ],
  },
  {
    code: 'int-postgraduate',
    name: 'Postgraduate Studies',
    stage: 'Higher Education',
    system: 'INT',
    aliases: ['Postgraduate', "Master's", 'PhD'],
    subjects: [
      'University Course', 'Academic Writing', 'Data Science',
      'Business Studies', 'Economics',
    ],
  },
  {
    code: 'int-adult',
    name: 'Adult or Professional Learning',
    stage: 'Adult Learning',
    system: 'INT',
    aliases: ['Adult Learning', 'Professional', 'Working Professional'],
    subjects: [
      'English Proficiency', 'Public Speaking & Communication', 'Career Coaching',
      'Programming', 'Web Development', 'Data Science', 'Business Studies',
      'Accounting', 'Computer Science',
    ],
  },

  // --- Ethiopia -----------------------------------------------------------
  {
    code: 'eth-grade-1-3',
    name: 'Grades 1–3',
    stage: 'Primary',
    system: 'ETH',
    aliases: ['Grade 1', 'Grade 2', 'Grade 3', 'Primary 1', 'Grade 1-3'],
    subjects: [
      'Mathematics', 'English', 'Amharic', 'Afaan Oromo',
      'General Science', 'Art & Music', 'Physical Education',
    ],
  },
  {
    code: 'eth-grade-4-5',
    name: 'Grades 4–5',
    stage: 'Primary',
    system: 'ETH',
    aliases: ['Grade 4', 'Grade 5', 'Primary 2', 'Grade 4-5'],
    subjects: [
      'Mathematics', 'English', 'Amharic', 'Afaan Oromo',
      'General Science', 'Geography', 'History',
      'Art & Music', 'Physical Education',
    ],
  },
  {
    code: 'eth-grade-6-8',
    name: 'Grades 6–8',
    stage: 'Junior Secondary',
    system: 'ETH',
    aliases: ['Grade 6', 'Grade 7', 'Grade 8', 'Junior Secondary', 'Grade 6-8'],
    subjects: [
      'Mathematics', 'English', 'Amharic', 'Afaan Oromo', 'General Science',
      'Physics', 'Chemistry', 'Biology', 'Geography', 'History',
      'Civics and Ethical Education',
      'Information and Communication Technology',
      'Art & Music', 'Physical Education',
    ],
  },
  {
    code: 'eth-grade-9-10',
    name: 'Grades 9–10',
    stage: 'Senior Secondary',
    system: 'ETH',
    aliases: ['Grade 9', 'Grade 10', 'Senior Secondary', 'Grade 9-10'],
    subjects: [
      'Mathematics', 'English', 'Amharic', 'Afaan Oromo', 'Physics', 'Chemistry',
      'Biology', 'Geography', 'History', 'Civics and Ethical Education',
      'Economics', 'Accounting', 'Agriculture',
      'Information and Communication Technology',
      'Physical Education',
    ],
  },
  {
    code: 'eth-grade-11-12',
    name: 'Grades 11–12',
    stage: 'Senior Secondary',
    system: 'ETH',
    aliases: ['Grade 11', 'Grade 12', 'University Entrance Prep', 'Grade 11-12'],
    subjects: [
      'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'Geography',
      'History', 'Civics and Ethical Education', 'Economics', 'Accounting',
      'Agriculture', 'Information and Communication Technology',
      'Exam Preparation',
    ],
  },
  {
    code: 'eth-tvet',
    name: 'TVET or Technical College',
    stage: 'Technical & Vocational',
    system: 'ETH',
    aliases: ['TVET', 'Technical and Vocational', 'College'],
    subjects: [
      'Accounting', 'Information and Communication Technology', 'Computer Science',
      'Programming', 'Agriculture', 'English', 'Amharic', 'Ge’ez',
      'Art & Music',
    ],
  },
  {
    code: 'eth-university',
    name: 'University or College',
    stage: 'Higher Education',
    system: 'ETH',
    aliases: ['University', 'Undergraduate', 'College', 'Higher Education'],
    subjects: [
      'University Course', 'Mathematics', 'Programming', 'Computer Science',
      'Data Science', 'Accounting', 'Economics', 'Academic Writing', 'English',
    ],
  },
  {
    code: 'eth-adult',
    name: 'Adult or Professional Learning',
    stage: 'Adult Learning',
    system: 'ETH',
    aliases: ['Adult Learning', 'Professional', 'Working Professional'],
    subjects: [
      'English Proficiency', 'Public Speaking & Communication', 'Career Coaching',
      'Programming', 'Computer Science', 'Web Development', 'Data Science',
      'Accounting', 'Business Studies',
    ],
  },
];

/**
 * Subjects added for the wizard, on top of the original ten.
 *
 * The first ten are seeded in `seed.js` and are referenced by existing tutor
 * profiles and by the homepage's subject catalogue, so they are not repeated
 * here — this list is additive and keyed on the subject name.
 */
const EXTRA_SUBJECTS = [
  // Ethiopian languages
  { name: 'Amharic', category: 'Languages', description: 'Modern Standard Amharic: reading, writing and speaking.' },
  { name: 'Afaan Oromo', category: 'Languages', description: 'Afaan Oromoo: reading, writing and speaking.' },
  { name: 'Ge’ez', category: 'Languages', description: 'Ge’ez script and classical Ge’ez texts.' },
  { name: 'Arabic', category: 'Languages', description: 'Modern Standard Arabic, reading and writing.' },

  // Widely taught languages
  { name: 'French', category: 'Languages', description: 'French as a foreign or additional language.' },
  { name: 'Spanish', category: 'Languages', description: 'Spanish as a foreign or additional language.' },
  { name: 'English Proficiency', category: 'Languages', description: 'General English, IELTS, TOEFL and academic English.' },

  // School subjects the original ten did not cover
  { name: 'General Science', category: 'School Subjects', description: 'Combined science for primary and junior secondary.' },
  { name: 'Civics and Ethical Education', category: 'School Subjects', description: 'Civics, citizenship and ethical education.' },
  { name: 'History', category: 'School Subjects', description: 'National and world history.' },
  { name: 'Geography', category: 'School Subjects', description: 'Physical and human geography.' },
  { name: 'Economics', category: 'School Subjects', description: 'Micro and macroeconomics.' },
  { name: 'Accounting', category: 'School Subjects', description: 'Bookkeeping, financial accounting and analysis.' },
  { name: 'Agriculture', category: 'School Subjects', description: 'Crop production, animal husbandry and agricultural science.' },
  { name: 'Physical Education', category: 'School Subjects', description: 'Sport, fitness and movement.' },
  { name: 'Art & Music', category: 'School Subjects', description: 'Drawing, painting, music theory and performance.' },

  // Technology
  { name: 'Information and Communication Technology', category: 'Technology', description: 'ICT: hardware, networking and office applications.' },
  { name: 'Computer Science', category: 'Technology', description: 'Discrete mathematics, algorithms, systems and theory.' },
  { name: 'Web Development', category: 'Technology', description: 'HTML, CSS, JavaScript and modern web frameworks.' },
  { name: 'Data Science', category: 'Technology', description: 'Statistics, data analysis, visualisation and machine learning.' },

  // University, exams and professional skills
  { name: 'Business Studies', category: 'University & Exams', description: 'Management, marketing and business operations.' },
  { name: 'Academic Writing', category: 'University & Exams', description: 'Essays, dissertations, citations and research method.' },
  { name: 'Public Speaking & Communication', category: 'Professional & Skills', description: 'Presentations, debating and professional communication.' },
  { name: 'Career Coaching', category: 'Professional & Skills', description: 'CVs, interviews and professional development.' },
];

/** Why a client is asking for a tutor, as distinct from what for. */
const LEARNING_GOALS = [
  { code: 'grade-improvement', name: 'Improving my grades', description: 'Ongoing support to keep up with class and strengthen weak topics.' },
  { code: 'exam-preparation', name: 'Exam preparation', description: 'Focused preparation for an upcoming exam or entrance test.' },
  { code: 'homework-help', name: 'Homework and assignment help', description: 'Working through set work, projects and deadlines.' },
  { code: 'skill-development', name: 'Learning a new skill', description: 'Building a capability from the beginning, with no exam in mind.' },
  { code: 'university-preparation', name: 'University preparation', description: 'Entrance examinations, applications and bridging courses.' },
  { code: 'professional-learning', name: 'Professional learning', description: 'Skills for work: tools, software, language or a qualification.' },
  { code: 'other', name: 'Something else', description: 'Tell us what you are trying to do in your own words.' },
];

export {
  CURRENCIES,
  COUNTRIES,
  EDUCATION_LEVELS,
  EDUCATION_SYSTEMS,
  EXTRA_SUBJECTS,
  LEARNING_GOALS,
};

/**
 * The markets a tutor can sell into.
 *
 * Ethiopia is the local market and the international market is what everyone else
 * buys in. Both are data, so a third market is a row in this table rather than a
 * change to the pricing step, the directory's filter, the API's validation and the
 * list of countries in the request wizard. Everything reads this list.
 *
 * `priceFormat` decides how a price is written for a learner: `code` gives
 * "1,500 ETB", `symbol` gives "$20". The two markets need opposite answers — "$" is
 * recognised everywhere, while "Br" is shared with Burundi's franc and means nothing
 * to most readers — so the choice belongs beside the currency rather than in a rule
 * inside the formatter.
 *
 * `isDefault` is the market served to somebody who has told us nothing, and it is
 * **Ethiopia**.
 *
 * That is a product decision rather than an inference about the visitor. This is an
 * Ethiopian marketplace: the local market is the one the site is built around, the
 * one that is populated, and the one a price in birr is expected to be quoted in.
 * A visitor who arrives with nothing known to go on sees birr.
 *
 * It is only ever the last resort. A visitor who tells us where they are — by
 * choosing a country in the request flow, or by having one saved on their account —
 * is served that country's market instead, and their answer outranks this flag
 * completely. So "default" means "we genuinely do not know", not "we guessed".
 *
 * Do not confuse this with `currencies.is_default`, which marks ETB as the
 * platform's primary currency. They happen to agree today and mean different things:
 * one is about which money to quote, the other is about which is the house currency.
 */
const MARKETS = [
  {
    code: 'ETB',
    name: 'Ethiopia',
    currencyName: 'Ethiopian Birr',
    symbol: 'Br',
    decimals: 2,
    priceFormat: 'code',
    isDefault: true,
    sortOrder: 0,
  },
  {
    code: 'USD',
    name: 'International',
    currencyName: 'US Dollar',
    symbol: '$',
    decimals: 2,
    priceFormat: 'symbol',
    isDefault: false,
    sortOrder: 1,
  },
];

export { MARKETS };
