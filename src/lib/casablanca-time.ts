/** Date et heure saisies à l'heure du Maroc (Africa/Casablanca), converties en instant UTC. */
export function casablancaToDate(date: string, time: string) {
  const asUtc = new Date(`${date}T${time}:00Z`);
  // Décalage réel du fuseau à cette date (il change pendant le ramadan).
  const offset = new Intl.DateTimeFormat("en", { timeZone: "Africa/Casablanca", timeZoneName: "longOffset" })
    .formatToParts(asUtc)
    .find((p) => p.type === "timeZoneName")?.value; // ex. "GMT+01:00" ou "GMT"
  const m = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = m ? (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(asUtc.getTime() - minutes * 60_000);
}

/** Date (AAAA-MM-JJ) et heure (HH:MM) actuelles au Maroc, pour pré-remplir les formulaires. */
export function casablancaNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}
