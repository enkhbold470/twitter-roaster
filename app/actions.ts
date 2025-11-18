"use server";

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
const X_API_BASE = "https://api.x.com/2";
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const ELEVEN_VOICE_ID = "cgSgspJ2msm6clMCkdW9";
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

type RoastContext = {
  handle: string;
  followers: number;
  following: number;
  followerRatio: number;
  tweetCount: number;
  bioPreview: string;
  lastTweetHours?: number;
  avgEngagement: number;
  latestTweet?: string;
  platform: Platform;
  isPerplexityData?: boolean;
  name?: string;
  location?: string;
};

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

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
    const errorMessage = detail || "Failed to reach X API";
    
    // Check for rate limit errors
    if (response.status === 429 || errorMessage.toLowerCase().includes("too many requests") || errorMessage.toLowerCase().includes("rate limit")) {
      throw new RateLimitError(errorMessage);
    }
    
    throw new Error(errorMessage);
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

const abbreviateNumber = (num: number): string => {
  if (num === 0) return "0";
  if (num < 1000) return num.toString();
  if (num < 1000000) {
    const k = (num / 1000).toFixed(1);
    return k.endsWith(".0") ? `${k.slice(0, -2)}K` : `${k}K`;
  }
  const m = (num / 1000000).toFixed(1);
  return m.endsWith(".0") ? `${m.slice(0, -2)}M` : `${m}M`;
};

const sanitizeHandle = (value: string) => value.replace(/^@+/, "").trim();

const normalizeProfileImage = (url?: string) => {
  if (!url) {
    return undefined;
  }
  return url.replace("_normal", "_400x400");
};

