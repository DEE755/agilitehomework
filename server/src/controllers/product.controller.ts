import type { Request, Response } from 'express';

interface StaticProduct {
  _id:         string;
  slug:        string;
  name:        string;
  category:    string;
  description: string;
  sku:         string;
  price:       number;
  imageUrl:    string;
}

const CATALOG: StaticProduct[] = [
  // ── Clothes ──────────────────────────────────────────────────────────────
  {
    _id: '1', slug: 'tactical-combat-shirt', name: 'Tactical Combat Shirt',
    category: 'Clothes',
    description: 'Lightweight, moisture-wicking combat shirt with reinforced elbows and a hidden zippered chest pocket. Ideal for field operations in warm climates.',
    sku: 'CLO-001', price: 89,
    imageUrl: 'https://images.pexels.com/photos/5699516/pexels-photo-5699516.jpeg?w=600&auto=compress',
  },
  {
    _id: '2', slug: 'ripstop-cargo-pants', name: 'Ripstop Cargo Pants',
    category: 'Clothes',
    description: 'Durable ripstop fabric cargo pants with six reinforced pockets, adjustable waistband, and articulated knees for unrestricted movement.',
    sku: 'CLO-002', price: 119,
    imageUrl: 'https://images.pexels.com/photos/4066288/pexels-photo-4066288.jpeg?w=600&auto=compress',
  },
  {
    _id: '3', slug: 'softshell-field-jacket', name: 'Softshell Field Jacket',
    category: 'Clothes',
    description: 'Wind- and water-resistant softshell jacket with fleece lining, multiple storage pockets, and a low-profile collar. Packable into its own chest pocket.',
    sku: 'CLO-003', price: 189,
    imageUrl: 'https://images.pexels.com/photos/1124466/pexels-photo-1124466.jpeg?w=600&auto=compress',
  },
  {
    _id: '4', slug: 'merino-base-layer', name: 'Merino Wool Base Layer',
    category: 'Clothes',
    description: 'Natural merino wool base layer that regulates body temperature in both cold and warm environments. Odor-resistant and fast-drying.',
    sku: 'CLO-004', price: 74,
    imageUrl: 'https://images.pexels.com/photos/8532616/pexels-photo-8532616.jpeg?w=600&auto=compress',
  },

  // ── Electronics ───────────────────────────────────────────────────────────
  {
    _id: '5', slug: 'tactical-headlamp', name: 'Tactical Headlamp 1000lm',
    category: 'Electronics',
    description: 'High-output 1000-lumen headlamp with red/IR modes, 5 brightness levels, and a rechargeable battery. IPX6 waterproof rated. Runtime up to 200 hours on low.',
    sku: 'ELC-001', price: 69,
    imageUrl: 'https://images.pexels.com/photos/1464625/pexels-photo-1464625.jpeg?w=600&auto=compress',
  },
  {
    _id: '6', slug: 'solar-field-charger', name: 'Solar Field Charger 21W',
    category: 'Electronics',
    description: 'Foldable 21W solar panel with dual USB-A ports and a USB-C PD port. Charges phones, radios, and GPS units directly from sunlight. Weighs only 480 g.',
    sku: 'ELC-002', price: 109,
    imageUrl: 'https://images.pexels.com/photos/9875441/pexels-photo-9875441.jpeg?w=600&auto=compress',
  },
  {
    _id: '7', slug: 'night-vision-monocular', name: 'Night Vision Monocular Gen2',
    category: 'Electronics',
    description: 'Generation-2 image-intensifier monocular with 4× magnification, 100 m detection range, and built-in IR illuminator. Fits standard Picatinny mounts.',
    sku: 'ELC-003', price: 749,
    imageUrl: 'https://images.pexels.com/photos/3945313/pexels-photo-3945313.jpeg?w=600&auto=compress',
  },
  {
    _id: '8', slug: 'rugged-gps-navigator', name: 'Rugged GPS Navigator',
    category: 'Electronics',
    description: 'Mil-spec GPS with 3-inch sunlight-readable display, topo maps, 24-hour battery life, and Bluetooth radio pairing. Drop-tested to MIL-STD-810G.',
    sku: 'ELC-004', price: 299,
    imageUrl: 'https://images.pexels.com/photos/163016/crash-test-collision-60-km-h-163016.jpeg?w=600&auto=compress',
  },

  // ── Footwear ─────────────────────────────────────────────────────────────
  {
    _id: '9', slug: 'desert-combat-boots', name: 'Desert Combat Boots',
    category: 'Shoes',
    description: 'Suede and nylon hybrid boots with cushioned midsole, moisture-wicking lining, and a Vibram outsole. Side-zip for rapid donning and doffing.',
    sku: 'SHO-001', price: 219,
    imageUrl: 'https://images.pexels.com/photos/267301/pexels-photo-267301.jpeg?w=600&auto=compress',
  },
  {
    _id: '10', slug: 'jungle-ops-boots', name: 'Jungle Ops Boots',
    category: 'Shoes',
    description: 'Waterproof jungle boots with drainage ports, anti-puncture midsole, and a grippy lug outsole for wet terrain. Treated against fungal growth.',
    sku: 'SHO-002', price: 179,
    imageUrl: 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?w=600&auto=compress',
  },
  {
    _id: '11', slug: 'low-cut-assault-shoes', name: 'Low-Cut Assault Shoes',
    category: 'Shoes',
    description: 'Lightweight low-cut shoes for fast assault operations. EVA cushioning, abrasion-resistant toe cap, and a non-marking rubber outsole.',
    sku: 'SHO-003', price: 149,
    imageUrl: 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?w=600&auto=compress',
  },

  // ── Furniture / Field Gear ────────────────────────────────────────────────
  {
    _id: '12', slug: 'folding-camp-cot', name: 'Military Folding Camp Cot',
    category: 'Furniture',
    description: 'Heavy-duty steel-frame folding cot rated to 150 kg. Sets up tool-free in under 60 seconds. Includes carry bag. 190 cm sleeping surface.',
    sku: 'FUR-001', price: 129,
    imageUrl: 'https://images.pexels.com/photos/6271625/pexels-photo-6271625.jpeg?w=600&auto=compress',
  },
  {
    _id: '13', slug: 'patrol-folding-table', name: 'Patrol Folding Table',
    category: 'Furniture',
    description: 'Aluminium folding table with adjustable height legs and a MOLLE-compatible skirt for attaching pouches. Folds flat to 5 cm thickness.',
    sku: 'FUR-002', price: 89,
    imageUrl: 'https://images.pexels.com/photos/3209045/pexels-photo-3209045.jpeg?w=600&auto=compress',
  },
  {
    _id: '14', slug: 'modular-storage-rack', name: 'Modular Gear Storage Rack',
    category: 'Furniture',
    description: 'Powder-coated steel rack with modular shelves and side MOLLE panels. Holds up to 80 kg per shelf. Ideal for armory or base-camp organisation.',
    sku: 'FUR-003', price: 249,
    imageUrl: 'https://images.pexels.com/photos/4990289/pexels-photo-4990289.jpeg?w=600&auto=compress',
  },

  // ── Miscellaneous / Accessories ───────────────────────────────────────────
  {
    _id: '15', slug: 'multipurpose-survival-knife', name: 'Multipurpose Survival Knife',
    category: 'Miscellaneous',
    description: '440C stainless-steel full-tang blade with a fire-starter spine, glass-breaker pommel, and a Kydex sheath. Blade length 12 cm, overall 24 cm.',
    sku: 'MIS-001', price: 99,
    imageUrl: 'https://images.pexels.com/photos/1841841/pexels-photo-1841841.jpeg?w=600&auto=compress',
  },
  {
    _id: '16', slug: 'paracord-550-30m', name: 'Paracord 550 — 30 m Spool',
    category: 'Miscellaneous',
    description: 'MIL-C-5040H Type III paracord rated to 250 kg. 7-strand inner core, UV-resistant sheath. 30-metre spool fits in a cargo pocket.',
    sku: 'MIS-002', price: 24,
    imageUrl: 'https://images.pexels.com/photos/7682340/pexels-photo-7682340.jpeg?w=600&auto=compress',
  },
  {
    _id: '17', slug: 'first-aid-kit-pro', name: 'Tactical First Aid Kit',
    category: 'Miscellaneous',
    description: 'MOLLE-compatible IFAK pouch pre-loaded with tourniquet, hemostatic gauze, chest seals, trauma bandage, and nitrile gloves. OSHA-compliant for field use.',
    sku: 'MIS-003', price: 149,
    imageUrl: 'https://images.pexels.com/photos/6941883/pexels-photo-6941883.jpeg?w=600&auto=compress',
  },
  {
    _id: '18', slug: 'hydration-bladder-3l', name: 'Hydration Bladder 3 L',
    category: 'Miscellaneous',
    description: 'BPA-free 3-litre hydration bladder with quick-connect hose, auto-seal bite valve, and wide-mouth fill opening. Compatible with all major hydration packs.',
    sku: 'MIS-004', price: 39,
    imageUrl: 'https://images.pexels.com/photos/6551133/pexels-photo-6551133.jpeg?w=600&auto=compress',
  },
  {
    _id: '19', slug: 'tactical-molle-backpack', name: 'Tactical MOLLE Backpack 45L',
    category: 'Miscellaneous',
    description: '1000D Cordura 45-litre backpack with full MOLLE webbing, internal frame stays, padded hip belt, and a dedicated hydration sleeve. Load-lifter straps included.',
    sku: 'MIS-005', price: 189,
    imageUrl: 'https://images.pexels.com/photos/1294731/pexels-photo-1294731.jpeg?w=600&auto=compress',
  },
  {
    _id: '20', slug: 'ballistic-shooting-glasses', name: 'Ballistic Shooting Glasses',
    category: 'Miscellaneous',
    description: 'ANSI Z87.1 and MIL-PRF-31013 rated glasses with polycarbonate lenses, anti-fog coating, and interchangeable clear/smoke/amber lens kit.',
    sku: 'MIS-006', price: 59,
    imageUrl: 'https://images.pexels.com/photos/701877/pexels-photo-701877.jpeg?w=600&auto=compress',
  },
];

// GET /api/products
export function listProducts(_req: Request, res: Response): void {
  res.json({ data: CATALOG });
}

// GET /api/products/:id
export function getProduct(req: Request, res: Response): void {
  const product = CATALOG.find((p) => p._id === req.params.id || p.slug === req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ data: product });
}
