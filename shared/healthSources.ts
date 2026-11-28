// Where the app's health numbers come from: calorie needs, the pace of weight change, macros, water and activity.
// Shown as "Sources" next to every calorie recommendation (App Review 1.4.1: health information needs citations
// that are easy to find).

export type HealthSource = { id: string; title: string; by: string; url: string; for: string };

export const HEALTH_SOURCES: HealthSource[] = [
  { id: "mifflin", title: "A new predictive equation for resting energy expenditure in healthy individuals", by: "Mifflin MD, St Jeor ST et al. American Journal of Clinical Nutrition, 1990", url: "https://pubmed.ncbi.nlm.nih.gov/2305711/", for: "Calories your body burns at rest (the Mifflin-St Jeor formula)" },
  { id: "dga", title: "Dietary Guidelines for Americans, 2020–2025", by: "U.S. Department of Agriculture and U.S. Department of Health and Human Services", url: "https://www.dietaryguidelines.gov/", for: "Daily calorie needs by age, sex and activity, and the lowest daily calories" },
  { id: "bwp", title: "Body Weight Planner", by: "National Institute of Diabetes and Digestive and Kidney Diseases (NIH)", url: "https://www.niddk.nih.gov/bwp", for: "How many calories change your weight, and how fast" },
  { id: "cdc-pace", title: "Steps for Losing Weight", by: "Centers for Disease Control and Prevention", url: "https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html", for: "A safe pace: about 1 to 2 pounds a week" },
  { id: "dri-macros", title: "Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids", by: "National Academies of Sciences, Engineering, and Medicine", url: "https://nap.nationalacademies.org/catalog/10490", for: "Protein, carb and fat ranges, and activity levels" },
  { id: "dri-water", title: "Dietary Reference Intakes for Water, Potassium, Sodium, Chloride, and Sulfate", by: "National Academies of Sciences, Engineering, and Medicine", url: "https://nap.nationalacademies.org/catalog/10925", for: "Daily water" },
  { id: "pag", title: "Physical Activity Guidelines for Americans", by: "U.S. Department of Health and Human Services", url: "https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines", for: "Activity and exercise goals" },
];

/** Sources for the other health information in the app, by topic. "nutrition" is the list above. */
export type HealthTopic = "nutrition" | "cycle" | "sleep" | "medicine" | "heart" | "screenings" | "mind" | "bmi" | "vitals" | "symptoms";
const MORE: Record<Exclude<HealthTopic, "nutrition">, HealthSource[]> = {
  cycle: [
    { id: "owh-cycle", title: "Your menstrual cycle", by: "Office on Women's Health, U.S. Department of Health and Human Services", url: "https://www.womenshealth.gov/menstrual-cycle/your-menstrual-cycle", for: "Cycle phases, period length, ovulation, PMS and when to see a doctor" },
    { id: "medline-period", title: "Menstruation", by: "MedlinePlus, U.S. National Library of Medicine", url: "https://medlineplus.gov/menstruation.html", for: "Periods, symptoms and discharge" },
  ],
  sleep: [{ id: "cdc-sleep", title: "About Sleep", by: "Centers for Disease Control and Prevention", url: "https://www.cdc.gov/sleep/about/index.html", for: "How much sleep people need and healthy sleep habits" }],
  medicine: [{ id: "medline-drugs", title: "Drugs, Herbs and Supplements", by: "MedlinePlus, U.S. National Library of Medicine", url: "https://medlineplus.gov/druginformation.html", for: "Medicine information. The app only reminds you of the doses you enter; follow your doctor's or pharmacist's directions" }],
  heart: [{ id: "aha-hr", title: "Target Heart Rates Chart", by: "American Heart Association", url: "https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates", for: "Resting and target heart rates" }],
  screenings: [{ id: "uspstf", title: "Recommendation Topics", by: "U.S. Preventive Services Task Force", url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics", for: "Health screenings by age and sex" }],
  bmi: [{ id: "cdc-bmi", title: "About Body Mass Index (BMI)", by: "Centers for Disease Control and Prevention", url: "https://www.cdc.gov/bmi/about/index.html", for: "BMI and the healthy weight range" }],
  vitals: [
    { id: "aha-bp", title: "Understanding Blood Pressure Readings", by: "American Heart Association", url: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings", for: "Blood pressure categories" },
    { id: "medline-vitals", title: "Vital signs", by: "MedlinePlus Medical Encyclopedia, U.S. National Library of Medicine", url: "https://medlineplus.gov/ency/article/002341.htm", for: "Normal heart rate, temperature, breathing and blood oxygen" },
    { id: "cdc-glucose", title: "Diabetes Testing", by: "Centers for Disease Control and Prevention", url: "https://www.cdc.gov/diabetes/diabetes-testing/index.html", for: "Blood sugar ranges" },
  ],
  symptoms: [{ id: "medline-topics", title: "Health Topics", by: "MedlinePlus, U.S. National Library of Medicine", url: "https://medlineplus.gov/healthtopics.html", for: "Common symptoms, what can help and when to see a doctor" }],
  mind: [{ id: "nimh", title: "Mental Health Information", by: "National Institute of Mental Health (NIH)", url: "https://www.nimh.nih.gov/health", for: "Stress, mood and when to get help" }],
};
export const sourcesFor = (topics: HealthTopic[] = ["nutrition"]): HealthSource[] => topics.flatMap((t) => (t === "nutrition" ? HEALTH_SOURCES : MORE[t]));
export const ALL_HEALTH_TOPICS: HealthTopic[] = ["nutrition", "cycle", "sleep", "medicine", "heart", "screenings", "mind", "bmi", "vitals", "symptoms"];

export const GENERAL_DISCLAIMER = "This is general health information, not medical advice. Ask a doctor, nurse or pharmacist about your own health, and call your local emergency number in an emergency.";
export const HEALTH_DISCLAIMER = "These numbers are estimates for healthy adults, not medical advice. Ask a doctor or registered dietitian before changing how you eat, especially if you're pregnant, nursing, under 18 or have a health condition.";
