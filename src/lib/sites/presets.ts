import type { SiteThemeColor, SiteService, SiteFeature, SiteTestimonial } from "./types";

export interface CategoryPreset {
    categoryKey: string;
    label: string;
    defaultTheme: SiteThemeColor;
    tagline: (name: string, city?: string) => string;
    headline: (name: string, city?: string) => string;
    subheadline: (name: string, city?: string) => string;
    aboutTitle: string;
    aboutDescription: (name: string, city?: string) => string;
    highlights: string[];
    services: SiteService[];
    features: SiteFeature[];
    testimonials: (name: string) => SiteTestimonial[];
    whatsappGreeting: (name: string) => string;
}

export const THEME_CONFIGS: Record<SiteThemeColor, {
    label: string;
    primaryHex: string;
    gradientClass: string;
    badgeBg: string;
    accentClass: string;
    buttonClass: string;
    borderClass: string;
}> = {
    emerald: {
        label: "Emerald Trust",
        primaryHex: "#059669",
        gradientClass: "from-emerald-600 via-teal-700 to-emerald-900",
        badgeBg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        accentClass: "text-emerald-600 dark:text-emerald-400",
        buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25",
        borderClass: "border-emerald-500/20",
    },
    sapphire: {
        label: "Royal Sapphire",
        primaryHex: "#2563EB",
        gradientClass: "from-blue-600 via-indigo-700 to-slate-900",
        badgeBg: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        accentClass: "text-blue-600 dark:text-blue-400",
        buttonClass: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25",
        borderClass: "border-blue-500/20",
    },
    gold: {
        label: "Luxury Gold",
        primaryHex: "#D97706",
        gradientClass: "from-amber-600 via-amber-700 to-zinc-950",
        badgeBg: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        accentClass: "text-amber-600 dark:text-amber-400",
        buttonClass: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25",
        borderClass: "border-amber-500/20",
    },
    crimson: {
        label: "Ruby Crimson",
        primaryHex: "#E11D48",
        gradientClass: "from-rose-600 via-red-700 to-zinc-900",
        badgeBg: "bg-rose-500/10 text-rose-600 border-rose-500/20",
        accentClass: "text-rose-600 dark:text-rose-400",
        buttonClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25",
        borderClass: "border-rose-500/20",
    },
    violet: {
        label: "Cosmic Violet",
        primaryHex: "#7C3AED",
        gradientClass: "from-purple-600 via-violet-700 to-slate-950",
        badgeBg: "bg-purple-500/10 text-purple-600 border-purple-500/20",
        accentClass: "text-purple-600 dark:text-purple-400",
        buttonClass: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/25",
        borderClass: "border-purple-500/20",
    },
    teal: {
        label: "Modern Teal",
        primaryHex: "#0D9488",
        gradientClass: "from-teal-600 via-cyan-700 to-slate-900",
        badgeBg: "bg-teal-500/10 text-teal-600 border-teal-500/20",
        accentClass: "text-teal-600 dark:text-teal-400",
        buttonClass: "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/25",
        borderClass: "border-teal-500/20",
    },
};

