"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
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
  Play,
  Loader2,
  Twitter,
  Instagram,
  Music2,
} from "lucide-react";

type Platform = "x" | "tiktok" | "instagram";

type RoastState = {
  status: "idle" | "error" | "ok";
  handle?: string;
  platform?: Platform;
  roastText?: string;
  images?: string[];
  durationSec?: number;
  error?: string;
};

const INITIAL_STATE: RoastState = { status: "idle" };

async function roastAction(_prev: RoastState, formData: FormData): Promise<RoastState> {
  "use server";

  const rawHandle = String(formData.get("handle") || "").trim();
  const platform = (String(formData.get("platform") || "x") as Platform) || "x";

  if (!rawHandle) {
    return { status: "error", error: "Please enter a handle." };
  }

  // Minimal deterministic mock of public scraping using the handle seed.
  const handle = rawHandle.replace(/^@+/, "");
  const seed = [...handle].reduce((acc, c) => acc + c.charCodeAt(0), 0) + platform.length;
  const pseudoMetric = (mod: number, offset = 0) => (seed % mod) + offset;

  const postCount = Math.min(100, 20 + pseudoMetric(81));
  const emojiRate = (pseudoMetric(9) + 1) * 3; // per 100 words
  const likeRatio = 1 + pseudoMetric(20); // likes per post
  const overlap = 5 + pseudoMetric(30); // overlapping follows

  // Build a roughly 60s script (~120-140 words)
  const lines: string[] = [];
  const platformName = platform === "x" ? "X" : platform === "tiktok" ? "TikTok" : "Instagram";
  lines.push(
    `Alright ${handle}, welcome to RoastMyProfile dot com. Buckle up.`
  );
  lines.push(
    `I peeked at your last ${postCount} ${platformName} posts and, wow, your like ratio is hovering around ${likeRatio}:1 — and that one is probably your mom.`
  );
  lines.push(
    `Your bio reads like a group project introduction: all buzzwords, zero substance. Also, the emoji-per-100-words rate is around ${emojiRate}. Blink twice if you're okay.`
  );
  lines.push(
    `Your follower overlap game? About ${overlap} accounts in common with every other try-hard in your niche. Originality called; it wants visitation rights.`
  );
  lines.push(
    `Half of your posts look like they were edited with a toaster. The other half were clearly posted past midnight. Seek sunlight.`
  );
  lines.push(
    `Highlights include recycled audios, thirst captions in disguise, and enough hashtags to power a small search engine.`
  );
  lines.push(
    `In conclusion: you post like an algorithm hostage with Stockholm syndrome. Free yourself.`
  );
  lines.push(`Share this if you’re not a coward.`);

  const roastText = lines.join(" ");

  // Placeholder images in lieu of public photo scrape in this MVP.
  const images = Array.from({ length: 12 }).map((_, i) => `https://placekeanu.com/500?idx=${i}`);

  return {
    status: "ok",
    handle,
    platform,
    roastText,
    images,
    durationSec: 60,
  };
}

export default function Home() {
  const [state, formAction, pending] = useActionState(roastAction, INITIAL_STATE);
  const [spoken, setSpoken] = useState(false);
  const [platform, setPlatform] = useState<Platform>("x");
  const canSpeak = typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  useEffect(() => {
    setSpoken(false);
  }, [state?.roastText]);

  const handleSpeak = () => {
    if (!canSpeak || !state?.roastText) return;
    const utter = new SpeechSynthesisUtterance(state.roastText);
    utter.rate = 1;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      setSpoken(true);
    } catch (e) {
      // noop
    }
  };

  const shareText = useMemo(() => {
    if (!state?.roastText || !state?.handle) return "RoastMyProfile.com";
    return `Roast for @${state.handle}: ${state.roastText}`;
  }, [state?.roastText, state?.handle]);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "https://RoastMyProfile.com";
    try {
      if (navigator.share) {
        await navigator.share({ title: "RoastMyProfile", text: shareText, url });
        return;
      }
    } catch (_) {
      // fallthrough to clipboard
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      alert("Link copied. Be brave.");
    } catch (_) {
      // no clipboard, no problem
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="size-6" />
            <h1 className="text-xl font-semibold tracking-tight">RoastMyProfile.com</h1>
          </div>
          <div className="text-sm opacity-70">MVP • One URL</div>
        </header>

        <section className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
            <Wand2 className="size-5" /> Paste your handle
          </h2>
          <form action={formAction} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,160px]">
              <Input
                name="handle"
                placeholder="@handle"
                aria-label="Social handle"
                required
              />
              {/* Controlled shadcn Select + hidden input for form post */}
              <input type="hidden" name="platform" value={platform} />
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger aria-label="Platform">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="x">
                    <span className="inline-flex items-center gap-2"><Twitter className="size-4" /> X</span>
                  </SelectItem>
                  <SelectItem value="tiktok">
                    <span className="inline-flex items-center gap-2"><Music2 className="size-4" /> TikTok</span>
                  </SelectItem>
                  <SelectItem value="instagram">
                    <span className="inline-flex items-center gap-2"><Instagram className="size-4" /> Instagram</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Roasting…</span>
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
          </form>
        </section>

        {state.status === "ok" && (
          <section className="rounded-lg border border-border p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">Your 60s Roast Preview</h3>
              <div className="text-sm opacity-70">@{state.handle} • {state.platform?.toUpperCase()}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[240px,1fr]">
              <div className="relative overflow-hidden rounded-md border border-border">
                {/* Faux video frame: simple slideshow */}
                <div className="aspect-square bg-muted">
                  {/* Use first image as poster */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.images?.[0]} alt="preview" className="h-full w-full object-cover" />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/70 to-transparent p-2">
                  <div className="h-1 w-full overflow-hidden rounded bg-border">
                    <div className="h-full w-1/2 animate-[progress_3s_linear_infinite] bg-primary" style={{animationDuration: "3s"}} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm leading-6 opacity-90">{state.roastText}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" onClick={handleSpeak} disabled={!canSpeak || !state.roastText}>
                    <Play className="size-4" /> Play voice
                  </Button>
                  <Button type="button" variant="outline" onClick={handleShare}>
                    <Share2 className="size-4" /> Share this
                  </Button>
                </div>
                <p className="text-xs opacity-60">Ends with “Share this if you’re not a coward.”</p>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-8 text-center text-xs opacity-60">
          Built with Next.js App Router, shadcn/ui, Tailwind. No hard-coded colors; themed via globals.css.
        </footer>
      </main>
    </div>
  );
}
