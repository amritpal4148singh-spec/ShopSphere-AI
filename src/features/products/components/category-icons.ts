import {
  Armchair,
  Bike,
  Car,
  Droplets,
  Footprints,
  Gem,
  Glasses,
  Headphones,
  Laptop,
  LampDesk,
  Package,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  SprayCan,
  Tablet,
  UtensilsCrossed,
  Watch,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";

/**
 * Decorative icon per category slug. Purely presentational: the link text and destination always come from the
 * category data, and a category this map does not know gets the neutral package icon.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  smartphones: Smartphone,
  laptops: Laptop,
  tablets: Tablet,
  "mobile-accessories": Headphones,
  beauty: Sparkles,
  skincare: Droplets,
  fragrances: SprayCan,
  groceries: ShoppingBasket,
  furniture: Armchair,
  "home-decoration": LampDesk,
  lighting: LampDesk,
  "kitchen-accessories": UtensilsCrossed,
  tops: Shirt,
  "mens-shirts": Shirt,
  "womens-dresses": Shirt,
  "mens-shoes": Footprints,
  "womens-shoes": Footprints,
  "mens-watches": Watch,
  "womens-watches": Watch,
  "womens-bags": ShoppingBag,
  "womens-jewellery": Gem,
  sunglasses: Glasses,
  "sports-accessories": Dumbbell,
  vehicle: Car,
  automotive: Car,
  motorcycle: Bike,
};

export function categoryIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? Package;
}