export const CATEGORY_PRESETS: Record<string, CategoryPreset> = {
    dental: {
        categoryKey: "dental",
        label: "Dental Clinic & Dentistry",
        defaultTheme: "emerald",
        tagline: (name, city) => `Premier Dental Care & Bright Smiles ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Gentle, Modern & Trusted Dental Care ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `Experience pain-free treatments, advanced cosmetic dentistry, and comprehensive oral care for your entire family at ${name}.`,
        aboutTitle: "Committed to Your Healthy, Beautiful Smile",
        aboutDescription: (name, city) => `At ${name}${city ? ` (${city})` : ""}, we combine state-of-the-art dental technology with compassionate, patient-first care. Whether you need routine dental hygiene, emergency pain relief, or smile makeovers, our certified dental specialists are here to ensure a comfortable visit every time.`,
        highlights: [
            "100% Pain-Free & Modern Dental Procedures",
            "Advanced Sterilization & Hygienic Clinic Environment",
            "Specialized Pediatric & Adult Dentistry",
            "Affordable & Transparent Treatment Pricing",
        ],
        services: [
            { id: "s1", title: "Root Canal Treatment (RCT)", description: "Advanced rotary endodontics ensuring quick, painless relief and tooth preservation.", icon: "Sparkles", tag: "Popular" },
            { id: "s2", title: "Teeth Whitening & Scaling", description: "Safe laser whitening and ultrasonic cleaning for a radiant, spot-free smile.", icon: "Star" },
            { id: "s3", title: "Dental Implants & Crowns", description: "Permanent, natural-looking titanium implants and high-strength zirconia crowns.", icon: "ShieldCheck" },
            { id: "s4", title: "Braces & Invisible Aligners", description: "Discreet clear aligners and modern ceramic braces to correct teeth alignment.", icon: "CheckCircle2" },
            { id: "s5", title: "Kids Dental Care", description: "Gentle dental checkups, cavity sealants, and fluoride treatments tailored for children.", icon: "Heart" },
            { id: "s6", title: "Emergency Dental Consultation", description: "Instant pain relief and same-day emergency appointments for dental trauma.", icon: "Zap" },
        ],
        features: [
            { id: "f1", title: "Expert Dental Surgeons", description: "Decade of clinical excellence handling complex restorative cases with care.", icon: "Award" },
            { id: "f2", title: "Digital X-Rays & 3D Scans", description: "Low-radiation high-resolution digital imaging for pinpoint diagnoses.", icon: "Activity" },
            { id: "f3", title: "Instant WhatsApp Booking", description: "Book appointments without waiting in lines with 1-click WhatsApp confirmation.", icon: "MessageSquare" },
            { id: "f4", title: "Clean & Sterile Environment", description: "Hospital-grade multi-tier autoclave sterilization following international standards.", icon: "ShieldCheck" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Rahul Sharma", role: "Local Resident", comment: `Best dental experience at ${name}! The root canal procedure was totally painless and the staff was extremely courteous.`, rating: 5 },
            { id: "t2", name: "Pooja Verma", role: "Patient", comment: `Got my smile makeover done here. Results are amazing, highly recommended for teeth whitening and braces!`, rating: 5 },
            { id: "t3", name: "Amit Srivastava", role: "Family Care", comment: `My kids were always scared of dentists, but the doctor made them feel completely at ease. Very clean clinic.`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I saw your website and would like to book a dental consultation appointment. Please share available timings.`,
    },

    healthcare: {
        categoryKey: "healthcare",
        label: "Hospital, Clinic & Doctor",
        defaultTheme: "teal",
        tagline: (name, city) => `Comprehensive Healthcare & Specialized Medical Services ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Compassionate Healthcare You Can Rely On ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `Dedicated medical specialists, modern diagnostics, and personal patient care under one roof at ${name}.`,
        aboutTitle: "Your Health & Wellness is Our Highest Priority",
        aboutDescription: (name, city) => `Welcome to ${name}. We deliver ethical, high-quality medical treatments tailored to the community ${city ? `of ${city}` : ""}. With experienced doctors, transparent consultations, and comprehensive diagnostic facilities, we are committed to helping you recover faster and live healthier.`,
        highlights: [
            "Experienced Multi-Disciplinary Doctors & Specialists",
            "Emergency Care & Same-Day Priority Appointments",
            "In-House Diagnostic Testing & Health Checkups",
            "Patient-Centered Ethical Healthcare Guidance",
        ],
        services: [
            { id: "s1", title: "General Physician Consultations", description: "Thorough diagnosis and evidence-based treatment plans for acute and chronic conditions.", icon: "HeartPulse", tag: "Essential" },
            { id: "s2", title: "Specialist Care & OPD", description: "Cardiology, Orthopedics, Gynecology, Pediatrics and Internal Medicine consultations.", icon: "Activity" },
            { id: "s3", title: "Preventive Health Checkup Packages", description: "Comprehensive full-body profiles, blood work, ECG and lifestyle health screening.", icon: "ShieldCheck" },
            { id: "s4", title: "Emergency First Aid & Trauma", description: "Equipped to handle urgent medical emergencies with fast triage and skilled nursing care.", icon: "Zap" },
            { id: "s5", title: "Diagnostic Lab & Pathology", description: "Accurate computer-generated test reports delivered directly to your WhatsApp or phone.", icon: "FileText" },
            { id: "s6", title: "Chronic Disease Management", description: "Personalized management for Diabetes, Hypertension, Thyroid, and lifestyle disorders.", icon: "CheckCircle2" },
        ],
        features: [
            { id: "f1", title: "Qualified & Caring Doctors", description: "Board-certified doctors committed to attentive listening and accurate diagnosis.", icon: "Award" },
            { id: "f2", title: "Modern Medical Infrastructure", description: "Equipped with advanced diagnostic monitors and sanitized clinical rooms.", icon: "Building2" },
            { id: "f3", title: "Quick OPD Token & Appointments", description: "Direct WhatsApp support to book time slots and check doctor availability.", icon: "MessageSquare" },
            { id: "f4", title: "Affordable Family Care", description: "Ethical medical guidance with transparent medicine prescriptions and tests.", icon: "ShieldCheck" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Dr. Sandeep Yadav", role: "Patient Family", comment: `Outstanding clinical consultation at ${name}. The doctor spent good time explaining the diagnosis and medicines.`, rating: 5 },
            { id: "t2", name: "Meena Gupta", role: "Regular Patient", comment: `Very hygienic clinic, short waiting times, and friendly nursing staff. Truly thankful for the care!`, rating: 5 },
            { id: "t3", name: "Vikram Rathore", role: "Patient", comment: `Got my complete health checkup done here. Fast report delivery on WhatsApp was super convenient.`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I would like to schedule a doctor consultation. Please share available time slots.`,
    },

    salon: {
        categoryKey: "salon",
        label: "Salon, Spa & Beauty Care",
        defaultTheme: "gold",
        tagline: (name, city) => `Luxury Hair, Skin & Wellness Experience ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Look Stunning, Feel Rejuvenated ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `Unleash your radiant beauty with bespoke styling, premium hair care, and soothing skin therapies at ${name}.`,
        aboutTitle: "Your Sanctuary for Luxury Beauty & Grooming",
        aboutDescription: (name, city) => `At ${name}, we believe self-care is an art. Our certified master stylists and aesthetic experts provide personalized beauty transformations using premium international products, ensuring every visit leaves you glowing with confidence.`,
        highlights: [
            "Certified Master Hair Stylists & Skin Specialists",
            "100% Genuine International Brand Products",
            "Bespoke Bridal & Event Makeover Packages",
            "Sanitized & Luxurious Private Ambience",
        ],
        services: [
            { id: "s1", title: "Hair Styling, Keratin & Botoplex", description: "Trendy designer haircuts, smoothening, keratin treatment, and nourishing hair spa.", icon: "Sparkles", tag: "Trending" },
            { id: "s2", title: "Hydra-Facials & Glow Therapies", description: "Deep pore cleansing, skin brightening, and hydration therapies for radiant glow.", icon: "Star" },
            { id: "s3", title: "Bridal & Party Makeovers", description: "HD and airbrush bridal packages with saree draping and personalized styling.", icon: "Heart" },
            { id: "s4", title: "Luxury Manicure & Pedicure", description: "Soothing scrub, cuticle care, reflexology massage, and long-lasting gel polish.", icon: "CheckCircle2" },
            { id: "s5", title: "Full Body Spa & Massages", description: "Aroma and deep tissue massages to melt away stress and restore vital energy.", icon: "Clock" },
            { id: "s6", title: "Hair Coloring & Balayage", description: "Custom shade formulation, root touchups, and ammonia-free vibrant hair color.", icon: "Zap" },
        ],
        features: [
            { id: "f1", title: "Premium Salon Brands", description: "We use only trusted international formulations for healthy hair and skin.", icon: "Award" },
            { id: "f2", title: "Bespoke Consultations", description: "Free face shape and hair texture assessment before every service.", icon: "Sparkles" },
            { id: "f3", title: "Instant WhatsApp Booking", description: "Check open stylist slots and book your seat in 30 seconds.", icon: "MessageSquare" },
            { id: "f4", title: "Pure Hygiene Standards", description: "Single-use disposable kits and sanitized equipment for every client.", icon: "ShieldCheck" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Sneha Kapoor", role: "Bride", comment: `Got my bridal makeup done at ${name}. Everyone in the wedding complimented the subtle, glowing look!`, rating: 5 },
            { id: "t2", name: "Ananya Mishra", role: "Regular Client", comment: `Best keratin treatment ever! My hair feels so soft and manageable. The ambiance is lovely.`, rating: 5 },
            { id: "t3", name: "Ritu Singhal", role: "Client", comment: `Hydra facial results were instant. Very professional staff and transparent pricing.`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I want to book a salon appointment for hair/skin services. Please let me know available slots.`,
    },

    restaurant: {
        categoryKey: "restaurant",
        label: "Restaurant, Cafe & Dining",
        defaultTheme: "crimson",
        tagline: (name, city) => `Authentic Flavors & Unforgettable Dining ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Savor Culinary Delights Crafted with Passion ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `From sizzling delicacies to cozy cafe bites, indulge in unforgettable taste and heartwarming hospitality at ${name}.`,
        aboutTitle: "Where Authentic Taste Meets Cozy Ambience",
        aboutDescription: (name, city) => `Welcome to ${name}. We celebrate rich culinary traditions using freshly sourced ingredients, handcrafted spice blends, and authentic recipes. Whether it's a family gathering, date night, or private celebration, we promise a memorable feast.`,
        highlights: [
            "Fresh Farm-To-Table Local Ingredients",
            "Master Chefs with Signature Recipe Blends",
            "Cozy, Air-Conditioned Family Dining Ambience",
            "Fast Takeaway & Instant Party Catering",
        ],
        services: [
            { id: "s1", title: "Dine-In & Signature Dishes", description: "Exquisite culinary creations, sizzling appetizers, and decadent main courses.", icon: "Sparkles", tag: "Chef's Special" },
            { id: "s2", title: "Cozy Coffee & Cafe Menu", description: "Artisanal brewed coffees, gourmet shakes, loaded burgers, and oven-fresh pizzas.", icon: "Clock" },
            { id: "s3", title: "Party & Corporate Catering", description: "Customizable buffet menus and live counters for birthdays, weddings, and office events.", icon: "Award" },
            { id: "s4", title: "Takeaway & Quick Parcel", description: "Eco-friendly, spill-proof packaging that retains hot aroma and crunch.", icon: "CheckCircle2" },
            { id: "s5", title: "Private Table Reservations", description: "Pre-book candlelit tables or family booths with advance menu selection.", icon: "Heart" },
            { id: "s6", title: "Handcrafted Desserts", description: "Artisanal pastries, traditional sweets, and creamy ice cream sundaes.", icon: "Star" },
        ],
        features: [
            { id: "f1", title: "100% Quality Guaranteed", description: "Strict hygiene and no artificial additives in our chef-prepared foods.", icon: "ShieldCheck" },
            { id: "f2", title: "Cozy Family Atmosphere", description: "Pleasant music, comfortable seating, and dedicated service staff.", icon: "Building2" },
            { id: "f3", title: "Table Booking on WhatsApp", description: "Reserve your favorite table instantly via WhatsApp message.", icon: "MessageSquare" },
            { id: "f4", title: "Pocket-Friendly Combos", description: "Value lunch meals, family platters, and seasonal culinary festivals.", icon: "Tag" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Alok Tiwari", role: "Food Lover", comment: `The food at ${name} is mind-blowing! Outstanding taste, quick service, and super cozy environment.`, rating: 5 },
            { id: "t2", name: "Priyanka Saxena", role: "Birthday Party Host", comment: `Hosted my daughter's birthday party here. All guests loved the snacks and main course!`, rating: 5 },
            { id: "t3", name: "Mohit Aggarwal", role: "Regular Diner", comment: `Their signature dishes are unmatched. Definitely the best food spot in town!`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I would like to reserve a table / order food. Please share the menu and availability.`,
    },

    realestate: {
        categoryKey: "realestate",
        label: "Real Estate & Property",
        defaultTheme: "sapphire",
        tagline: (name, city) => `Verified Properties & Dream Homes ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Find Your Dream Property with Complete Peace of Mind ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `Explore prime residential flats, luxury villas, commercial plots, and high-ROI investment options with ${name}.`,
        aboutTitle: "Your Trusted Partner in Property Investment",
        aboutDescription: (name, city) => `At ${name}, we take the stress out of buying, selling, or renting properties ${city ? `in ${city}` : ""}. With verified land titles, RERA-approved project partnerships, and transparent negotiations, we help families and investors secure their future.`,
        highlights: [
            "100% RERA Approved & Title-Clear Properties",
            "Zero Hidden Brokerage & Transparent Deals",
            "Free Site Visits with Doorstep Pick & Drop",
            "Complete Home Loan & Legal Registry Assistance",
        ],
        services: [
            { id: "s1", title: "Luxury Flats & Apartments", description: "2BHK, 3BHK and penthouse units in gated townships with modern clubhouse amenities.", icon: "Building2", tag: "Top Choice" },
            { id: "s2", title: "Residential Plots & Land", description: "Clear-title freehold plots in developing corridors with high capital appreciation.", icon: "MapPin" },
            { id: "s3", title: "Commercial Shops & Office Spaces", description: "High-footfall retail outlets and tech-enabled corporate spaces for high rental yields.", icon: "Award" },
            { id: "s4", title: "Independent Villas & Kothis", description: "Custom built designer luxury villas with private gardens and secure boundaries.", icon: "Sparkles" },
            { id: "s5", title: "Legal Title Verification", description: "Complete due-diligence, registry documentation, and mutation assistance.", icon: "ShieldCheck" },
            { id: "s6", title: "Bank Loan Assistance", description: "Tie-ups with leading national banks for fast loan sanctions at lowest interest rates.", icon: "CheckCircle2" },
        ],
        features: [
            { id: "f1", title: "Verified Listings Only", description: "Every project is thoroughly vetted for legal clearances and builder reputation.", icon: "ShieldCheck" },
            { id: "f2", title: "End-to-End Paperwork", description: "From site visit to final registry keys, our legal team guides you all the way.", icon: "FileText" },
            { id: "f3", title: "Schedule Free Site Visit", description: "Instant WhatsApp coordination for personalized property inspections.", icon: "MessageSquare" },
            { id: "f4", title: "High Rental Return (ROI)", description: "Strategic market insights to help you maximize your real estate wealth.", icon: "Star" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Rameshwar Dayal", role: "Home Buyer", comment: `Bought our first dream 3BHK through ${name}. Transparent process and seamless bank loan support!`, rating: 5 },
            { id: "t2", name: "Manish Pandey", role: "Investor", comment: `Got a great plot deal with verified papers. Their team provided honest advice without any pressure.`, rating: 5 },
            { id: "t3", name: "Deepak Rastogi", role: "Property Owner", comment: `Sold my commercial space within 3 weeks at a fair market price. Highly professional!`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I am interested in property listings. Please share available options and arrange a site visit.`,
    },

    education: {
        categoryKey: "education",
        label: "Education, Coaching & Classes",
        defaultTheme: "violet",
        tagline: (name, city) => `Excellence in Learning & Career Success ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Empower Your Future with Quality Education ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `Interactive learning, expert mentorship, and comprehensive test series to help students achieve top ranks at ${name}.`,
        aboutTitle: "Nurturing Talent & Building Confident Careers",
        aboutDescription: (name, city) => `At ${name}, we believe every student has the potential to excel. Our structured curriculum, experienced faculty, and rigorous doubt-clearing sessions build deep conceptual clarity and confidence to crack competitive exams and academic milestones.`,
        highlights: [
            "Highly Qualified & Proven Faculty Team",
            "Small Batch Sizes for Individual Mentorship",
            "Comprehensive Study Material & Mock Test Series",
            "Regular Parent-Teacher Progress Feedback",
        ],
        services: [
            { id: "s1", title: "Foundation & Board Exam Classes", description: "Strengthen basics in Mathematics, Science and English for top board results.", icon: "Star", tag: "Popular" },
            { id: "s2", title: "Competitive Exam Preparation", description: "Targeted coaching with shortcut problem-solving techniques and time management.", icon: "Award" },
            { id: "s3", title: "Weekly Mock Tests & Performance Analysis", description: "Exam-pattern mock tests with AI-powered weakness diagnosis and score tracking.", icon: "Activity" },
            { id: "s4", title: "Personalized 1-on-1 Doubt Sessions", description: "Dedicated hours every week to clear concepts and solve difficult textbook problems.", icon: "CheckCircle2" },
            { id: "s5", title: "Digital Study Modules & Notes", description: "Concise summary notes, formula sheets, and chapter-wise question banks.", icon: "Sparkles" },
            { id: "s6", title: "Career Counseling & Guidance", description: "Expert seminars on stream selection, college admissions, and competitive exam roadmaps.", icon: "Heart" },
        ],
        features: [
            { id: "f1", title: "Proven Track Record", description: "Hundreds of successful students placed in prestigious colleges and exams.", icon: "Award" },
            { id: "f2", title: "Modern Air-Conditioned Classrooms", description: "Interactive smart boards, library, and peaceful learning atmosphere.", icon: "Building2" },
            { id: "f3", title: "Free Demo Class on WhatsApp", description: "Book a complimentary trial class right away to experience our teaching methodology.", icon: "MessageSquare" },
            { id: "f4", title: "Affordable Fee Structures", description: "Merit scholarships and easy installment plans for deserving students.", icon: "ShieldCheck" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Kunal Bansal", role: "Student", comment: `The teaching methodology at ${name} cleared all my doubts in Physics & Maths. Scored 96% in boards!`, rating: 5 },
            { id: "t2", name: "Suman Joshi", role: "Parent", comment: `Very dedicated teachers. They give personal attention to every student and keep parents informed.`, rating: 5 },
            { id: "t3", name: "Aarav Mishra", role: "Exam Ranker", comment: `The mock test series simulated the real exam perfectly. Thank you for the constant motivation!`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I am interested in course admissions. Please share batch details, fee structure, and book a free demo class.`,
    },

    legal: {
        categoryKey: "legal",
        label: "Law Firm, Advocate & Legal Services",
        defaultTheme: "sapphire",
        tagline: (name, city) => `Trusted Legal Counsel & Strategic Representation ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Expert Legal Protection for Your Rights & Business ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `Confidential consultations, meticulous legal drafting, and aggressive courtroom advocacy with ${name}.`,
        aboutTitle: "Committed to Justice, Integrity & Client Success",
        aboutDescription: (name, city) => `At ${name}, we provide clear, strategic, and practical legal advice. Whether navigating civil disputes, corporate compliance, property documentation, or criminal defense, our legal team ensures your rights are protected with utmost professionalism.`,
        highlights: [
            "Extensive Courtroom & Dispute Resolution Experience",
            "Complete Client Confidentiality & Ethical Standards",
            "Fast & Legally Airtight Agreement Drafting",
            "Transparent Consultation & Case Assessment",
        ],
        services: [
            { id: "s1", title: "Civil & Property Disputes", description: "Land dispute litigation, injunctions, partition suits, and builder-buyer grievances.", icon: "ShieldCheck", tag: "Core Practice" },
            { id: "s2", title: "Corporate & Business Compliance", description: "Company incorporation, founder agreements, vendor contracts, and NDAs.", icon: "Building2" },
            { id: "s3", title: "Legal Drafting & Notice Issuance", description: "Legal notices, sale deeds, lease deeds, wills, power of attorney, and affidavits.", icon: "FileText" },
            { id: "s4", title: "Family & Matrimonial Law", description: "Compassionate counsel in divorce, child custody, maintenance, and mutual settlements.", icon: "Heart" },
            { id: "s5", title: "Criminal Defense & Bail", description: "Urgent anticipatory bail applications and diligent trial representation.", icon: "Award" },
            { id: "s6", title: "Cheque Bounce & Debt Recovery", description: "Fast-track legal notices and Section 138 NI Act proceedings for pending dues.", icon: "Zap" },
        ],
        features: [
            { id: "f1", title: "Seasoned Legal Minds", description: "Proven history of successful courtroom verdicts and out-of-court settlements.", icon: "Award" },
            { id: "f2", title: "100% Confidential Guidance", description: "Your matters and trade secrets are safeguarded with strict privilege.", icon: "ShieldCheck" },
            { id: "f3", title: "Confidential WhatsApp Consultation", description: "Connect directly to schedule an in-person or virtual case assessment.", icon: "MessageSquare" },
            { id: "f4", title: "Straightforward Pricing", description: "Clear fee structure without unexpected legal overheads.", icon: "CheckCircle2" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Vinod Chand", role: "Business Owner", comment: `Handled our corporate contract negotiations seamlessly. Outstanding legal acumen!`, rating: 5 },
            { id: "t2", name: "Sunil K.", role: "Property Owner", comment: `Helped resolve a prolonged family property issue with great tact and legal precision. Highly recommended.`, rating: 5 },
            { id: "t3", name: "Neeraj Singla", role: "Client", comment: `Prompt, honest, and very sharp advocate. Got quick relief in my commercial litigation.`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I need legal advice regarding a matter. Can we schedule a confidential consultation?`,
    },

    fitness: {
        categoryKey: "fitness",
        label: "Gym, Fitness & Yoga",
        defaultTheme: "crimson",
        tagline: (name, city) => `Transform Your Body & Elevate Your Energy ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Your Ultimate Fitness & Transformation Hub ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `State-of-the-art strength equipment, certified personal trainers, and custom diet plans to help you achieve your dream physique at ${name}.`,
        aboutTitle: "Build Strength, Stamina & Unstoppable Confidence",
        aboutDescription: (name, city) => `Welcome to ${name}. We are more than just a gym — we are a community dedicated to healthier living. With premium imported machines, energizing group fitness classes, and certified nutritionists, we guide you on every step of your fitness journey.`,
        highlights: [
            "Imported Biomechanical Strength & Cardio Machines",
            "Certified Trainers for Custom Transformation Goals",
            "Personalized Diet Plans & Body Composition Scans",
            "Clean, Sanitized & High-Energy Workout Environment",
        ],
        services: [
            { id: "s1", title: "Weight Loss & Fat Burn Transformation", description: "HIIT workouts and caloric deficit diet protocols designed for rapid, sustainable fat loss.", icon: "Zap", tag: "Popular" },
            { id: "s2", title: "Muscle Building & Strength Training", description: "Heavy compound lifting, progressive overload routines, and powerlifting zones.", icon: "Award" },
            { id: "s3", title: "Personal Training (1-on-1)", description: "Dedicated coach to ensure perfect form, prevent injury, and maximize gains.", icon: "Star" },
            { id: "s4", title: "Yoga & Flexibility Classes", description: "Calming morning sessions to increase joint mobility, core balance, and mental focus.", icon: "Heart" },
            { id: "s5", title: "Zumba & Aerobics Dance Fitness", description: "High-energy cardio workouts set to upbeat music that burns up to 600 calories an hour.", icon: "Sparkles" },
            { id: "s6", title: "Nutrition & Supplement Counseling", description: "Science-backed diet planning tailored to your exact metabolic rate and routine.", icon: "CheckCircle2" },
        ],
        features: [
            { id: "f1", title: "Elite Fitness Coaches", description: "CPR and ACE certified coaches with real transformation credentials.", icon: "Award" },
            { id: "f2", title: "Spacious Workout Floors", description: "Separate cardio deck, free weights section, and crossfit training rigs.", icon: "Building2" },
            { id: "f3", title: "Free 1-Day Trial on WhatsApp", description: "Get your complimentary day pass by sending a quick WhatsApp message.", icon: "MessageSquare" },
            { id: "f4", title: "Flexible Membership Plans", description: "Quarterly, half-yearly and annual memberships with pause facilities.", icon: "Tag" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Varun Malhotra", role: "Member (Lost 14kg)", comment: `Joining ${name} was the best decision of my life! Lost 14kg in 4 months with their trainer's guidance.`, rating: 5 },
            { id: "t2", name: "Simran Kaur", role: "Fitness Enthusiast", comment: `Super clean gym, great music, and friendly staff. The women-friendly workout environment is top notch!`, rating: 5 },
            { id: "t3", name: "Akash Dixit", role: "Powerlifter", comment: `Proper Olympic barbells and heavy dumbbells. Perfect spot for serious lifters.`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I want to join the gym / try a free workout session. Please share membership packages.`,
    },

    agency: {
        categoryKey: "agency",
        label: "Digital Marketing, IT & Agency",
        defaultTheme: "violet",
        tagline: (name, city) => `Innovative Software & Scalable Digital Growth ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Accelerate Your Business with Modern Digital Solutions ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `High-converting websites, WhatsApp automation, targeted lead generation, and custom software crafted by ${name}.`,
        aboutTitle: "We Build Digital Experiences That Drive Revenue",
        aboutDescription: (name, city) => `At ${name}, we bridge strategy, technology, and design to help businesses stand out and scale. From engaging mobile-friendly websites to automated WhatsApp communication engines and ROI-driven marketing, we deliver measurable results.`,
        highlights: [
            "End-to-End Modern Web & Mobile Development",
            "Automated WhatsApp Gateway & CRM Integration",
            "High-ROI Performance Marketing & SEO",
            "Fast Turnaround with Dedicated Project Support",
        ],
        services: [
            { id: "s1", title: "Custom Website & Web App Development", description: "Ultra-fast, mobile-responsive websites built for maximum conversion and speed.", icon: "Sparkles", tag: "Featured" },
            { id: "s2", title: "WhatsApp Gateway & Lead Automation", description: "Automated chatbot replies, lead capture forms, and bulk broadcast engines.", icon: "MessageSquare" },
            { id: "s3", title: "Google & Meta Paid Advertising", description: "Targeted PPC campaigns designed to deliver qualified inbound leads at low acquisition costs.", icon: "Zap" },
            { id: "s4", title: "Search Engine Optimization (SEO)", description: "On-page, technical and local Google My Business SEO to dominate search results.", icon: "Star" },
            { id: "s5", title: "UI/UX & Brand Identity Design", description: "Modern logo branding, vector illustrations, and interactive Figma prototypes.", icon: "Heart" },
            { id: "s6", title: "E-Commerce & Payment Integration", description: "Full-featured online stores integrated with UPI, cards, and automated order tracking.", icon: "CheckCircle2" },
        ],
        features: [
            { id: "f1", title: "ROI-Focused Delivery", description: "Every project is measured against real revenue, inquiries, and customer growth.", icon: "Award" },
            { id: "f2", title: "Cutting-Edge Tech Stack", description: "Modern Next.js, React, Node.js and cloud infrastructure built to scale.", icon: "Building2" },
            { id: "f3", title: "Instant Project Quote on WhatsApp", description: "Share your requirement and get a tailored proposal within 2 hours.", icon: "MessageSquare" },
            { id: "f4", title: "Transparent Milestones", description: "Clear delivery timelines with weekly sprint demos and source code ownership.", icon: "ShieldCheck" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Gaurav Chawla", role: "E-commerce Founder", comment: `${name} delivered our online store in record time! Our sales skyrocketed after launching the mobile-friendly site.`, rating: 5 },
            { id: "t2", name: "Tanvi Mathur", role: "Clinic Director", comment: `The WhatsApp automation setup doubled our patient bookings without adding any extra staff. Incredible work!`, rating: 5 },
            { id: "t3", name: "Harish Nambiar", role: "Startup CEO", comment: `Sharp, knowledgeable, and reliable team. They understand business, not just code.`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I am looking for a website / digital marketing solution for my business. Can we discuss?`,
    },

    general: {
        categoryKey: "general",
        label: "General Business & Retail",
        defaultTheme: "emerald",
        tagline: (name, city) => `Quality Products, Reliable Service & Customer First ${city ? `in ${city}` : ""}`,
        headline: (name, city) => `Your Trusted Partner for Quality & Reliable Service ${city ? `in ${city}` : ""}`,
        subheadline: (name, city) => `Discover genuine quality, unmatched pricing, and fast customer assistance with ${name}.`,
        aboutTitle: "Delivering Excellence with Integrity & Trust",
        aboutDescription: (name, city) => `Welcome to ${name}${city ? ` in ${city}` : ""}. With years of commitment to customer satisfaction, we offer premium products and reliable services designed to fulfill your needs. Experience unmatched reliability, transparent deals, and personalized support.`,
        highlights: [
            "100% Genuine Products & Reliable Service",
            "Affordable & Competitive Market Pricing",
            "Instant Customer Support on WhatsApp",
            "Trusted by Hundreds of Satisfied Clients",
        ],
        services: [
            { id: "s1", title: "Premium Quality Offerings", description: "Curated products and services designed to meet the highest industry standards.", icon: "Star", tag: "Best Value" },
            { id: "s2", title: "Doorstep Delivery & Fast Dispatch", description: "Carefully packed shipments and expedited delivery right to your location.", icon: "Zap" },
            { id: "s3", title: "Personalized Customer Consultation", description: "Friendly experts ready to help you select the exact product or solution you need.", icon: "Heart" },
            { id: "s4", title: "After-Sales & Warranty Support", description: "Dedicated customer service team to resolve inquiries and ensure 100% satisfaction.", icon: "ShieldCheck" },
            { id: "s5", title: "Bulk & Commercial Inquiries", description: "Special wholesale rates, custom packaging, and flexible payment terms for businesses.", icon: "Award" },
            { id: "s6", title: "Instant WhatsApp Ordering", description: "Browse catalog and place orders directly with one tap on WhatsApp.", icon: "MessageSquare" },
        ],
        features: [
            { id: "f1", title: "Verified Business", description: "Years of reliable service with glowing reviews from loyal customers.", icon: "ShieldCheck" },
            { id: "f2", title: "Transparent Pricing", description: "No hidden charges, fair estimates, and clear invoice receipts.", icon: "CheckCircle2" },
            { id: "f3", title: "Instant WhatsApp Chat", description: "Chat directly with our manager for queries, bookings, and instant discounts.", icon: "MessageSquare" },
            { id: "f4", title: "Quality Guarantee", description: "We stand firmly behind everything we offer with responsive support.", icon: "Star" },
        ],
        testimonials: (name) => [
            { id: "t1", name: "Suresh Chandra", role: "Customer", comment: `Excellent service by ${name}! Very polite staff and quick response on WhatsApp. 10/10 experience!`, rating: 5 },
            { id: "t2", name: "Kavita Rao", role: "Loyal Buyer", comment: `Always dependable. The quality of their service is top-notch. Would definitely recommend to everyone.`, rating: 5 },
            { id: "t3", name: "Imran Khan", role: "Client", comment: `Fair pricing, honest guidance, and fast delivery. Very pleased with their work!`, rating: 5 },
        ],
        whatsappGreeting: (name) => `Hello ${name}, I am interested in your services / products. Please share more details.`,
    },
};

/**
 * Intelligent category matcher to find the best preset based on business category string
 */
export function matchCategoryPreset(categoryStr?: string, nameStr?: string): CategoryPreset {
    const combined = `${categoryStr || ""} ${nameStr || ""}`.toLowerCase();

    if (combined.includes("dental") || combined.includes("dentist") || combined.includes("teeth") || combined.includes("oral") || combined.includes("orthodont")) {
        return CATEGORY_PRESETS.dental;
    }
    if (combined.includes("hospital") || combined.includes("clinic") || combined.includes("doctor") || combined.includes("health") || combined.includes("medical") || combined.includes("pharma")) {
        return CATEGORY_PRESETS.healthcare;
    }
    if (combined.includes("salon") || combined.includes("spa") || combined.includes("beauty") || combined.includes("parlour") || combined.includes("hair") || combined.includes("makeup") || combined.includes("nail")) {
        return CATEGORY_PRESETS.salon;
    }
    if (combined.includes("restaurant") || combined.includes("cafe") || combined.includes("food") || combined.includes("dining") || combined.includes("kitchen") || combined.includes("hotel") || combined.includes("bakery") || combined.includes("sweet")) {
        return CATEGORY_PRESETS.restaurant;
    }
    if (combined.includes("estate") || combined.includes("property") || combined.includes("builder") || combined.includes("plot") || combined.includes("flat") || combined.includes("housing") || combined.includes("villa")) {
        return CATEGORY_PRESETS.realestate;
    }
    if (combined.includes("class") || combined.includes("coaching") || combined.includes("school") || combined.includes("academy") || combined.includes("institute") || combined.includes("tuition") || combined.includes("education")) {
        return CATEGORY_PRESETS.education;
    }
    if (combined.includes("advocate") || combined.includes("legal") || combined.includes("law") || combined.includes("attorney") || combined.includes("solicitor")) {
        return CATEGORY_PRESETS.legal;
    }
    if (combined.includes("gym") || combined.includes("fitness") || combined.includes("workout") || combined.includes("yoga") || combined.includes("crossfit")) {
        return CATEGORY_PRESETS.fitness;
    }
    if (combined.includes("digital") || combined.includes("software") || combined.includes("tech") || combined.includes("agency") || combined.includes("marketing") || combined.includes("it ") || combined.includes("web")) {
        return CATEGORY_PRESETS.agency;
    }

    return CATEGORY_PRESETS.general;
}
