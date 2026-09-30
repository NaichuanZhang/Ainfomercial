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
  staged_image_url: `${base}demo%2Fdiet-coke-studio.png`,
  staged_image_key: "demo/diet-coke-studio.png",
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
    "The chilled silver can slowly rotates on the glossy black studio counter as the warm spotlight brightens, condensation droplets glistening, slow push-in.",
    "Ice cubes tumble onto the counter around the can, cold mist rolling across the glossy surface.",
    "Cola pours from the can into a tall glass full of ice, fizzing bubbles rising, close-up.",
    "Extreme macro of tiny bubbles rising and popping at the surface of dark cola, backlit by golden studio light.",
    "Hero shot: the can and a frosty glass side by side on the counter, camera slowly orbits, studio lights twinkling behind.",
  ],
  audio_prompt: "Upbeat retro 1990s TV shopping jingle with bright synth brass, soda can fizz and ice clinking.",
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
