import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { DrivingCar } from "@/components/car-art";
import { Scenery } from "@/components/scenery";

/** Mise en page commune des écrans de connexion : formulaire à gauche, route et voiture à droite. */
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const tc = await getTranslations("Common");
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1fr] lg:py-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="display-md text-4xl text-ink">{title}</h1>
        {subtitle && <p className="mt-3 leading-relaxed text-ink-3">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
      <div className="relative hidden overflow-hidden rounded-[30px] bg-asphalt lg:block" aria-hidden>
        <Scenery className="absolute inset-x-0 top-[22%] h-[38%] text-white/10" />
        <svg className="absolute inset-x-0 top-[63%] h-2 w-full" preserveAspectRatio="none" viewBox="0 0 600 8">
          <line x1="0" y1="4" x2="600" y2="4" stroke="var(--saffron)" strokeWidth="5" strokeDasharray="44 30" className="lane-run" />
        </svg>
        <DrivingCar category="cabriolet" color="#f2b53a" messages={[tc("hello"), tc("welcome"), tc("mission")]} className="car-arrive absolute inset-x-[4%] top-[30%] w-[92%]" />
      </div>
    </div>
  );
}
