"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Nav from "./Nav";
import { Act, Close, Decide, Hero, Proof, Threat, Watch } from "./Scenes";
import { story } from "./story";

const NodeField = dynamic(() => import("./NodeField"), { ssr: false });

// Share of the scroll each scene gets, in viewport heights x 100: hero, watch, decide, act, proof, threat, close.
const LENGTHS = [80, 120, 140, 160, 120, 130, 80];
const TOTAL = LENGTHS.reduce((a, b) => a + b, 0);
const STARTS = LENGTHS.map((_, i) => LENGTHS.slice(0, i).reduce((a, b) => a + b, 0));

const all = (root: Element, sel: string) => Array.from(root.querySelectorAll(sel));

function Hud() {
  return (
    <>
      <div
        data-hud
        aria-hidden="true"
        className="pointer-events-none fixed bottom-5 left-5 z-30 flex items-center gap-4 opacity-0 transition-opacity duration-300 sm:bottom-7 sm:left-10"
      >
        <span className="mono text-[0.72rem] tracking-[0.14em] text-text">
          <span data-chap-num>01</span>
          <span className="text-muted"> / 05</span>
        </span>
        <span className="h-px w-8 bg-line-strong" />
        <span data-chap-name className="label" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-px origin-left scale-x-0 bg-accent/80"
        data-progress
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-5 top-1/2 z-30 hidden h-24 w-px -translate-y-1/2 bg-line sm:right-8 sm:block"
      >
        <span data-vtick className="absolute left-0 top-0 h-6 w-px origin-top bg-text" />
      </div>
    </>
  );
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);

    const scenes = gsap.utils.toArray<HTMLElement>("[data-scene]", el);
    const hudEl = el.querySelector<HTMLElement>("[data-hud]")!;
    const numEl = el.querySelector<HTMLElement>("[data-chap-num]")!;
    const nameEl = el.querySelector<HTMLElement>("[data-chap-name]")!;
    const barEl = el.querySelector<HTMLElement>("[data-progress]")!;
    const tickEl = el.querySelector<HTMLElement>("[data-vtick]")!;

    // Set by each motion mode: scroll position -> position measured in scenes.
    let computeT: () => number = () => 0;
    let activeScene = -1;

    const sync = () => {
      const t = computeT();
      story.t = t;

      const idx = Math.min(Math.floor(t + 0.001), scenes.length - 1);
      const chapter = scenes[idx]?.dataset.chapter;
      if (idx !== activeScene) {
        if (chapter !== undefined) {
          numEl.textContent = chapter;
          nameEl.textContent = scenes[idx].dataset.name ?? "";
        }
        hudEl.style.opacity = chapter !== undefined ? "1" : "0";
        activeScene = idx;
      }

      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(Math.max(y / max, 0), 1) : 0;
      barEl.style.transform = `scaleX(${p})`;
      tickEl.style.transform = `translateY(${p * 300}%)`;
    };

    const hidden = { yPercent: 110, opacity: 0, filter: "blur(10px)" };
    const shown = { yPercent: 0, opacity: 1, filter: "blur(0px)" };

    const mm = gsap.matchMedia();

    // Pinned stage: every scene is a layer in one pinned viewport, sequenced by a single scrubbed
    // timeline, so there is never an empty stretch of scroll between scenes.
    mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px) and (min-height: 620px)", () => {
      const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95 });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const stage = el.querySelector<HTMLElement>("[data-stage]")!;
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: `+=${TOTAL}%`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
        },
      });
      const st = tl.scrollTrigger!;

      scenes.forEach((s, i) => {
        const L = LENGTHS[i];
        const S = STARTS[i];
        const at = (f: number) => S + f * L;
        const dur = (f: number) => f * L;
        const content = s.querySelector("[data-content]")!;
        const isFirst = i === 0;
        const isLast = i === scenes.length - 1;

        if (!isFirst) {
          gsap.set(s, { autoAlpha: 0 });
          tl.fromTo(s, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, S - 1);
        }

        if (!isFirst) {
          const words = all(s, ".word");
          const fades = all(s, "[data-fade]");
          const rows = all(s, "[data-row]");
          const wipe = s.querySelector("[data-wipe]");
          if (words.length) {
            tl.fromTo(words, hidden, { ...shown, ease: "power2.out", stagger: dur(0.012), duration: dur(0.16) }, at(0.03));
          }
          if (fades.length) {
            tl.fromTo(
              fades,
              { opacity: 0, y: 24 },
              { opacity: 1, y: 0, ease: "power2.out", stagger: dur(0.02), duration: dur(0.12) },
              at(0.1),
            );
          }
          if (wipe) {
            tl.fromTo(wipe, { clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)", ease: "power2.inOut", duration: dur(0.22) }, at(0.04));
          }
          if (rows.length) {
            tl.fromTo(
              rows,
              { opacity: 0, x: 28 },
              { opacity: 1, x: 0, ease: "power2.out", stagger: dur(0.035), duration: dur(0.1) },
              at(0.22),
            );
          }
        }

        if (!isLast) {
          tl.to(content, { y: -48, ease: "power1.in", duration: dur(0.12) }, at(0.86));
          tl.to(s, { autoAlpha: 0, duration: dur(0.12) }, at(0.86));
        }
      });
      tl.set({}, {}, TOTAL);

      computeT = () => {
        const span = st.end - st.start;
        const u = Math.min(Math.max((window.scrollY - st.start) / span, 0), 1) * TOTAL;
        let i = STARTS.length - 1;
        while (i > 0 && u < STARTS[i]) i--;
        return i + Math.min((u - STARTS[i]) / LENGTHS[i], 1);
      };

      // Opening sequence plays once the display font is ready so words do not reflow mid-reveal.
      const hero = scenes[0];
      const intro = gsap.timeline({ paused: true, delay: 0.1 });
      intro
        .fromTo(all(hero, ".word"), hidden, { ...shown, stagger: 0.07, duration: 1.1, ease: "power3.out" })
        .fromTo(
          all(hero, "[data-fade]"),
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, stagger: 0.1, duration: 0.8, ease: "power2.out" },
          0.5,
        )
        .fromTo("[data-nav]", { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.3);
      document.fonts.ready.then(() => {
        intro.play();
        ScrollTrigger.refresh();
      });

      const onClick = (e: MouseEvent) => {
        const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
        if (!a) return;
        const id = a.getAttribute("href")!.slice(1);
        const idx = scenes.findIndex((s) => s.id === id);
        if (idx < 0) return;
        e.preventDefault();
        const f = id === "top" ? 0 : 0.34;
        lenis.scrollTo(st.start + ((STARTS[idx] + f * LENGTHS[idx]) / TOTAL) * (st.end - st.start), { duration: 1.6 });
      };
      el.addEventListener("click", onClick);

      gsap.ticker.add(sync);
      return () => {
        el.removeEventListener("click", onClick);
        gsap.ticker.remove(sync);
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    });

    // Small or short viewports: scenes flow normally and reveal as they enter.
    mm.add(
      "(prefers-reduced-motion: no-preference) and (max-width: 767px), (prefers-reduced-motion: no-preference) and (max-height: 619px)",
      () => {
        const spans = scenes.map((s) => ScrollTrigger.create({ trigger: s, start: "top 50%", end: "bottom 50%" }));
        computeT = () => {
          const y = window.scrollY;
          let t = 0;
          for (let i = 0; i < spans.length; i++) {
            if (y >= spans[i].end) {
              t = i + 1;
              continue;
            }
            if (y > spans[i].start) t = i + (y - spans[i].start) / (spans[i].end - spans[i].start);
            break;
          }
          return t;
        };

        scenes.forEach((s, i) => {
          const words = all(s, ".word");
          const others = all(s, "[data-fade], [data-row]");
          const wipe = s.querySelector("[data-wipe]");
          gsap.set(words, hidden);
          ScrollTrigger.create({
            trigger: s,
            start: i === 0 ? "top 100%" : "top 72%",
            once: true,
            onEnter: () => {
              if (words.length) gsap.to(words, { ...shown, stagger: 0.06, duration: 0.9, ease: "power3.out" });
              if (others.length) {
                gsap.fromTo(
                  others,
                  { opacity: 0, y: 18 },
                  { opacity: 1, y: 0, stagger: 0.07, duration: 0.7, ease: "power2.out", delay: 0.2 },
                );
              }
              if (wipe) {
                gsap.fromTo(
                  wipe,
                  { clipPath: "inset(0 0 0 100%)" },
                  { clipPath: "inset(0 0 0 0%)", duration: 0.9, ease: "power3.out" },
                );
              }
            },
          });
        });
        gsap.ticker.add(sync);
        return () => gsap.ticker.remove(sync);
      },
    );

    // Reduced motion: no pin, no scrub, no reveal. Content is visible as authored.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      const spans = scenes.map((s) => ScrollTrigger.create({ trigger: s, start: "top 50%", end: "bottom 50%" }));
      computeT = () => {
        const y = window.scrollY;
        let t = 0;
        for (let i = 0; i < spans.length; i++) {
          if (y >= spans[i].end) {
            t = i + 1;
            continue;
          }
          if (y > spans[i].start) t = i + (y - spans[i].start) / (spans[i].end - spans[i].start);
          break;
        }
        return t;
      };
      window.addEventListener("scroll", sync, { passive: true });
      sync();
      return () => window.removeEventListener("scroll", sync);
    });

    return () => {
      mm.revert();
    };
  }, []);

  return (
    <div ref={root} className="relative">
      <NodeField />
      <Nav />
      <main className="relative z-10">
        <div data-stage className="stage">
          <Hero />
          <Watch />
          <Decide />
          <Act />
          <Proof />
          <Threat />
          <Close />
        </div>
      </main>
      <Hud />
    </div>
  );
}
