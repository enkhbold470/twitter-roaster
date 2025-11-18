"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Flame,
  Wand2,
  Share2,
  Loader2,
  Twitter,
  BadgeCheck,
  MapPin,
  Users,
  BarChart3,
  MessageSquare,
  Repeat2,
  Heart,
  Quote,
  Timer,
  ArrowUpRight,
  Volume2,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { roastAction, type RoastState, type Platform } from "@/app/actions";

const INITIAL_STATE: RoastState = { status: "idle" };
const PLACEHOLDER_IMAGE = "https://placekeanu.com/500?idx=0";
const formatNumber = (value: number) => value.toLocaleString("en-US");

export default function Home() {
  const [state, formAction, pending] = useActionState(roastAction, INITIAL_STATE);
  const platform: Platform = "x";

  const shareText = useMemo(() => {
    if (!state?.roastText || !state?.handle) return "RoastMyProfile.com";
    return `Roast for @${state.handle}: ${state.roastText}`;
  }, [state?.roastText, state?.handle]);

  const previewImage = state.profile?.profileImageUrl ?? state.images?.[0] ?? PLACEHOLDER_IMAGE;
  const profileMetrics = state.profile
    ? [
        { label: "Followers", value: state.profile.metrics.followers, icon: Users },
        { label: "Following", value: state.profile.metrics.following, icon: Repeat2 },
        { label: "Posts", value: state.profile.metrics.tweets, icon: BarChart3 },
        { label: "Listed", value: state.profile.metrics.listed, icon: MessageSquare },
      ]
    : [];

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "https://RoastMyProfile.com";
    try {
      if (navigator.share) {
        await navigator.share({ title: "RoastMyProfile", text: shareText, url });
        return;
      }
    } catch {
      // fallthrough to clipboard
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      alert("Link copied. Be brave.");
    } catch {
      // no clipboard, no problem
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-6xl flex-col gap-6 px-6 pt-12 pb-6">
        <header className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Flame className="size-6" />
            <div>
              <p className="text-base font-semibold tracking-tight">RoastMyProfile.com</p>
              <p className="text-xs text-muted-foreground">Live insights from X + AI roasts</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Recording-friendly layout • No scrolling the entire page
          </div>
        </header>

        <div className="grid h-full gap-6 overflow-hidden lg:grid-cols-[1.15fr,0.85fr]">
          <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
            <section className="rounded-lg border border-border p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
                <Wand2 className="size-5" /> Paste your handle
              </h2>
              <form action={formAction} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,160px]">
                  <Input
                    name="handle"
                    placeholder="@handle"
                    aria-label="X handle"
                    required
                  />
                  <input type="hidden" name="platform" value={platform} />
                  <Select value={platform} disabled>
                    <SelectTrigger aria-label="Platform">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="x">
                        <span className="inline-flex items-center gap-2 text-sm"><Twitter className="size-4" /> X (Live data)</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={pending}>
                    {pending ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Roasting...</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><Flame className="size-4" /> Roast Me</span>
                    )}
                  </Button>
                  <Link href="https://github.com" target="_blank" className="text-sm underline underline-offset-4">
                    How it works
                  </Link>
                </div>
                {state.status === "error" && (
                  <p className="text-sm text-destructive">{state.error}</p>
                )}
                <p className="text-xs text-muted-foreground">Currently only public X handles are supported.</p>
              </form>
            </section>

            {state.profile && (
              <section className="rounded-lg border border-border p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-1 items-center gap-4">
                    <div className="size-16 overflow-hidden rounded-full border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={state.profile.profileImageUrl ?? PLACEHOLDER_IMAGE} alt={`${state.profile.name} avatar`} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-lg font-semibold">
                        <span className="truncate">{state.profile.name}</span>
                        {state.profile.verified && <BadgeCheck className="size-4 text-sky-500" aria-label="Verified" />}
                      </div>
                      <p className="text-sm text-muted-foreground">@{state.profile.username}</p>
                      {state.profile.location && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {state.profile.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`https://x.com/${state.profile.username}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                      View on X <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </div>
                {state.profile.description && (
                  <p className="mt-4 text-sm leading-6 text-foreground/80">{state.profile.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                    <BarChart3 className="size-3" /> Ratio {state.profile.metrics.followerRatio}:1
                  </span>
                  {typeof state.profile.lastTweetHours === "number" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                      <Timer className="size-3" /> Last tweet {state.profile.lastTweetHours}h ago
                    </span>
                  )}
                  {typeof state.profile.avgEngagement === "number" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                      <Heart className="size-3" /> ~{state.profile.avgEngagement} engagements
                    </span>
                  )}
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {profileMetrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div key={metric.label} className="rounded-lg border border-border p-3">
                        <Icon className="size-4 text-muted-foreground" />
                        <p className="mt-2 text-xl font-semibold">{formatNumber(metric.value)}</p>
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {state.imageRoast && (
              <section className="rounded-lg border border-border p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="size-16 overflow-hidden rounded-full border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewImage} alt="Profile avatar" className="h-full w-full object-cover" />
                    </div>
                    <Sparkles className="absolute -bottom-2 -right-2 size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ImageIcon className="size-4" /> AI photo roast
                    </div>
                    <p className="mt-2 text-sm leading-6 text-foreground/90">{state.imageRoast}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Generated with OpenAI vision. This roast is AI-created.</p>
                  </div>
                </div>
              </section>
            )}

            {state.audio?.src && (
              <section className="rounded-lg border border-border p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Volume2 className="size-4" /> Voice roast (ElevenLabs)
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generated with ElevenLabs voice {state.audio.voice}. This audio is synthetic.
                </p>
                <audio
                  className="mt-3 w-full"
                  controls
                  src={state.audio.src}
                  aria-label="AI voice roast"
                />
              </section>
            )}
          </div>

          <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
            {state.tweets && state.tweets.length > 0 && (
              <section className="rounded-lg border border-border p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-medium">Recent tweets we actually read</h3>
                  {typeof state.profile?.avgEngagement === "number" && (
                    <span className="text-xs text-muted-foreground">Avg engagement ~{formatNumber(state.profile.avgEngagement)}</span>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {state.tweets.map((tweet) => (
                    <article key={tweet.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm leading-6 text-foreground/90">{tweet.text}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(tweet.createdAt).toLocaleString()}</span>
                        <span className="inline-flex items-center gap-1"><Heart className="size-3" /> {formatNumber(tweet.metrics.likes)}</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {formatNumber(tweet.metrics.replies)}</span>
                        <span className="inline-flex items-center gap-1"><Repeat2 className="size-3" /> {formatNumber(tweet.metrics.reposts)}</span>
                        <span className="inline-flex items-center gap-1"><Quote className="size-3" /> {formatNumber(tweet.metrics.quotes)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {state.status === "ok" && (
              <section className="rounded-lg border border-border p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-medium">Your 60s Roast Preview</h3>
                  <div className="text-sm opacity-70">@{state.handle} &middot; {state.platform?.toUpperCase()}</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[240px,1fr]">
                  <div className="relative overflow-hidden rounded-md border border-border">
                    <div className="aspect-square bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewImage} alt="Roast preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/70 to-transparent p-2">
                      <div className="h-1 w-full overflow-hidden rounded bg-border">
                        <div className="h-full w-1/2 animate-[progress_3s_linear_infinite] bg-primary" style={{ animationDuration: "3s" }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <p className="text-sm leading-6 opacity-90">{state.roastText}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" onClick={handleShare}>
                        <Share2 className="size-4" /> Share this
                      </Button>
                    </div>
                    <p className="text-xs opacity-60">Ends with &quot;Share this if you&#39;re not a coward.&quot;</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="text-center text-xs opacity-60">
          Built with Next.js App Router, shadcn/ui, Tailwind. No hard-coded colors; themed via globals.css.
        </footer>
      </main>
    </div>
  );
}