const fetchProfileFromPerplexity = async (handle: string): Promise<XUserResponse | null> => {
  try {
    console.log(`Perplexity fallback: Searching for Twitter profile @${handle}`);
    
    if (!PERPLEXITY_API_KEY) {
      console.warn("Perplexity: API key not available, falling back to OpenAI");
      // Fallback to OpenAI if Perplexity key not set
      if (!openaiClient) {
        console.warn("Perplexity: OpenAI client also not available");
        return null;
      }
    }

    let jsonText: string | undefined;

    if (PERPLEXITY_API_KEY) {
      // Use Perplexity Search API (same as MCP tool uses)
      try {
        const searchQuery = `Go to the Twitter/X profile page for @${handle} at https://x.com/${handle} or https://twitter.com/${handle} and extract the complete profile information including:
- Display name/full name
- Username (handle: @${handle})
- Verified status (blue checkmark badge)
- Bio/description text
- Location
- Follower count (exact number)
- Following count (exact number)
- Total tweets/posts count (exact number)
- Listed count if available

Please visit the actual Twitter/X profile page and provide all visible profile information.`;
        
        const response = await fetch(PERPLEXITY_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              {
                role: "user",
                content: searchQuery,
              },
            ],
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Perplexity API error [${response.status}]:`, errorData);
          throw new Error(`Perplexity API error: ${response.status}`);
        }

        const data = await response.json();
        const searchResults = data.choices?.[0]?.message?.content?.trim() || "";
        const searchSources = data.search_results || [];
        
        // Log search sources for debugging
        if (searchSources.length > 0) {
          console.log(`Perplexity found ${searchSources.length} sources, first: ${searchSources[0]?.url || "unknown"}`);
        }
        
        // Now use OpenAI to parse the search results into structured JSON
        if (openaiClient && searchResults) {
          const parsePrompt = `You are extracting Twitter/X profile data for @${handle}. From the following information (which may include the actual Twitter profile page content), extract ONLY the profile information and return valid JSON.

IMPORTANT: Look for actual numbers, not approximations. Extract exact follower counts, following counts, and tweet counts as numbers.

Return ONLY valid JSON with this exact structure (use null for missing values, use 0 for missing numbers):
{
  "name": "string or null",
  "username": "${handle}",
  "verified": boolean or false,
  "description": "string or null",
  "location": "string or null",
  "followers_count": number or 0,
  "following_count": number or 0,
  "tweet_count": number or 0,
  "listed_count": number or 0
}

Profile information found:
${searchResults.substring(0, 3000)}

${searchSources.length > 0 ? `\nSources found:\n${searchSources.slice(0, 3).map((s: { title?: string; url?: string }) => `- ${s.title || s.url || "unknown"}: ${s.url || ""}`).join("\n")}` : ""}

Extract the profile data now:`;

          const parseResponse = await openaiClient.responses.create({
            model: "gpt-4o",
            input: [
              {
                role: "user",
                content: parsePrompt,
              },
            ],
            max_output_tokens: 800,
          });

          const parsed = parseResponse as ResponsesOutput;
          jsonText = parsed.output_text?.trim() ?? parsed.output?.[0]?.content?.[0]?.text?.trim();
        } else {
          // If no OpenAI client, try to extract info directly from search results
          jsonText = searchResults;
        }
      } catch (perplexityError) {
        console.error("Perplexity API error:", perplexityError);
        // Fallback to OpenAI if Perplexity fails
        if (!openaiClient) {
          return null;
        }
      }
    }

    // Fallback to OpenAI if Perplexity not available or failed
    if (!jsonText && openaiClient) {
      try {
        const fallbackPrompt = `Search for the Twitter/X profile information for @${handle}. Extract the following information if available:
- Full name/display name
- Username (should be ${handle})
- Verified status (blue checkmark)
- Bio/description
- Location
- Follower count (as a number)
- Following count (as a number)
- Tweet/post count (as a number)

Return ONLY valid JSON with this exact structure (use null for missing values, use 0 for missing numbers):
{
  "name": "string or null",
  "username": "${handle}",
  "verified": boolean or false,
  "description": "string or null",
  "location": "string or null",
  "followers_count": number or 0,
  "following_count": number or 0,
  "tweet_count": number or 0,
  "listed_count": number or 0
}

Search for: Twitter profile @${handle} X.com ${handle} bio followers`;

        const parseResponse = await openaiClient.responses.create({
          model: "gpt-4o",
          input: [
            {
              role: "user",
              content: fallbackPrompt,
            },
          ],
          max_output_tokens: 500,
        });

        const parsed = parseResponse as ResponsesOutput;
        jsonText = parsed.output_text?.trim() ?? parsed.output?.[0]?.content?.[0]?.text?.trim();
      } catch (openaiError) {
        console.error("OpenAI fallback error:", openaiError);
        return null;
      }
    }

    if (!jsonText) {
      console.warn("Perplexity: Failed to get response");
      return null;
    }

    // Extract JSON from response (might have markdown code blocks)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("Perplexity: No JSON found in response");
      return null;
    }

    const profileData = JSON.parse(jsonMatch[0]);
    
    // Construct XUserResponse format
    return {
      data: {
        id: `perplexity_${handle}_${Date.now()}`,
        name: profileData.name || handle,
        username: profileData.username || handle,
        verified: profileData.verified || false,
        description: profileData.description || undefined,
        location: profileData.location || undefined,
        profile_image_url: undefined,
        public_metrics: {
          followers_count: profileData.followers_count || 0,
          following_count: profileData.following_count || 0,
          tweet_count: profileData.tweet_count || 0,
          listed_count: profileData.listed_count || 0,
        },
      },
    };
  } catch (error) {
    console.error("Perplexity: Error fetching profile:", error);
    return null;
  }
};

const generateImageRoast = async (imageUrl: string | undefined, handle: string) => {
  if (!imageUrl || !openaiClient) {
    return undefined;
  }

  try {
    const response = await openaiClient.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Roast this X profile photo for @${handle}. Keep it under 80 words, spicy and chaotic, and end with a short mic-drop.`,
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "high",
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

const generateGptRoast = async (context: RoastContext) => {
  if (!openaiClient) {
    return undefined;
  }

  // Different roast style for Perplexity data (generic) vs Twitter API data (metrics-focused)
  if (context.isPerplexityData) {
    const lines = [
      `Name: ${context.name || context.handle}`,
      `Handle: @${context.handle}`,
      `Bio: ${context.bioPreview || "(no bio found)"}`,
    ];

    if (context.location) {
      lines.push(`Location: ${context.location}`);
    }

    if (context.followers > 0) {
      lines.push(`Followers: ${abbreviateNumber(context.followers)}`);
    }
    if (context.following > 0) {
      lines.push(`Following: ${abbreviateNumber(context.following)}`);
    }

    const prompt = `You are GPT-5.1, a savage-but-clever roaster with zero politeness filters. Within PG-13 boundaries, go as raw, blunt, and chaotic as possible. 

The information below was found through web search (not direct Twitter API), so focus on roasting based on what's actually available: their name, bio, location, and general online presence. Don't make up Twitter-specific metrics or engagement stats. Be creative with what you have, get creative with imagery, stay internet-native, and end with "Share this if you're not a coward." No disclaimers, no explanations.

Found information:\n${lines.join("\n")}`;

    try {
      const response = await openaiClient.responses.create({
        model: "gpt-5.1-mini",
        input: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_output_tokens: 260,
      });

      const parsed = response as ResponsesOutput;
      const roastText = parsed.output_text?.trim() ?? parsed.output?.[0]?.content?.[0]?.text?.trim();
      return roastText || undefined;
    } catch {
      return undefined;
    }
  } else {
    // Original Twitter API roast (metrics-focused)
    const lines = [
      `Handle: @${context.handle}`,
      `Followers: ${abbreviateNumber(context.followers)}`,
      `Following: ${abbreviateNumber(context.following)}`,
      `Follower ratio: ${context.followerRatio}:1`,
      `Posts: ${abbreviateNumber(context.tweetCount)}`,
      `Bio: ${context.bioPreview || "(none)"}`,
    ];

    if (typeof context.lastTweetHours === "number") {
      lines.push(`Last tweet age (hours): ${context.lastTweetHours}`);
    }
    lines.push(`Avg engagement (approx): ${context.avgEngagement}`);
    if (context.latestTweet) {
      lines.push(`Latest tweet: ${context.latestTweet}`);
    }

    const prompt = `You are GPT-5.1, a savage-but-clever roaster with zero politeness filters. Within PG-13 boundaries, go as raw, blunt, and chaotic as possible. Use the data below to write a concise roast (<= 120 words) that feels like an unfiltered creator dragging this account. Blend metrics into the insults, get creative with imagery, stay internet-native, and end with "Share this if you're not a coward." No disclaimers, no explanations.

Account data:\n${lines.join("\n")}`;

    try {
      const response = await openaiClient.responses.create({
        model: "gpt-5.1-mini",
        input: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_output_tokens: 260,
      });

      const parsed = response as ResponsesOutput;
      const roastText = parsed.output_text?.trim() ?? parsed.output?.[0]?.content?.[0]?.text?.trim();
      return roastText || undefined;
    } catch {
      return undefined;
    }
  }
};
const createElevenlabsAudio = async (text: string, retries = 2): Promise<AudioRoast | undefined> => {
  if (!text || !ELEVENLABS_KEY) {
    console.warn("ElevenLabs: Missing text or API key");
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
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusCode = response.status;
      const errorMessage = errorData?.detail?.message || errorData?.detail?.status || response.statusText;

      // Handle 429 (rate limit / system busy) with retry
      if (statusCode === 429 && retries > 0) {
        console.warn(`ElevenLabs: Rate limited (${errorMessage}), retrying in 2s... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return createElevenlabsAudio(text, retries - 1);
      }

      // Log other errors for debugging
      console.error(`ElevenLabs API error [${statusCode}]:`, errorMessage, errorData);
      
      // Common error codes
      if (statusCode === 401) {
        console.error("ElevenLabs: Invalid API key. Check ELEVENLABS_API_KEY in .env");
      } else if (statusCode === 400) {
        console.error("ElevenLabs: Bad request - check text content and model_id");
      } else if (statusCode === 403) {
        console.error("ElevenLabs: Forbidden - check subscription tier and voice access");
      } else if (statusCode === 404) {
        console.error("ElevenLabs: Voice not found - check ELEVEN_VOICE_ID");
      }

      return undefined;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      src: `data:audio/mpeg;base64,${buffer.toString("base64")}`,
      mimeType: "audio/mpeg",
      voice: "elevenlabs",
    } satisfies AudioRoast;
  } catch (error) {
    console.error("ElevenLabs: Network or parsing error:", error instanceof Error ? error.message : String(error));
    return undefined;
  }
};

export async function roastAction(_prev: RoastState, formData: FormData): Promise<RoastState> {
  const rawHandle = String(formData.get("handle") || "").trim();
  const platform = (String(formData.get("platform") || "x") as Platform) || "x";
  const usePerplexity = String(formData.get("usePerplexity") || "off") === "on";

  if (!rawHandle) {
    return { status: "error", error: "Please enter a handle." };
  }

  if (platform !== "x") {
    return { status: "error", error: "Only X handles are supported right now." };
  }

  const handle = sanitizeHandle(rawHandle).toLowerCase();

  if (!handle) {
    return { status: "error", error: "That handle looks empty. Try again." };
  }

  let userResponse: XUserResponse;
  const bearer = process.env.X_BEARER_TOKEN;

  // Use Perplexity if toggle is on
  if (usePerplexity) {
    console.log(`Using Perplexity API for @${handle} (toggle enabled)`);
    const perplexityResponse = await fetchProfileFromPerplexity(handle);
    
    if (perplexityResponse?.data) {
      userResponse = perplexityResponse;
      console.log(`Perplexity: Successfully retrieved profile for @${handle}`);
    } else {
      return {
        status: "error",
        error: "Perplexity API failed. Make sure PERPLEXITY_API_KEY is set in .env.local",
      };
    }
  } else {
    // Use Twitter API (with Perplexity fallback on rate limit)
    if (!bearer) {
      return {
        status: "error",
        error: "Server missing X_BEARER_TOKEN. Add it to .env.local and restart.",
      };
    }

    try {
      userResponse = await fetchFromX<XUserResponse>(
        `/users/by/username/${handle}?user.fields=description,profile_image_url,public_metrics,location,verified,created_at`,
        bearer,
      );
    } catch (error) {
      // If rate limited, try Perplexity fallback
      if (error instanceof RateLimitError) {
        console.warn(`X API rate limited for @${handle}, using Perplexity fallback...`);
        const perplexityResponse = await fetchProfileFromPerplexity(handle);
        
        if (perplexityResponse?.data) {
          userResponse = perplexityResponse;
          console.log(`Perplexity fallback: Successfully retrieved profile for @${handle}`);
        } else {
          return {
            status: "error",
            error: "X API rate limited and Perplexity fallback failed. Please try again later.",
          };
        }
      } else {
        return {
          status: "error",
          error: error instanceof Error ? error.message : "Unable to reach X right now.",
        };
      }
    }
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
    // Skip tweet fetching if using Perplexity fallback (no user ID available) or if bearer is not available
    if (!user.id.startsWith("perplexity_") && bearer) {
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
    }
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
  const isPerplexityData = user.id.startsWith("perplexity_");

  const aiRoast = await generateGptRoast({
    handle,
    followers,
    following,
    followerRatio,
    tweetCount,
    bioPreview,
    lastTweetHours,
    avgEngagement,
    latestTweet: tweets[0]?.text,
    platform,
    isPerplexityData,
    name: user.name,
    location: user.location,
  });

  const roastText = aiRoast || (() => {
    const roastLines: string[] = [];
    
    if (isPerplexityData) {
      // Generic roast for Perplexity data (no Twitter-specific metrics)
      roastLines.push(`@${handle}${user.name && user.name !== handle ? ` (${user.name})` : ""}, we found you through the digital void.`);
      roastLines.push(
        bioLength
          ? `Your bio says "${bioPreview}" and somehow manages to say everything and nothing at once.`
          : "No bio detected. Bold move to exist online with zero context.",
      );
      if (user.location) {
        roastLines.push(`Located in ${user.location}, which explains... well, nothing actually.`);
      }
      if (followers > 0 || following > 0) {
        roastLines.push(
          followers > 0 && following > 0
            ? `${abbreviateNumber(followers)} followers, ${abbreviateNumber(following)} following. The math checks out to... absolutely nothing.`
            : followers > 0
            ? `${abbreviateNumber(followers)} people are watching. Hope they're entertained.`
            : `Following ${abbreviateNumber(following)} accounts. That's commitment to the scroll.`
        );
      }
      roastLines.push("Share this if you're not a coward.");
    } else {
      // Original Twitter API roast (metrics-focused)
      roastLines.push(`@${handle}, ${abbreviateNumber(followers)} followers signed up for ${abbreviateNumber(tweetCount)} posts of chaos.`);
      roastLines.push(
        `You follow ${abbreviateNumber(following)} people which makes your clout exchange rate a ${followerRatio}:1 hustle.`,
      );
      roastLines.push(
        bioLength
          ? `Bio is ${bioLength} characters of "${bioPreview}" and still manages to dodge personality.`
          : "No bio detected. Bold move to give us zero context and maximum cringe.",
      );
      roastLines.push(
        avgEngagement
          ? `Recent tweets average ~${abbreviateNumber(avgEngagement)} interactions. That's not virality, that's a group chat.`
          : "Engagement registers as a flatline, so we're roasting the digital ghost of your content.",
      );
      roastLines.push(
        typeof lastTweetHours === "number"
          ? `Last tweet hit the feed ${lastTweetHours}h ago and it's already aging like milk in direct sunlight.`
          : "Couldn't find a fresh tweet. Either you're private or procrastinating content like rent."
      );
      roastLines.push("Share this if you're not a coward.");
    }
    
    return roastLines.join(" ");
  })();

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
