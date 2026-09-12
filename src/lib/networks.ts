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

export type ChannelCredentials = Record<string, string>;

export type CredentialField = {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  secret: boolean;
};

export type NetworkMeta = {
  id: NetworkId;
  name: string;
  /** Can the app publish automatically once the account is connected? */
  autoPost: boolean;
  /** Whether a finished clip is required before posting. */
  needsVideo: boolean;
  /** How the account gets linked. */
  howTo: string;
  /** Where to get the details. */
  where: string;
  fields: CredentialField[];
};

export const NETWORKS: NetworkMeta[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    autoPost: true,
    needsVideo: false,
    howTo: "Paste a LinkedIn access token with the w_member_social and openid profile permissions.",
    where: "LinkedIn Developers → your app → Auth → generate a member access token.",
    fields: [
      { key: "access_token", label: "Access token", hint: "Starts with AQV…", required: true, secret: true },
      {
        key: "author_urn",
        label: "Author URN (optional)",
        hint: "urn:li:person:XXXX — only needed if the token can't read your profile",
        required: false,
        secret: false,
      },
    ],
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    autoPost: true,
    needsVideo: false,
    howTo: "Paste an X user access token with tweet.read, tweet.write and users.read permissions.",
    where: "X Developer Portal → your project → Keys and tokens → OAuth 2.0 user token.",
    fields: [{ key: "access_token", label: "Access token", hint: "OAuth 2.0 user token", required: true, secret: true }],
  },
  {
    id: "tiktok",
    name: "TikTok",
    autoPost: true,
    needsVideo: true,
    howTo: "Paste a TikTok access token with video.publish and video.list permissions.",
    where: "TikTok for Developers → your app → Content Posting API → user access token.",
    fields: [{ key: "access_token", label: "Access token", hint: "act.xxxxx…", required: true, secret: true }],
  },
  {
    id: "facebook",
    name: "Facebook",
    autoPost: true,
    needsVideo: false,
    howTo: "Paste your Facebook Page ID and a long-lived Page access token.",
    where: "Meta for Developers → Graph API Explorer → pick your Page → pages_manage_posts.",
    fields: [
      { key: "page_id", label: "Page ID", hint: "The numeric ID of your Facebook Page", required: true, secret: false },
      { key: "page_access_token", label: "Page access token", hint: "Long-lived token", required: true, secret: true },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    autoPost: true,
    needsVideo: true,
    howTo: "Paste your Instagram business account ID and a token with instagram_content_publish.",
    where: "Meta for Developers → Graph API Explorer → your linked Instagram business account.",
    fields: [
      {
        key: "ig_user_id",
        label: "Instagram account ID",
        hint: "Numeric business account ID",
        required: true,
        secret: false,
      },
      { key: "access_token", label: "Access token", hint: "Long-lived token", required: true, secret: true },
    ],
  },
];

export function networkMeta(id: string): NetworkMeta | undefined {
  return NETWORKS.find((network) => network.id === id);
}

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
