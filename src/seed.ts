import {
  db,
  outletsTable,
  bannersTable,
  menuItemsTable,
  galleryImagesTable,
  siteInfoTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";

const OUTLETS = [
  {
    slug: "atoz-bar-wine-brasserie",
    name: "AtoZ Bar Wine & Brasserie",
    tagline: "Refined wine and small plates",
    description:
      "An intimate brasserie with a sommelier-led wine program and seasonal small plates from a wood-fired hearth.",
    address: "12 Vine Lane",
    phone: "+1 (555) 010-1001",
    hours: "Tue–Sun · 5pm–late",
    cuisine: "European · Wine Bar",
    accentColor: "#7a1f2b",
    sortOrder: 1,
  },
  {
    slug: "bosa-restaurant",
    name: "Bosa Restaurant",
    tagline: "Modern South Asian fine dining",
    description:
      "A tasting-menu journey through coastal South Asia, reimagined with modern technique and theatre.",
    address: "44 Marigold Street",
    phone: "+1 (555) 010-1002",
    hours: "Wed–Sun · 6pm–11pm",
    cuisine: "Modern South Asian",
    accentColor: "#c2410c",
    sortOrder: 2,
  },
  {
    slug: "bodega-all-day-dining",
    name: "Bodega All Day Dining",
    tagline: "Sun-up to sundown comfort",
    description:
      "A laid-back all-day cafe pouring single-origin coffee in the morning and natural wine after dark.",
    address: "9 Almond Court",
    phone: "+1 (555) 010-1003",
    hours: "Daily · 7am–11pm",
    cuisine: "Cafe · All-Day",
    accentColor: "#a16207",
    sortOrder: 3,
  },
  {
    slug: "lakers-by-atoz",
    name: "Lakers By AtoZ",
    tagline: "Lakeside seafood, slow afternoons",
    description:
      "A breezy lakeside pavilion known for whole grilled fish, crudo, and gin-forward sundowners.",
    address: "Pier 7, North Lake Promenade",
    phone: "+1 (555) 010-1004",
    hours: "Daily · 12pm–11pm",
    cuisine: "Coastal · Seafood",
    accentColor: "#0e7490",
    sortOrder: 4,
  },
  {
    slug: "redhare",
    name: "Redhare",
    tagline: "Cocktail-forward gastropub",
    description:
      "A dimly lit gastropub with a 40-strong cocktail list and a kitchen that takes pub food seriously.",
    address: "88 Carmine Street",
    phone: "+1 (555) 010-1005",
    hours: "Daily · 4pm–2am",
    cuisine: "Gastropub · Cocktails",
    accentColor: "#9f1239",
    sortOrder: 5,
  },
  {
    slug: "district5",
    name: "District5",
    tagline: "Industrial-chic global fusion",
    description:
      "A warehouse dining room where Mediterranean, East Asian, and Latin American ideas share the pass.",
    address: "5 Foundry Walk",
    phone: "+1 (555) 010-1006",
    hours: "Tue–Sun · 5:30pm–midnight",
    cuisine: "Global Fusion",
    accentColor: "#3f3f46",
    sortOrder: 6,
  },
  {
    slug: "infinity",
    name: "Infinity",
    tagline: "Rooftop fine dining",
    description:
      "A rooftop counter with a single nightly tasting menu, an open kitchen, and an unbroken city skyline.",
    address: "Roof, 200 Cedar Tower",
    phone: "+1 (555) 010-1007",
    hours: "Thu–Sun · 7pm–11pm",
    cuisine: "Tasting · Fine Dining",
    accentColor: "#1e293b",
    sortOrder: 7,
  },
  {
    slug: "oombee",
    name: "Oombee",
    tagline: "Playful Asian street food",
    description:
      "A loud, joyful canteen pulling from Bangkok, Saigon, Penang and Seoul — eat with your hands.",
    address: "23 Ribbon Alley",
    phone: "+1 (555) 010-1008",
    hours: "Daily · 11am–11pm",
    cuisine: "Asian Street Food",
    accentColor: "#15803d",
    sortOrder: 8,
  },
  {
    slug: "shiraz",
    name: "Shiraz",
    tagline: "Persian-Mediterranean kitchen",
    description:
      "A sun-soaked kitchen built around saffron, charcoal, and shareable platters from the Levant to Esfahan.",
    address: "31 Saffron Square",
    phone: "+1 (555) 010-1009",
    hours: "Tue–Sun · 12pm–11pm",
    cuisine: "Persian · Mediterranean",
    accentColor: "#b45309",
    sortOrder: 9,
  },
];

const BANNERS = [
  {
    title: "Nine kitchens. One table.",
    subtitle:
      "Avenue Hospitality Group — a collection of nine distinct restaurants across the city.",
    imagePath: "/public-objects/seed/banner-1.jpg",
    ctaLabel: "Explore the outlets",
    ctaHref: "/#outlets",
    sortOrder: 1,
    active: true,
  },
  {
    title: "An evening with us",
    subtitle: "Tasting menus, sommelier picks, and rooftop sundowners.",
    imagePath: "/public-objects/seed/banner-2.jpg",
    ctaLabel: "See tonight's menu",
    ctaHref: "/menu",
    sortOrder: 2,
    active: true,
  },
  {
    title: "From the hearth",
    subtitle: "Wood-fired, hand-finished, served the moment it's ready.",
    imagePath: "/public-objects/seed/banner-3.jpg",
    ctaLabel: "Visit the gallery",
    ctaHref: "/gallery",
    sortOrder: 3,
    active: true,
  },
];

const SAMPLE_MENU_BY_SLUG: Record<string, Array<{ category: string; name: string; description: string; price: string; featured?: boolean }>> = {
  "atoz-bar-wine-brasserie": [
    { category: "Small Plates", name: "Hearth Sourdough", description: "Cultured butter, smoked salt", price: "$9", featured: true },
    { category: "Small Plates", name: "Beef Tartare", description: "Cured yolk, crisp shallot, rye", price: "$22" },
    { category: "Mains", name: "Wood-Fired Lamb Shoulder", description: "Salsa verde, white bean", price: "$48", featured: true },
    { category: "Wine", name: "Sommelier's Flight", description: "Three pours selected nightly", price: "$28" },
  ],
  "bosa-restaurant": [
    { category: "First", name: "Saffron Kingfish", description: "Toasted coconut, lime leaf oil", price: "$24", featured: true },
    { category: "Main", name: "Charred Duck Biryani", description: "Smoked basmati, burnt onion", price: "$42" },
    { category: "Tasting", name: "Bosa Eight-Course", description: "Chef's nightly journey", price: "$135", featured: true },
  ],
  "bodega-all-day-dining": [
    { category: "Morning", name: "Bodega Bowl", description: "Soft eggs, avocado, harissa, sourdough", price: "$16", featured: true },
    { category: "Coffee", name: "Single-Origin Pour-Over", description: "Rotating roasters, 200ml", price: "$6" },
    { category: "Evening", name: "Natural Wine Flight", description: "Three glasses, low-intervention", price: "$24" },
  ],
  "lakers-by-atoz": [
    { category: "Raw", name: "Yellowfin Crudo", description: "Pickled fennel, citrus, olive oil", price: "$26", featured: true },
    { category: "Grill", name: "Whole Grilled Sea Bream", description: "Lemon, sea salt, herbs", price: "$58" },
    { category: "Sundowners", name: "Lakeside Negroni", description: "Italian aperitivo, served by the water", price: "$18" },
  ],
  "redhare": [
    { category: "Cocktails", name: "Smoked Old Fashioned", description: "Cherrywood, bourbon, orange", price: "$19", featured: true },
    { category: "Bar Food", name: "Truffle Beef Slider Trio", description: "Aged cheddar, pickle", price: "$24" },
    { category: "Mains", name: "Stout-Braised Short Rib", description: "Buttermilk mash, jus", price: "$38" },
  ],
  "district5": [
    { category: "Snacks", name: "Charred Octopus Tacos", description: "Black bean, salsa macha", price: "$22" },
    { category: "Mains", name: "Miso-Glazed Lamb Rack", description: "Pomegranate, sumac yogurt", price: "$54", featured: true },
    { category: "Sweet", name: "Olive Oil Cake", description: "Saffron cream, candied citrus", price: "$14" },
  ],
  "infinity": [
    { category: "Tasting", name: "Infinity Tasting Menu", description: "Twelve courses, nightly", price: "$220", featured: true },
    { category: "Pairing", name: "Sommelier Wine Pairing", description: "Eight pours, biodynamic-leaning", price: "$165" },
    { category: "Bar", name: "Aperitivo at the Pass", description: "Three bites + signature spritz", price: "$45" },
  ],
  "oombee": [
    { category: "Street", name: "Crispy Pork Banh Mi", description: "Pickled daikon, herbs, chili mayo", price: "$15", featured: true },
    { category: "Wok", name: "Drunken Noodles", description: "Holy basil, chili, choice of protein", price: "$19" },
    { category: "Cold", name: "Mango Sticky Rice", description: "Coconut cream, toasted sesame", price: "$11" },
  ],
  "shiraz": [
    { category: "Mezze", name: "Saffron Hummus", description: "Warm flatbread, smoked oil", price: "$14" },
    { category: "Charcoal", name: "Joojeh Chicken Skewers", description: "Saffron, lemon, sumac", price: "$26", featured: true },
    { category: "Rice", name: "Tahdig Crown", description: "Crispy saffron rice, barberry, pistachio", price: "$22" },
  ],
};

const GALLERY = [
  { imagePath: "/public-objects/seed/gallery-1.jpg", caption: "An evening on the rooftop", sortOrder: 1 },
  { imagePath: "/public-objects/seed/gallery-2.jpg", caption: "Wood-fired hearth at AtoZ", sortOrder: 2 },
  { imagePath: "/public-objects/seed/gallery-3.jpg", caption: "Lakers, sundown service", sortOrder: 3 },
  { imagePath: "/public-objects/seed/gallery-4.jpg", caption: "Bosa tasting menu plating", sortOrder: 4 },
  { imagePath: "/public-objects/seed/gallery-5.jpg", caption: "Behind the pass at District5", sortOrder: 5 },
  { imagePath: "/public-objects/seed/gallery-6.jpg", caption: "Late nights at Redhare", sortOrder: 6 },
];

async function main() {
  logger.info("Seeding restaurant data");

  const [siteInfoExisting] = await db.select().from(siteInfoTable).limit(1);
  if (!siteInfoExisting) {
    await db.insert(siteInfoTable).values({
      brandName: "Avenue Hospitality Group",
      tagline: "Nine kitchens. One table.",
      about:
        "Avenue Hospitality Group brings together nine distinct restaurants across the city — from intimate wine brasseries to rooftop tasting counters.",
      contactEmail: "hello@avenuehg.example",
      contactPhone: "+1 (555) 010-0000",
      instagramUrl: "https://instagram.com/avenuehg",
    });
    logger.info("Inserted site_info");
  } else {
    logger.info("site_info already present, skipping");
  }

  const [{ count: outletCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(outletsTable);
  if (outletCount === 0) {
    await db.insert(outletsTable).values(OUTLETS);
    const inserted = await db.select().from(outletsTable);
    logger.info({ n: inserted.length }, "Inserted outlets");

    const slugToId = new Map(inserted.map((o) => [o.slug, o.id]));
    const menuRows: (typeof menuItemsTable.$inferInsert)[] = [];
    for (const slug of Object.keys(SAMPLE_MENU_BY_SLUG)) {
      const outletId = slugToId.get(slug);
      if (!outletId) continue;
      const items = SAMPLE_MENU_BY_SLUG[slug]!;
      items.forEach((it, i) => {
        menuRows.push({
          outletId,
          category: it.category,
          name: it.name,
          description: it.description,
          price: it.price,
          featured: it.featured ?? false,
          sortOrder: i,
        });
      });
    }
    if (menuRows.length > 0) {
      await db.insert(menuItemsTable).values(menuRows);
      logger.info("Inserted menu items");
    }
  } else {
    logger.info({ outletCount }, "Outlets already present, skipping outlet+menu seed");
  }

  const [{ count: bannerCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(bannersTable);
  if (bannerCount === 0) {
    await db.insert(bannersTable).values(BANNERS);
    logger.info("Inserted banners");
  } else {
    logger.info({ bannerCount }, "Banners already present, skipping");
  }

  const [{ count: galleryCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(galleryImagesTable);
  if (galleryCount === 0) {
    await db.insert(galleryImagesTable).values(GALLERY);
    logger.info("Inserted gallery images");
  } else {
    logger.info({ galleryCount }, "Gallery already present, skipping");
  }

  logger.info("Seed complete");
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
