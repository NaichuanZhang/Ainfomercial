// Seed two fictional competitor campaigns so the open auction has rivals.
// Usage: node --env-file=.env.local scripts/seed-competitors.mjs
import { createAdminClient } from "@insforge/sdk";

const admin = createAdminClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
  apiKey: process.env.INSFORGE_API_KEY,
});
const base = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/storage/buckets/product-images/objects/`;
const img = (name) => ({ url: `${base}demo%2F${name}.png`, key: `demo/${name}.png` });

const campaigns = [
  {
    brand: "CloudStep",
    product_name: "CloudStep Runner",
    tagline: "Run on a cloud. Land like a feather.",
    price: "$89.99",
    compare_at_price: "$119.99",
    look: "White knit-mesh running shoe with a coral side stripe and a thick, bubbly foam midsole.",
    taste: "Soft, bouncy cushioning with a breathable, sock-like upper.",
    facts: [
      { label: "Weight", value: "7.8 oz (men's 9)" },
      { label: "Drop", value: "6 mm" },
      { label: "Upper", value: "Recycled knit mesh" },
      { label: "Sizes", value: "Men's 7-14, women's 5-12" },
    ],
    beats: [
      "The smiling host in the teal suit and gold tie gestures toward the white running shoe on the glossy black studio counter and talks excitedly to the camera, warm spotlight, slow push-in, medium shot.",
      "The smiling host in the teal suit and gold tie presses his palm down on the shoe's thick foam sole and it springs back, close-up on the sole under the warm spotlight.",
      "The smiling host in the teal suit and gold tie lifts the white running shoe and turns it slowly in the spotlight to show the knit mesh upper, medium close-up.",
      "The smiling host in the teal suit and gold tie bends the shoe gently in both hands to show how flexible it is, nodding at the camera, static medium shot.",
      "The smiling host in the teal suit and gold tie sets the shoe back on the counter and spreads his arms toward it, beaming, studio lights twinkling behind him, slow orbit.",
    ],
    audio_prompt: "Soft, low retro TV-shopping background music with soft sneaker squeaks.",
    bid_per_min: 22,
    budget: 1500,
    ...(() => {
      const p = img("cloudstep-packshot");
      const s = img("cloudstep-host");
      return { image_url: p.url, image_key: p.key, staged_image_url: s.url, staged_image_key: s.key };
    })(),
  },
  {
    brand: "Glow Foods",
    product_name: "Glow Ramen",
    tagline: "Midnight noodles that light up your night.",
    price: "$2.49 / cup",
    compare_at_price: "$3.29",
    look: "Glossy black cup with a neon-orange sunrise-over-a-bowl illustration and chili peppers.",
    taste: "Spicy, savory chili-miso broth with springy wavy noodles.",
    facts: [
      { label: "Ready in", value: "3 minutes" },
      { label: "Spice", value: "Medium-hot" },
      { label: "Serving", value: "1 cup (75 g)" },
    ],
    beats: [
      "The smiling host in the teal suit and gold tie gestures toward the glossy black ramen cup on the studio counter and talks excitedly to the camera, steam rising under the warm spotlight, slow push-in.",
      "The smiling host in the teal suit and gold tie pours boiling water from a kettle into the ramen cup on the counter, steam curling upward, medium close-up.",
      "The smiling host in the teal suit and gold tie lifts springy wavy noodles out of the steaming cup with chopsticks and grins at the camera, slow motion, close-up.",
      "Extreme macro of red chili oil swirling across the ramen broth in the cup on the counter, backlit by golden studio light.",
      "The smiling host in the teal suit and gold tie takes a slurp of noodles and gives a thumbs-up to the camera, studio lights twinkling behind him, static medium shot.",
    ],
    audio_prompt: "Soft, low retro TV-shopping background music with bubbling water and a gentle slurp.",
    bid_per_min: 18,
    budget: 800,
    ...(() => {
      const p = img("glow-packshot");
      const s = img("glow-host");
      return { image_url: p.url, image_key: p.key, staged_image_url: s.url, staged_image_key: s.key };
    })(),
  },
];

for (const campaign of campaigns) {
  const existing = await admin.database.from("campaigns").select("id").eq("product_name", campaign.product_name).limit(1);
  if (existing.error) throw new Error(existing.error.message);
  const result = existing.data?.length
    ? await admin.database.from("campaigns").update(campaign).eq("id", existing.data[0].id).select("id,product_name")
    : await admin.database.from("campaigns").insert([campaign]).select("id,product_name");
  if (result.error) throw new Error(result.error.message);
  console.log("seeded", result.data);
}
