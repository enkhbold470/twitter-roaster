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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Timer,
  ArrowUpRight,
  Volume2,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { roastAction, type RoastState, type Platform } from "@/app/actions";

const INITIAL_STATE: RoastState = { status: "idle" };
const PLACEHOLDER_IMAGE = "https://placekeanu.com/500/500";
const formatNumber = (value: number) => value.toLocaleString("en-US");

export default function Home() {
  const [state, formAction, pending] = useActionState(roastAction, INITIAL_STATE);
  const platform: Platform = "x";
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [usePerplexity, setUsePerplexity] = React.useState(false);

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

  const handleToggleAudio = () => {
    const element = audioRef.current;
    if (!element) {
      return;
    }

    if (element.paused) {
      element.currentTime = 0;
      element
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
        });
      return;
    }

    element.pause();
    setIsPlaying(false);
  };

  React.useEffect(() => {
    const element = audioRef.current;
    if (!element) {
      return undefined;
    }

    const handleEnded = () => setIsPlaying(false);
    element.addEventListener("ended", handleEnded);
    return () => {
      element.removeEventListener("ended", handleEnded);
    };
  }, [state.audio?.src]);

  React.useEffect(() => {
    if (!state.audio?.src && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [state.audio?.src]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
        <header className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Flame className="size-6" />
            <div>
              <p className="text-base font-semibold tracking-tight">RoastMyProfile.com</p>
              <p className="text-xs text-muted-foreground">Live insights from X + AI roasts</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Use desktop for better experience • Mobile scrolling enabled
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="flex flex-col rounded-lg border border-border p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
                <Wand2 className="size-5" /> Paste your handle
              </h2>
            </div>
            <form action={formAction} className="flex flex-1 flex-col gap-4">
              <div className="space-y-3">
                <Input name="handle" placeholder="@handle" aria-label="X handle" required />
                <input type="hidden" name="platform" value={platform} />
                <input type="hidden" name="usePerplexity" value={usePerplexity ? "on" : "off"} />
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
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="perplexity-toggle" className="text-sm font-medium cursor-pointer">
                      Use Perplexity API
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {usePerplexity ? "Using Perplexity search" : "Using Twitter API"}
                    </p>
                  </div>
                  <Switch
                    id="perplexity-toggle"
                    checked={usePerplexity}
                    onCheckedChange={setUsePerplexity}
                    disabled={pending}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={pending} className="flex-1">
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
              {state.status === "error" ? (
                <p className="text-sm text-destructive">{state.error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Currently only public X handles are supported.</p>
              )}
            </form>
          </section>

          <section className="flex flex-col rounded-lg border border-border p-4 shadow-sm">
            {state.profile ? (
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex items-center gap-4">
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
                {state.profile.description && (
                  <p className="text-sm leading-6 text-foreground/80 line-clamp-5">{state.profile.description}</p>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {profileMetrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div key={metric.label} className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Icon className="size-3" /> {metric.label}
                        </div>
                        <p className="mt-1 text-lg font-semibold">{formatNumber(metric.value)}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                    <BarChart3 className="size-3" /> Ratio {state.profile.metrics.followerRatio}:1
                  </span>
                  {typeof state.profile.lastTweetHours === "number" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                      <Timer className="size-3" /> {state.profile.lastTweetHours}h idle
                    </span>
                  )}
                </div>
                {state.tweets && state.tweets.length > 0 && (
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest tweet</p>
                    <p className="mt-2 line-clamp-5 text-foreground/90">{state.tweets[0].text}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{new Date(state.tweets[0].createdAt).toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="size-3" /> {formatNumber(state.tweets[0].metrics.likes)}</span>
                      <span className="inline-flex items-center gap-1"><Repeat2 className="size-3" /> {formatNumber(state.tweets[0].metrics.reposts)}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {formatNumber(state.tweets[0].metrics.replies)}</span>
                    </div>
                  </div>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`https://x.com/${state.profile.username}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                    View on X <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
                Enter a handle to pull live profile data.
              </div>
            )}
          </section>

          <section className="flex flex-col rounded-lg border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="size-4" /> Column three: profile pic + roast
            </div>
            <div className="mt-4 flex flex-1 flex-col gap-4">
              <div className="relative overflow-hidden rounded-md border border-border">
                <div className="aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewImage} alt="Profile visual" className="h-full w-full object-cover" />
                </div>
                <Sparkles className="absolute left-3 top-3 size-5 text-primary" aria-hidden="true" />
              </div>
              {state.imageRoast && (
                <p className="text-sm leading-6 text-foreground/80">{state.imageRoast}</p>
              )}
              {state.roastText ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm leading-6">
                  <p className="font-semibold text-primary">Main roast</p>
                  <p className="mt-2 line-clamp-6">{state.roastText}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Roast copy will appear here once generated.</p>
              )}
              {state.audio?.src && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                    <Volume2 className="size-3" /> ElevenLabs voice roast
                  </div>
                  <Button
                    type="button"
                    onClick={handleToggleAudio}
                    variant="outline"
                    className={`relative w-full overflow-hidden rounded-full border-primary/40 bg-gradient-to-r from-primary/5 to-transparent text-sm font-medium transition hover:border-primary/60 ${isPlaying ? "text-primary" : ""}`}
                  >
                    <span
                      className={`pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/30 blur-3xl transition ${isPlaying ? "opacity-60" : "opacity-0"}`}
                      aria-hidden="true"
                    />
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <span className={`h-2 w-1 rounded-full bg-primary transition ${isPlaying ? "animate-pulse" : "opacity-60"}`} />
                        <span className={`h-4 w-1 rounded-full bg-primary/80 transition ${isPlaying ? "animate-pulse" : "opacity-60"}`} />
                        <span className={`h-3 w-1 rounded-full bg-primary transition ${isPlaying ? "animate-pulse" : "opacity-60"}`} />
                      </span>
                      {isPlaying ? "Stop voice roast" : "Play voice roast"}
                    </span>
                  </Button>
                  <audio ref={audioRef} src={state.audio.src} preload="auto" className="hidden" />
                </div>
              )}
              {state.status === "ok" && (
                <Button type="button" variant="outline" onClick={handleShare}>
                  <Share2 className="size-4" /> Share this roast
                </Button>
              )}
            </div>
          </section>
        </div>

        <footer className="text-center text-xs opacity-60">
          Built with Next.js App Router, shadcn/ui, Tailwind. No hard-coded colors; themed via globals.css.
        </footer>
      </main>
    </div>
  );
}
