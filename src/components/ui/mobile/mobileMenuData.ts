export type MenuCategoryId = "chicken" | "egg" | "mutton";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  /** Path under `/public` */
  image: string;
  image_url?: string | null;
  category?: string;
  variants: {
    id: string;
    weight: string;
    label: string;
    price: number;
  }[];
}

export const MENU_CATEGORIES: { id: MenuCategoryId; label: string }[] = [
  { id: "chicken", label: "Chicken" },
  { id: "egg", label: "Egg" },
  { id: "mutton", label: "Mutton" },
];

export const MENU_BY_CATEGORY: Record<MenuCategoryId, MenuItem[]> = {
  chicken: [
    {
      id: "67a3c6b8-9483-40d5-af2d-b3f56087e77c",
      name: "Black Pepper Chicken Gravy",
      description: "Freshly ground pepper, slow-simmered onion tomato base — pairs with rice or parotta.",
      image: "/menu-images/chk-pepper-gravy.jpg",
      variants: [
        { id: "921303ff-b004-4f1e-b8f9-1edc3c122ed7", weight: "500g", label: "500gm", price: 399 },
        { id: "8c621691-b064-4f1f-9fff-df8a23dde896", weight: "1kg", label: "1kg", price: 799 },
      ],
    },
    {
      id: "df000e36-5235-470b-8b8f-c06083c7b32d",
      name: "Chilly Chicken Gravy",
      description: "Tangy and spicy gravy with a bold chilly punch.",
      image: "/menu-images/chk-chilly-gravy.jpg",
      variants: [
        { id: "579426b6-f4d8-47c3-9116-89ef301a69f5", weight: "500g", label: "500gm", price: 599 },
        { id: "d62cb2e0-4ccc-4944-aa53-7947efe7731f", weight: "1kg", label: "1kg", price: 1199 },
      ],
    },
    {
      id: "37c30dfd-3be1-46a1-9780-8f65e6112259",
      name: "Mom's Recipe - Chicken Gravy",
      description: "Comforting home-style masala with coconut undertones.",
      image: "/menu-images/chk-mom-gravy.jpg",
      variants: [
        { id: "fc3317ef-3ce5-48dc-abd6-1b43d13af6b3", weight: "500g", label: "500gm", price: 349 },
        { id: "bdbbe985-a2c6-4c9c-b32f-c06c83a7fdcf", weight: "1kg", label: "1kg", price: 699 },
      ],
    },
    {
      id: "dcf3fee3-f1cd-4bd8-bded-e575587dd86b",
      name: "Sister's Recipe - Chicken Gravy",
      description: "Spiced home-style chicken gravy with a unique family touch.",
      image: "/menu-images/chk-mom-gravy.jpg",
      variants: [
        { id: "c8ca816b-fa18-4ac4-b797-3b9ea4393657", weight: "500g", label: "500gm", price: 349 },
        { id: "429aba77-6073-4142-9483-0cf58c15f14a", weight: "1kg", label: "1kg", price: 699 },
      ],
    },
    {
      id: "9a6acd6d-b56c-41f1-85ad-3c2631f00cfb",
      name: "Idli Special Chicken Gravy",
      description: "The perfect companion for soft idlis, packed with flavour.",
      image: "/menu-images/chk-idli-special.jpg",
      variants: [
        { id: "27f92f17-649c-46fa-a230-5d7034201b32", weight: "500g", label: "500gm", price: 425 },
        { id: "5fc36626-b96f-4bd4-896d-ff15a2f425fc", weight: "1kg", label: "1kg", price: 849 },
      ],
    },
    {
      id: "56fbbb0a-d446-426b-8bf9-ec1d0deaa345",
      name: "Sister-in-law's Recipe - Pepper Chicken",
      description: "A signature recipe with bold pepper notes and caramelised onions.",
      image: "/menu-images/chk-pepper-sil.jpg",
      variants: [
        { id: "907cf6aa-7b26-4fc6-8194-7536b5d7dc4f", weight: "500g", label: "500gm", price: 425 },
        { id: "a12ff7e5-23c4-49a4-92db-6c3e03888c2f", weight: "1kg", label: "1kg", price: 849 },
      ],
    },
    {
      id: "36e1885b-1a3f-418a-8382-2a7ad466f229",
      name: "Chicken Wings",
      description: "Crisp outside, juicy inside — finished with curry leaves and cracked pepper.",
      image: "/menu-images/chk-wings.jpg",
      variants: [
        { id: "fc325a8c-6377-4116-9387-d38ca028f29c", weight: "500g", label: "500gm", price: 375 },
        { id: "e0ecc584-bbda-40e3-b472-c59d4b76b091", weight: "1kg", label: "1kg", price: 749 },
      ],
    },
    {
      id: "0ac1a394-be7a-405e-879e-711b3989b8f7",
      name: "Chilly Chicken (Dry)",
      description: "Wok-tossed with capsicum, onion, and a bold chilli-garlic glaze.",
      image: "/menu-images/chk-chilly-dry.jpg",
      variants: [
        { id: "ade151a9-4657-4a99-b9bf-e1277d09bfb6", weight: "500g", label: "500gm", price: 599 },
        { id: "1b47af62-2d37-41a5-9735-94ff94abe81a", weight: "1kg", label: "1kg", price: 1199 },
      ],
    },
    {
      id: "f5ac85c1-52d3-4704-a345-a26ead256c6e",
      name: "My Fav Chicken",
      description: "A chef's special pick, made with love and secret spices.",
      image: "/menu-images/chk-fav.jpg",
      variants: [
        { id: "0c26f4c8-bf5b-429a-83d9-d4bd5079ebd1", weight: "500g", label: "500gm", price: 325 },
        { id: "ff74d078-d0d8-4fba-be31-4d291e51e0ed", weight: "1kg", label: "1kg", price: 649 },
      ],
    },
  ],
  egg: [
    {
      id: "9f589b87-6ea6-4a66-a4ad-25b3b46aa059",
      name: "Egg Chalna",
      description: "Spiced dry-ish masala that clings to every bite of egg.",
      image: "/menu-images/egg-chalna.jpg",
      variants: [
        { id: "ae18895e-414b-481c-84eb-1481551b31cb", weight: "500g", label: "500gm", price: 175 },
        { id: "5271d991-db27-4dd7-9fe2-8e75be202268", weight: "1kg", label: "1kg", price: 349 },
      ],
    },
    {
      id: "231d0270-ed4e-40c2-b3d2-ad677bccc92f",
      name: "Egg Curry",
      description: "Boiled eggs in a tangy onion-tomato gravy — lunchbox favourite.",
      image: "/menu-images/egg-curry.jpg",
      variants: [
        { id: "1619e99e-a6a8-42b8-ab91-6eeb794ae958", weight: "500g", label: "500gm", price: 149 },
        { id: "9e314bf8-6faa-4663-8d2d-d7246a0cc91b", weight: "1kg", label: "1kg", price: 299 },
      ],
    },
  ],
  mutton: [
    {
      id: "45c9ae81-e280-4193-b39a-0238e7ddde02",
      name: "Fresh Cream Mutton Curry",
      description: "Rich, creamy mutton curry with a smooth finish.",
      image: "/menu-images/mut-curry.jpg",
      variants: [
        { id: "f00fb5b4-9bd2-49d8-ae54-ca3c028e60e5", weight: "500g", label: "500gm", price: 1049 },
        { id: "8392c3f0-e16d-463f-9fda-3f3a66632947", weight: "1kg", label: "1kg", price: 2099 },
      ],
    },
    {
      id: "5dcb06bf-4f59-4a6b-9974-86b529b26db4",
      name: "Grandma Mutton Keema",
      description: "Authentic grandma's recipe for minced mutton with traditional spices.",
      image: "/menu-images/mut-keema-gravy.jpg",
      variants: [
        { id: "00a9db0c-b811-4f63-9742-e5a9a3804190", weight: "500g", label: "500gm", price: 975 },
        { id: "3f0035ab-4644-4ddb-846c-e068f6766b56", weight: "1kg", label: "1kg", price: 1949 },
      ],
    },
    {
      id: "df2b9a5a-4565-4e89-8530-d356b327b634",
      name: "Mutton Keema Gravy",
      description: "Fine mince, warming spices, perfect with idli-dosa or rice.",
      image: "/menu-images/mut-keema-gravy.jpg",
      variants: [
        { id: "ab17d4e5-e753-4f77-a2af-d567a09d97fc", weight: "500g", label: "500gm", price: 999 },
        { id: "6fff1e5b-1520-4f80-a70c-b9eb27793727", weight: "1kg", label: "1kg", price: 1999 },
      ],
    },
    {
      id: "ffbf6f8d-b26b-46e9-a14f-a6c3a1757520",
      name: "Mutton Curry",
      description: "Bone-in mutton, slow cooked till the oil splits — Sunday special energy.",
      image: "/menu-images/mut-curry.jpg",
      variants: [
        { id: "3d9a25f5-e128-4af2-97a5-86fe569352c6", weight: "500g", label: "500gm", price: 975 },
        { id: "1a2ce75a-c4cf-4bf2-acfd-75953a00ba95", weight: "1kg", label: "1kg", price: 1949 },
      ],
    },
    {
      id: "b5f1af71-7674-42ae-89c3-55c24dd2f2de",
      name: "Mutton Stew",
      description: "Light and fragrant mutton stew, easy on the stomach.",
      image: "/menu-images/mut-stew.jpg",
      variants: [
        { id: "3535c1bd-cf86-454f-babb-0739c9c9a6e2", weight: "500g", label: "500gm", price: 1050 },
        { id: "55d9bbfa-cf27-4d5c-9ee0-ee3be909619e", weight: "1kg", label: "1kg", price: 2100 },
      ],
    },
    {
      id: "537b6748-cc8d-4725-95c5-82c74ee42930",
      name: "Spicy Mutton Gravy",
      description: "For the brave — bold spices and tender mutton.",
      image: "/menu-images/mut-curry.jpg",
      variants: [
        { id: "8236d13b-3386-46a0-93a2-2072e50bab1f", weight: "500g", label: "500gm", price: 999 },
        { id: "b3fd70a2-ba14-43b9-a473-da2a3dac1ced", weight: "1kg", label: "1kg", price: 1999 },
      ],
    },
    {
      id: "8cef32bb-1631-42ef-b1ac-07d82499c579",
      name: "Mutton Chukka",
      description: "Dry roast style — pepper forward with caramelised onions.",
      image: "/menu-images/mut-chukka.jpg",
      variants: [
        { id: "964e62ed-7ac8-4d85-869b-57eb92c82187", weight: "500g", label: "500gm", price: 975 },
        { id: "d06097db-92a1-40ac-a734-a61f032cf3bf", weight: "1kg", label: "1kg", price: 1950 },
      ],
    },
  ],
};
