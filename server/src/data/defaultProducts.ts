const DEFAULT_PRODUCTS = [
  {
    slug: 'plate-carrier-mk2',
    name: 'Plate Carrier MK2',
    category: 'Body Armor',
    description:
      'Modular MOLLE platform with triple-density foam shoulder pads, quick-release system, and full cummerbund compatibility.',
    sku: 'AG-PC-MK2',
  },
  {
    slug: 'assault-pack-45l',
    name: 'Assault Pack 45L',
    category: 'Packs & Bags',
    description:
      'Hydration-compatible daypack with PALS webbing, clamshell main compartment, and integrated admin pouch.',
    sku: 'AG-AP-45L',
  },
  {
    slug: 'cqb-belt-system',
    name: 'CQB Belt System',
    category: 'Load Bearing',
    description:
      'Cobra-buckle rigger belt with laser-cut MOLLE, inner belt compatibility, and low-profile design for vehicle operations.',
    sku: 'AG-BS-CQB',
  },
  {
    slug: 'tac-gloves-pro',
    name: 'Tac Gloves Pro',
    category: 'Hand Protection',
    description:
      'Cut-resistant Kevlar liner with touchscreen-compatible fingertips, reinforced palm, and adjustable wrist closure.',
    sku: 'AG-GL-PRO',
  },
  {
    slug: 'combat-knee-pad-set',
    name: 'Combat Knee Pad Set',
    category: 'Protective Gear',
    description:
      'D3O impact-rated pads with internal sleeve pockets, breathable mesh backing, and anti-slip silicone grip bands.',
    sku: 'AG-KP-SET',
  },
  {
    slug: 'comms-headset-adapter',
    name: 'Comms Headset Adapter',
    category: 'Communications',
    description:
      'Universal PTT adapter with NEXUS TP-120 plug, dual-comm input, and push-to-talk compatibility across all major radio systems.',
    sku: 'AG-CH-UNI',
  },
  {
    slug: 'admin-chest-rig',
    name: 'Admin Chest Rig',
    category: 'Load Bearing',
    description:
      'Slimline chest rig with magazine pouches, zip-access admin panel, and stand-alone or plate-carrier-attachable wear modes.',
    sku: 'AG-CR-ADM',
  },
  {
    slug: 'hydration-bladder-3l',
    name: 'Hydration Bladder 3L',
    category: 'Hydration',
    description:
      'BPA-free 3-litre bladder with wide-mouth fill port, taste-neutral tubing, and magnetic bite valve.',
    sku: 'AG-HB-3L',
  },
];

export default DEFAULT_PRODUCTS.map((product, index) => ({
  ...product,
  sortOrder: index,
  isActive: true,
}));
