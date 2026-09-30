// Seed the demo Diet Coke campaign. Usage: node --env-file=.env.local scripts/seed-demo.mjs
import { createAdminClient } from "@insforge/sdk";

const admin = createAdminClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
  apiKey: process.env.INSFORGE_API_KEY,
});
const base = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/storage/buckets/product-images/objects/`;

const campaign = {
  brand: "Coca-Cola",
  product_name: "Diet Coke",
  tagline: "All of the crisp. None of the calories.",
  image_url: `${base}demo%2Fdiet-coke-packshot.png`,
  image_key: "demo/diet-coke-packshot.png",
  staged_image_url: `${base}demo%2Fdiet-coke-pedestal.png`,
  staged_image_key: "demo/diet-coke-pedestal.png",
  price: "$8.99 / 12-pack",
  compare_at_price: "$10.99",
  look: "Silver 12 fl oz can with the red Coca-Cola script and a black 'Diet' wordmark.",
  taste: "Crisp, light cola with a clean, slightly citrusy finish. Bubbly and not syrupy.",
  facts: [
    { label: "Calories", value: "0" },
    { label: "Sugar", value: "0 g" },
    { label: "Caffeine", value: "46 mg per 12 fl oz" },
    { label: "Sweetener", value: "Aspartame" },
    { label: "Size", value: "12 fl oz (355 mL) can" },
  ],
  beats: [
    "The smiling host in the teal suit and gold tie holds the silver Diet Coke can up beside his face behind the glossy black studio counter and beams at the camera with raised eyebrows, warm spotlight, slow push-in, medium shot.",
    "The smiling host in the teal suit and gold tie cracks open the silver can and pours cola into a tall glass of ice on the glossy black counter, fizz racing up the glass, medium close-up.",
    "The smiling host in the teal suit and gold tie lifts the glass, raises it in a toast and nods with a big closed-mouth grin, grinning at the camera under the warm spotlight, static medium shot.",
    "Close-up of the frosty silver can on the glossy black counter beside the glass of fizzing cola as the host's hand sets it down, bubbles rising, shallow depth of field.",
    "The smiling host in the teal suit and gold tie spreads his arms toward the can and the glass on the counter, beaming at the camera, studio lights twinkling behind him, slow orbit.",
  ],
  audio_prompt: "Soft, low retro TV-shopping background music with gentle soda fizz and ice clinking.",
  bid_per_min: 25,
  budget: 2000,
};

const existing = await admin.database.from("campaigns").select("id").eq("product_name", "Diet Coke").limit(1);
if (existing.error) throw new Error(existing.error.message);
const result = existing.data?.length
  ? await admin.database.from("campaigns").update(campaign).eq("id", existing.data[0].id).select("id")
  : await admin.database.from("campaigns").insert([campaign]).select("id");
if (result.error) throw new Error(result.error.message);
console.log("seeded", result.data);
