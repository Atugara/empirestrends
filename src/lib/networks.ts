// Client-safe metadata about topic categories and social networks.

export const AVAILABLE_CATEGORIES = [
  "general",
  "entertainment",
  "politics",
  "social",
  "sports",
  "technology",
  "business",
] as const;

export type NetworkId = "twitter" | "linkedin" | "facebook" | "instagram" | "tiktok";

export type NetworkMeta = {
  id: NetworkId;
  name: string;
  /** Can the app publish automatically once the account is connected? */
  autoPost: boolean;
  /** How the account gets linked. */
  howTo: string;
};

export const NETWORKS: NetworkMeta[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    autoPost: true,
    howTo: "Sign in with LinkedIn to let the bot post to your feed automatically.",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    autoPost: true,
    howTo: "Sign in with X to let the bot post your text posts automatically.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    autoPost: true,
    howTo: "Sign in with TikTok and the bot films the clip and posts it for you.",
  },
  {
    id: "facebook",
    name: "Facebook",
    autoPost: false,
    howTo: "Facebook sign-in isn\u2019t available here yet — copy the post and paste it into Facebook.",
  },
  {
    id: "instagram",
    name: "Instagram",
    autoPost: false,
    howTo: "Instagram sign-in isn\u2019t available here yet — copy the caption and post it with the clip.",
  },
];

export const TONES = [
  { id: "witty", label: "Witty" },
  { id: "sarcastic", label: "Sarcastic" },
  { id: "deadpan", label: "Deadpan" },
  { id: "playful", label: "Playful" },
  { id: "informative", label: "Informative" },
  { id: "hype", label: "Hype" },
] as const;

export const POST_LENGTHS = [
  { id: "short", label: "Short", hint: "One-liners and quick hits" },
  { id: "medium", label: "Medium", hint: "A couple of punchy sentences" },
  { id: "long", label: "Long", hint: "Fuller storytelling posts" },
] as const;
