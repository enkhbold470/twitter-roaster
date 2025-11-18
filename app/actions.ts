"use server";

import OpenAI from "openai";

const X_API_BASE = "https://api.x.com/2";
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE_ID = "21m00tcm4tlvdq8ikwam";
const ELEVEN_TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`;

export type Platform = "x";

type AudioRoast = {
  src: string;
  mimeType: string;
  voice: string;
};

export type ProfileSummary = {
  id: string;
  name: string;
  username: string;
  verified: boolean;
  location?: string;
  description?: string;
  profileImageUrl?: string;
  lastTweetHours?: number;
  avgEngagement?: number;
  metrics: {
    followers: number;
    following: number;
    tweets: number;
    listed: number;
    followerRatio: number;
  };
};

export type TweetPreview = {
  id: string;
  text: string;
  createdAt: string;
  metrics: {
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
  };
};

export type RoastState = {
  status: "idle" | "error" | "ok";
  handle?: string;
  platform?: Platform;
  roastText?: string;
  images?: string[];
  durationSec?: number;
  profile?: ProfileSummary;
  tweets?: TweetPreview[];
  imageRoast?: string;
  audio?: AudioRoast;
  error?: string;
};

type XUserResponse = {
  data?: {
    id: string;
    name: string;
    username: string;
    verified: boolean;
    description?: string;
    profile_image_url?: string;
    location?: string;
    public_metrics?: {
      followers_count?: number;
      following_count?: number;
      tweet_count?: number;
      listed_count?: number;
    };
  };
  errors?: { detail?: string }[];
};

type XTweetResponse = {
  data?: {
    id: string;
    text: string;
    created_at: string;
    public_metrics?: {
      like_count?: number;
      reply_count?: number;
      retweet_count?: number;
      quote_count?: number;
    };
  }[];
  errors?: { detail?: string }[];
};

type ResponsesOutput = {
  output_text?: string;
  output?: { content?: { text?: string }[] }[];
};

async function fetchFromX<T>(endpoint: string, bearer: string): Promise<T> {
  const response = await fetch(`${X_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as T & { errors?: { detail?: string }[] };

  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail || response.statusText;
    throw new Error(detail || "Failed to reach X API");
  }

  return payload as T;
}

const formatFollowerRatio = (followers: number, following: number) => {
  if (!followers && !following) {
    return 0;
  }

  const ratio = followers / Math.max(1, following);
  return Number(ratio.toFixed(2));
};

const sanitizeHandle = (value: string) => value.replace(/^@+/, "").trim();

const normalizeProfileImage = (url?: string) => {
  if (!url) {
    return undefined;
  }
  return url.replace("_normal", "_400x400");
};

