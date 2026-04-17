export type MenuCategoryId = "chicken" | "egg" | "mutton";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  /** Path under `/public` */
  image: string;
}

export const MENU_CATEGORIES: { id: MenuCategoryId; label: string }[] = [
  { id: "chicken", label: "Chicken" },
  { id: "egg", label: "Egg" },
  { id: "mutton", label: "Mutton" },
];

export const MENU_BY_CATEGORY: Record<MenuCategoryId, MenuItem[]> = {
  chicken: [
    {
      id: "chk-1",
      name: "Pepper chicken gravy",
      price: 220,
      description: "Freshly ground pepper, slow-simmered onion tomato base — pairs with rice or parotta.",
      image: "/menu-images/chk-pepper-gravy.jpg",
    },
    {
      id: "chk-2",
      name: "Mom-style chicken gravy",
      price: 210,
      description: "Comforting home-style masala with coconut undertones.",
      image: "/menu-images/chk-mom-gravy.jpg",
    },
    {
      id: "chk-3",
      name: "Chilli chicken dry",
      price: 240,
      description: "Wok-tossed with capsicum, onion, and a bold chilli-garlic glaze.",
      image: "/menu-images/chk-chilly-dry.jpg",
    },
    {
      id: "chk-4",
      name: "Chicken wings fry",
      price: 260,
      description: "Crisp outside, juicy inside — finished with curry leaves and cracked pepper.",
      image: "/menu-images/chk-wings.jpg",
    },
  ],
  egg: [
    {
      id: "egg-1",
      name: "Egg curry",
      price: 95,
      description: "Boiled eggs in a tangy onion-tomato gravy — lunchbox favourite.",
      image: "/menu-images/egg-curry.jpg",
    },
    {
      id: "egg-2",
      name: "Egg chalna",
      price: 110,
      description: "Spiced dry-ish masala that clings to every bite of egg.",
      image: "/menu-images/egg-chalna.jpg",
    },
  ],
  mutton: [
    {
      id: "mut-1",
      name: "Mutton curry",
      price: 320,
      description: "Bone-in mutton, slow cooked till the oil splits — Sunday special energy.",
      image: "/menu-images/mut-curry.jpg",
    },
    {
      id: "mut-2",
      name: "Mutton keema gravy",
      price: 300,
      description: "Fine mince, warming spices, perfect with idli-dosa or rice.",
      image: "/menu-images/mut-keema-gravy.jpg",
    },
    {
      id: "mut-3",
      name: "Mutton chukka",
      price: 340,
      description: "Dry roast style — pepper forward with caramelised onions.",
      image: "/menu-images/mut-chukka.jpg",
    },
  ],
};
