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

export const HEALTH_DISCLAIMER = "These numbers are estimates for healthy adults, not medical advice. Ask a doctor or registered dietitian before changing how you eat, especially if you're pregnant, nursing, under 18 or have a health condition.";
