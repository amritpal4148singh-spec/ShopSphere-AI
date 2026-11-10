"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

import { ProductImage } from "@/features/products";
import { formatInr } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { RecommendedProduct } from "@/services/recommendations";
import { isOnSale } from "@/utils/discovery";
import { useRecommendations } from "../hooks/use-recommendations";

const PICK_COUNT = 3;

/**
 * Where each tile sits. Below `md` the three picks are an even strip on a sand panel; from `md` up they sit on the orbit
 * composition: one arch-framed lead product and two round medallions. Percentages keep it proportional at every width.
 */
const TILE_LAYOUT = [
  { position: "md:absolute md:left-[5%] md:top-[9%] md:w-[50%]", depth: "14px", enter: "[animation-delay:380ms]", float: "" },
  { position: "md:absolute md:right-[1%] md:top-[3%] md:w-[31%]", depth: "-22px", enter: "[animation-delay:500ms]", float: "animate-float" },
  { position: "md:absolute md:bottom-[3%] md:right-[7%] md:w-[33%]", depth: "26px", enter: "[animation-delay:620ms]", float: "animate-float-slow [animation-delay:-5s]" },
] as const;

/** The stage's quiet architecture: a navy arch behind the lead product, hairline gold orbits and one satellite. Decorative. */
function OrbitArt({ empty }: { empty: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
      <div className="absolute inset-0 rounded-full border border-gold/70" />
      <div className="absolute inset-[12%] rounded-full border border-dashed border-gold/55" />
      <div className="hero-parallax absolute left-[21%] top-[13%] h-[80%] w-[52%]" style={{ "--depth": "-10px" } as React.CSSProperties}>
        <div className="size-full rounded-t-full bg-ink shadow-[0_40px_70px_-34px_color-mix(in_srgb,var(--navy-deep)_75%,transparent)]" />
        {empty ? <Sparkles className="absolute left-1/2 top-1/3 size-16 -translate-x-1/2 text-gold" /> : null}
      </div>
      <div className="absolute inset-0 animate-orbit">
        <span className="absolute left-1/2 top-0 -ml-3 -mt-3 size-6 rounded-full border border-gold-edge bg-cta shadow-sm ring-4 ring-background" />
      </div>
      <span className="absolute bottom-[18%] left-[12%] size-2 rounded-full bg-gold" />
    </div>
  );
}

function TileSkeleton({ index }: { index: number }) {
  const layout = TILE_LAYOUT[index]!;
  return (
    <li aria-hidden="true" className={cn("min-w-0", layout.position)}>
      <div className="rounded-3xl border bg-card p-2 shadow-sm md:p-2.5">
        <div className="aspect-[4/5] animate-pulse rounded-t-full rounded-b-xl bg-muted md:rounded-b-2xl" />
        <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </li>
  );
}

