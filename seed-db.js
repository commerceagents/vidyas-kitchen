const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// We need to parse the mobileMenuData.ts, but let's just use a quick regex or include the JSON.
// Since we know the structure, let's just read it using regex or TS compiler.
// Better yet, just read the file and extract IDs.
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'src/components/ui/mobile/mobileMenuData.ts'), 'utf-8');

async function seed() {
  try {
    console.log("Extracting items from mobileMenuData.ts...");
    const itemsToInsert = [];
    
    // Quick and dirty regex extraction
    const blockRegex = /name:\s*"([^"]+)",[\s\S]*?category:\s*"([^"]+)"[\s\S]*?image:\s*"([^"]+)",[\s\S]*?variants:\s*\[([\s\S]*?)\]/g;
    // Wait, mobileMenuData is structured by category objects.
    // Let's just use regex to find { id: "...", weight: "...", label: "...", price: ... } and the name.
    
    // Instead of complex regex, let's just write the data here directly.
    const rawData = [
      { name: "Black Pepper Chicken Gravy", category: "chicken", image: "/menu-images/chk-pepper-gravy.jpg", variants: [ { id: "921303ff-b004-4f1e-b8f9-1edc3c122ed7", weight: "500g", label: "½ kg", price: 399 }, { id: "8c621691-b064-4f1f-9fff-df8a23dde896", weight: "1kg", label: "1 kg", price: 799 } ] },
      { name: "Chilly Chicken Gravy", category: "chicken", image: "/menu-images/chk-chilly-gravy.jpg", variants: [ { id: "579426b6-f4d8-47c3-9116-89ef301a69f5", weight: "500g", label: "½ kg", price: 599 }, { id: "d62cb2e0-4ccc-4944-aa53-7947efe7731f", weight: "1kg", label: "1 kg", price: 1199 } ] },
      { name: "Chicken Gravy (Mom's Recipe)", category: "chicken", image: "/menu-images/chk-mom-gravy.jpg", variants: [ { id: "fc3317ef-3ce5-48dc-abd6-1b43d13af6b3", weight: "500g", label: "½ kg", price: 349 }, { id: "bdbbe985-a2c6-4c9c-b32f-c06c83a7fdcf", weight: "1kg", label: "1 kg", price: 699 } ] },
      { name: "Chicken Gravy (Sister's Recipe)", category: "chicken", image: "/menu-images/chk-mom-gravy.jpg", variants: [ { id: "c8ca816b-fa18-4ac4-b797-3b9ea4393657", weight: "500g", label: "½ kg", price: 349 }, { id: "429aba77-6073-4142-9483-0cf58c15f14a", weight: "1kg", label: "1 kg", price: 699 } ] },
      { name: "Idli Special Chicken Gravy", category: "chicken", image: "/menu-images/chk-idli-special.jpg", variants: [ { id: "27f92f17-649c-46fa-a230-5d7034201b32", weight: "500g", label: "½ kg", price: 425 }, { id: "5fc36626-b96f-4bd4-896d-ff15a2f425fc", weight: "1kg", label: "1 kg", price: 849 } ] },
      { name: "Pepper Chicken (Sister-in-law's Recipe)", category: "chicken", image: "/menu-images/chk-pepper-sil.jpg", variants: [ { id: "907cf6aa-7b26-4fc6-8194-7536b5d7dc4f", weight: "500g", label: "½ kg", price: 425 }, { id: "a12ff7e5-23c4-49a4-92db-6c3e03888c2f", weight: "1kg", label: "1 kg", price: 849 } ] },
      { name: "Chicken Wings", category: "chicken", image: "/menu-images/chk-wings.jpg", variants: [ { id: "fc325a8c-6377-4116-9387-d38ca028f29c", weight: "500g", label: "½ kg", price: 375 }, { id: "e0ecc584-bbda-40e3-b472-c59d4b76b091", weight: "1kg", label: "1 kg", price: 749 } ] },
      { name: "Chilly Chicken (Dry)", category: "chicken", image: "/menu-images/chk-chilly-dry.jpg", variants: [ { id: "ade151a9-4657-4a99-b9bf-e1277d09bfb6", weight: "500g", label: "½ kg", price: 599 }, { id: "1b47af62-2d37-41a5-9735-94ff94abe81a", weight: "1kg", label: "1 kg", price: 1199 } ] },
      { name: "My Fav Chicken", category: "chicken", image: "/menu-images/chk-fav.jpg", variants: [ { id: "0c26f4c8-bf5b-429a-83d9-d4bd5079ebd1", weight: "500g", label: "½ kg", price: 325 }, { id: "ff74d078-d0d8-4fba-be31-4d291e51e0ed", weight: "1kg", label: "1 kg", price: 649 } ] },
      { name: "Egg Chalna", category: "egg", image: "/menu-images/egg-chalna.jpg", variants: [ { id: "ae18895e-414b-481c-84eb-1481551b31cb", weight: "500g", label: "½ kg", price: 175 }, { id: "5271d991-db27-4dd7-9fe2-8e75be202268", weight: "1kg", label: "1 kg", price: 349 } ] },
      { name: "Egg Curry", category: "egg", image: "/menu-images/egg-curry.jpg", variants: [ { id: "1619e99e-a6a8-42b8-ab91-6eeb794ae958", weight: "500g", label: "½ kg", price: 149 }, { id: "9e314bf8-6faa-4663-8d2d-d7246a0cc91b", weight: "1kg", label: "1 kg", price: 299 } ] },
      { name: "Fresh Cream Mutton Curry", category: "mutton", image: "/menu-images/mut-curry.jpg", variants: [ { id: "f00fb5b4-9bd2-49d8-ae54-ca3c028e60e5", weight: "500g", label: "½ kg", price: 1049 }, { id: "8392c3f0-e16d-463f-9fda-3f3a66632947", weight: "1kg", label: "1 kg", price: 2099 } ] },
      { name: "Grandma Mutton Keema", category: "mutton", image: "/menu-images/mut-keema-gravy.jpg", variants: [ { id: "00a9db0c-b811-4f63-9742-e5a9a3804190", weight: "500g", label: "½ kg", price: 975 }, { id: "3f0035ab-4644-4ddb-846c-e068f6766b56", weight: "1kg", label: "1 kg", price: 1949 } ] },
      { name: "Mutton Keema Gravy", category: "mutton", image: "/menu-images/mut-keema-gravy.jpg", variants: [ { id: "ab17d4e5-e753-4f77-a2af-d567a09d97fc", weight: "500g", label: "½ kg", price: 999 }, { id: "6fff1e5b-1520-4f80-a70c-b9eb27793727", weight: "1kg", label: "1 kg", price: 1999 } ] },
      { name: "Mutton Curry", category: "mutton", image: "/menu-images/mut-curry.jpg", variants: [ { id: "3d9a25f5-e128-4af2-97a5-86fe569352c6", weight: "500g", label: "½ kg", price: 975 }, { id: "1a2ce75a-c4cf-4bf2-acfd-75953a00ba95", weight: "1kg", label: "1 kg", price: 1949 } ] },
      { name: "Mutton Stew", category: "mutton", image: "/menu-images/mut-stew.jpg", variants: [ { id: "3535c1bd-cf86-454f-babb-0739c9c9a6e2", weight: "500g", label: "½ kg", price: 1050 }, { id: "55d9bbfa-cf27-4d5c-9ee0-ee3be909619e", weight: "1kg", label: "1 kg", price: 2100 } ] },
      { name: "Spicy Mutton Gravy", category: "mutton", image: "/menu-images/mut-curry.jpg", variants: [ { id: "8236d13b-3386-46a0-93a2-2072e50bab1f", weight: "500g", label: "½ kg", price: 999 }, { id: "b3fd70a2-ba14-43b9-a473-da2a3dac1ced", weight: "1kg", label: "1 kg", price: 1999 } ] },
      { name: "Mutton Chukka", category: "mutton", image: "/menu-images/mut-chukka.jpg", variants: [ { id: "964e62ed-7ac8-4d85-869b-57eb92c82187", weight: "500g", label: "½ kg", price: 975 }, { id: "d06097db-92a1-40ac-a734-a61f032cf3bf", weight: "1kg", label: "1 kg", price: 1950 } ] },
    ];

    for (const item of rawData) {
      for (const variant of item.variants) {
        await supabase.from('menu_items').upsert({
          id: variant.id,
          name: item.name + " (" + variant.label + ")",
          category: item.category,
          image_url: item.image,
          price: variant.price,
          unit: 'order',
          is_available: true
        });
      }
    }
    console.log("Done inserting 36 items.");
  } catch (e) {
    console.error(e);
  }
}
seed();
