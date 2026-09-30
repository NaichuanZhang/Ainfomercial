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
      "The white running shoe on a glossy black studio counter under a warm spotlight slowly rotates as the camera pushes in and the spotlight brightens.",
      "The shoe's foam sole on the glossy black studio counter under a warm spotlight compresses and springs back, extreme close-up in slow motion.",
      "Extreme macro of the knit mesh upper of the white shoe under the warm spotlight, light passing through the weave.",
      "The white running shoe on the glossy black studio counter under a warm spotlight lifts a few inches and bounces softly back down, camera low.",
      "Hero shot: the white running shoe on the glossy black studio counter under a warm spotlight, camera slowly orbits, studio lights twinkling behind.",
    ],
    audio_prompt: "Upbeat retro 1990s TV shopping jingle with punchy drums and soft sneaker squeaks.",
    bid_per_min: 22,
    budget: 1500,
    ...(() => {
      const p = img("cloudstep-packshot");
      const s = img("cloudstep-studio");
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
      "The black ramen cup on a glossy black studio counter under a warm spotlight glows neon orange as the camera pushes in slowly.",
      "Boiling water pours into the ramen cup on the glossy black studio counter under a warm spotlight, steam curling upward.",
      "Chopsticks lift springy wavy noodles out of the steaming cup under the warm spotlight, slow motion close-up.",
      "Extreme macro of red chili oil swirling across the surface of the ramen broth, backlit by golden studio light.",
      "Hero shot: the steaming black ramen cup on the glossy black studio counter under a warm spotlight, camera slowly orbits.",
    ],
    audio_prompt: "Upbeat retro 1990s TV shopping jingle with sizzling broth and bubbling water.",
    bid_per_min: 18,
    budget: 800,
    ...(() => {
      const p = img("glow-packshot");
      const s = img("glow-studio");
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