function Tile({ item, index }: { item: RecommendedProduct; index: number }) {
  const { product, reasons } = item;
  const layout = TILE_LAYOUT[index]!;
  const main = index === 0;
  const onSale = isOnSale(product);

  return (
    <li className={cn("min-w-0 animate-settle", layout.position, layout.enter)}>
      <div className="hero-parallax" style={{ "--depth": layout.depth } as React.CSSProperties}>
        <Link
          href={`/products/${product.id}`}
          aria-label={`Featured: ${product.title}, ${formatInr(product.finalPrice)}`}
          className={cn(
            "group block rounded-3xl border border-border bg-card p-2 text-card-foreground shadow-lift transition duration-300 hover:-translate-y-1 hover:border-gold motion-reduce:hover:translate-y-0 md:p-2.5",
            layout.float,
          )}
        >
          {/* The lead product sits in an arch; the supporting picks become round medallions from md up. */}
          <div
            className={cn(
              "relative aspect-[4/5] overflow-hidden rounded-t-full bg-[radial-gradient(circle_at_50%_38%,var(--surface),var(--muted))]",
              main ? "rounded-b-2xl" : "rounded-b-xl md:aspect-square md:rounded-full",
            )}
          >
            <ProductImage
              src={product.thumbnail}
              sizes={main ? "(min-width: 1024px) 280px, (min-width: 768px) 40vw, 30vw" : "(min-width: 1024px) 160px, (min-width: 768px) 20vw, 30vw"}
              priority={main}
              className="transition-transform duration-500 ease-out group-hover:scale-[1.06] motion-reduce:transform-none"
            />
            {onSale ? (
              <span data-discount-badge className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sale px-2 py-0.5 text-[0.65rem] font-bold leading-4 text-sale-foreground md:text-xs">
                {`${Math.round(product.discountPercentage)}% off`}
              </span>
            ) : null}
          </div>

          <div className="mt-2 px-1 pb-1 md:mt-3">
            {reasons[0] ? (
              <p className={cn("items-center gap-1 text-xs font-semibold text-gold-ink", main ? "hidden md:flex" : "hidden")}>
                <Sparkles aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">{reasons[0]}</span>
              </p>
            ) : null}
            <p className={cn("font-semibold leading-snug", main ? "mt-0.5 line-clamp-1 text-xs md:line-clamp-2 md:text-base" : "line-clamp-1 text-xs md:mt-0.5 md:text-sm")}>{product.title}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className={cn("font-display font-semibold tracking-tight", main ? "text-sm md:text-xl" : "text-sm md:text-base")}>{formatInr(product.finalPrice)}</span>
              {onSale ? <span className="hidden text-xs text-muted-foreground line-through md:inline">{formatInr(product.price)}</span> : null}
            </p>
            {main && reasons[1] ? <p className="mt-1 hidden text-xs text-muted-foreground md:block">{reasons[1]}</p> : null}
          </div>
        </Link>
      </div>
    </li>
  );
}

/**
 * The hero's product showcase. It shows the top of the same Featured recommendation the Featured Products rail uses
 * (one shared query), so what it shows is real catalogue data with the engine's own reasons, never hard-coded.
 * While the catalogue loads it holds its footprint with placeholders; if it cannot load, only the decorative orbit
 * remains. Pointer parallax is set through CSS variables, so it causes no re-renders.
 */
export function HeroShowcase() {
  const state = useRecommendations({ strategy: "featured" });
  const stageRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const picks = state.status === "ready" ? state.result.items.slice(0, PICK_COUNT) : [];

  function setPointer(x: number, y: number) {
    stageRef.current?.style.setProperty("--px", x.toFixed(3));
    stageRef.current?.style.setProperty("--py", y.toFixed(3));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    // A mouse on a screen that can hover, and only if motion is welcome. Touch and pen input never move the stage.
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPointer(((clientX - rect.left) / rect.width - 0.5) * 2, ((clientY - rect.top) / rect.height - 0.5) * 2);
    });
  }

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        cancelAnimationFrame(frame.current);
        setPointer(0, 0);
      }}
      className={cn(
        "hero-stage relative mx-auto w-full max-w-[34rem] rounded-3xl bg-muted p-3 md:aspect-square md:rounded-none md:bg-transparent md:p-0 lg:ml-auto lg:mr-0",
        // Nothing to show on a phone when the catalogue is unavailable: skip the empty panel.
        state.status === "unavailable" && "max-md:hidden",
      )}
    >
      <OrbitArt empty={state.status === "unavailable"} />
      {state.status === "unavailable" ? null : (
        <ul aria-label="Featured picks" className="relative grid grid-cols-3 gap-2 md:static md:block md:size-full">
          {state.status === "ready" ? picks.map((item, index) => <Tile key={item.product.id} item={item} index={index} />) : TILE_LAYOUT.map((_, index) => <TileSkeleton key={index} index={index} />)}
        </ul>
      )}
    </div>
  );
}
