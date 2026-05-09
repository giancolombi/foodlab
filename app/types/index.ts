export interface User {
  id: string;
  email: string;
  displayName: string | null;
}

export interface Profile {
  id: string;
  name: string;
  restrictions: string[];
  preferences: string[];
  allergies: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeVersion {
  name: string;
  group_label: string | null;
  protein: string | null;
  instructions: string[];
}

export interface RecipeListItem {
  id: string;
  slug: string;
  title: string;
  category: "mains" | "breakfast";
  cuisine: string | null;
  freezer_friendly: boolean | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  shared_ingredients: string[];
  serve_with: string[];
  versions: RecipeVersion[];
  owner_user_id?: string | null;
  parent_slug?: string | null;
  is_public?: boolean;
  modification_note?: string | null;
  /** 1-decimal average across all users' ratings; null if nobody's rated yet. */
  avg_rating?: number | null;
  rating_count?: number;
}

export interface RecipeDetail extends RecipeListItem {
  raw_markdown: string;
  source_urls: string[];
  /** The signed-in caller's own rating, if any. Null when anonymous or unrated. */
  my_rating?: { stars: number; notes: string | null } | null;
}

export interface Recommendation {
  slug: string;
  title: string;
  score: number;
  matched_ingredients: string[];
  missing_ingredients: string[];
  reason: string;
}