const generateImageRoast = async (imageUrl: string | undefined, handle: string) => {
  if (!imageUrl || !openaiClient) {
    return undefined;
  }

  try {
    const response = await openaiClient.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Roast this X profile photo for @${handle}. Keep it under 80 words, spicy but PG-13, and end with a short mic-drop.`,
            },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        },
      ],
      max_output_tokens: 180,
    });

    const parsed = response as ResponsesOutput;
    const outputText = parsed.output_text?.trim() ?? parsed.output?.[0]?.content?.[0]?.text?.trim();

    return outputText || undefined;
  } catch {
    return undefined;
  }
};
const createElevenlabsAudio = async (text: string) => {
  if (!text || !ELEVENLABS_KEY) {
    return undefined;
  }

  try {
    const response = await fetch(ELEVEN_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_tts",
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.7,
        },
      }),
    });

    if (!response.ok) {
      return undefined;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      src: `data:audio/mpeg;base64,${buffer.toString("base64")}`,
      mimeType: "audio/mpeg",
      voice: "elevenlabs",
    } satisfies AudioRoast;
  } catch {
    return undefined;
  }
};

export async function roastAction(_prev: RoastState, formData: FormData): Promise<RoastState> {
  const rawHandle = String(formData.get("handle") || "").trim();
  const platform = (String(formData.get("platform") || "x") as Platform) || "x";

  if (!rawHandle) {
    return { status: "error", error: "Please enter a handle." };
  }

  if (platform !== "x") {
    return { status: "error", error: "Only X handles are supported right now." };
  }

  const bearer = process.env.X_BEARER_TOKEN;

  if (!bearer) {
    return {
      status: "error",
      error: "Server missing X_BEARER_TOKEN. Add it to .env.local and restart.",
    };
  }

  const handle = sanitizeHandle(rawHandle).toLowerCase();

  if (!handle) {
    return { status: "error", error: "That handle looks empty. Try again." };
  }

  let userResponse: XUserResponse;
  try {
    userResponse = await fetchFromX<XUserResponse>(
      `/users/by/username/${handle}?user.fields=description,profile_image_url,public_metrics,location,verified,created_at`,
      bearer,
    );
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unable to reach X right now.",
    };
  }

  const user = userResponse.data;

  if (!user) {
    return {
      status: "error",
      error: "Could not find that handle on X. Double-check the spelling.",
    };
  }

  const followers = user.public_metrics?.followers_count ?? 0;
  const following = user.public_metrics?.following_count ?? 0;
  const tweetCount = user.public_metrics?.tweet_count ?? 0;
  const listedCount = user.public_metrics?.listed_count ?? 0;
  const followerRatio = formatFollowerRatio(followers, following);

  let tweets: TweetPreview[] = [];
  try {
    const tweetResponse = await fetchFromX<XTweetResponse>(
      `/users/${user.id}/tweets?max_results=1&tweet.fields=created_at,public_metrics,text&exclude=retweets,replies`,
      bearer,
    );
    const tweetData = tweetResponse.data ?? [];
    tweets = tweetData.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      metrics: {
        likes: tweet.public_metrics?.like_count ?? 0,
        replies: tweet.public_metrics?.reply_count ?? 0,
        reposts: tweet.public_metrics?.retweet_count ?? 0,
        quotes: tweet.public_metrics?.quote_count ?? 0,
      },
    }));
  } catch {
    // If tweets can't be fetched (protected account / rate limit), continue with profile data.
    tweets = [];
  }

  const mostRecentTweet = tweets[0];
  const lastTweetMs = mostRecentTweet ? Date.now() - new Date(mostRecentTweet.createdAt).getTime() : undefined;
  const lastTweetHours = typeof lastTweetMs === "number" ? Math.max(0, Math.round(lastTweetMs / (1000 * 60 * 60))) : undefined;

  const avgEngagement = tweets.length
    ? Math.round(
        tweets.reduce((sum, tweet) => {
          const engagement = tweet.metrics.likes + tweet.metrics.replies + tweet.metrics.reposts + tweet.metrics.quotes;
          return sum + engagement;
        }, 0) / tweets.length,
      )
    : 0;

  const cleanBio = (user.description || "").replace(/\s+/g, " ").trim();
  const bioLength = cleanBio.length;
  const bioPreview = cleanBio ? (cleanBio.length > 120 ? `${cleanBio.slice(0, 117)}...` : cleanBio) : "silence";

  const roastLines: string[] = [];
  roastLines.push(`@${handle}, ${followers.toLocaleString()} followers signed up for ${tweetCount.toLocaleString()} posts of chaos.`);
  roastLines.push(
    `You follow ${following.toLocaleString()} people which makes your clout exchange rate a ${followerRatio}:1 hustle.`,
  );
  roastLines.push(
    bioLength
      ? `Bio is ${bioLength} characters of "${bioPreview}" and still manages to dodge personality.`
      : "No bio detected. Bold move to give us zero context and maximum cringe.",
  );
  roastLines.push(
    avgEngagement
      ? `Recent tweets average ~${avgEngagement} interactions. That's not virality, that's a group chat.`
      : "Engagement registers as a flatline, so we're roasting the digital ghost of your content.",
  );
  roastLines.push(
    typeof lastTweetHours === "number"
      ? `Last tweet hit the feed ${lastTweetHours}h ago and it's already aging like milk in direct sunlight.`
      : "Couldn't find a fresh tweet. Either you're private or procrastinating content like rent."
  );
  roastLines.push("Share this if you're not a coward.");

  const roastText = roastLines.join(" ");

  const heroImage = normalizeProfileImage(user.profile_image_url);
  const fillerImages = Array.from({ length: 12 }).map((_, idx) => `https://placekeanu.com/500?idx=${idx}`);
  const images = heroImage ? [heroImage, ...fillerImages.slice(0, 11)] : fillerImages;

  const [imageRoast, audio] = await Promise.all([
    generateImageRoast(heroImage, handle),
    createElevenlabsAudio(roastText),
  ]);

  const profile: ProfileSummary = {
    id: user.id,
    name: user.name,
    username: user.username,
    verified: user.verified,
    location: user.location,
    description: cleanBio,
    profileImageUrl: heroImage,
    lastTweetHours,
    avgEngagement,
    metrics: {
      followers,
      following,
      tweets: tweetCount,
      listed: listedCount,
      followerRatio,
    },
  };

  return {
    status: "ok",
    handle,
    platform,
    roastText,
    images,
    durationSec: 60,
    profile,
    tweets,
    imageRoast,
    audio,
  };
}
