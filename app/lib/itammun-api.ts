import type { LocalizedText } from "./catalog-translations";
import { topicTranslation } from "./catalog-translations";
import type { Committee } from "./committees";
import type { Language } from "./i18n";

export type RepresentationKind = "delegation" | "judge" | "observer" | "custom";
export type RepresentationStatus = "occupied" | "available";

export type Representation = {
  id: string;
  name: string;
  nameByLanguage?: LocalizedText;
  secondaryNameByLanguage?: LocalizedText;
  flagUrl?: string;
  countryCode?: string;
  observer: boolean;
  kind?: RepresentationKind;
  status?: RepresentationStatus;
  searchTerms?: string[];
};

export type CommitteeTopic = {
  id: string;
  title: string;
  titleByLanguage: LocalizedText;
};

export type CommitteeDetail = {
  topics: CommitteeTopic[];
  representations: Representation[];
  initiallyAssignedRepresentationIds: string[];
  source: "live" | "unavailable" | "blank";
};

type PublicRepresentation = {
  id?: unknown;
  name?: unknown;
  flagUrl?: unknown;
  status?: unknown;
};

type PublicTopic = { title?: unknown };

type PublicDebateResponse = {
  ok?: unknown;
  available?: unknown;
  debate?: {
    topics?: PublicTopic[];
    representations?: PublicRepresentation[];
  } | null;
};

const DEFAULT_CATALOG_BASE_URL = "https://itammun.itam.mx/api/public";

function catalogBaseUrl() {
  const configured = typeof process !== "undefined" ? process.env.ITAMMUN_API_BASE_URL?.trim() : undefined;
  return (configured || DEFAULT_CATALOG_BASE_URL).replace(/\/$/, "");
}

function countryCodeFromFlag(flagUrl?: string) {
  return flagUrl?.match(/\/([a-z]{2})\.png(?:\?|$)/i)?.[1]?.toUpperCase();
}

function localizedCountry(code: string | undefined, fallback: string, language: Language) {
  if (!code) return fallback;
  try {
    return new Intl.DisplayNames([language === "es" ? "es-MX" : "en"], { type: "region" }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

function stripObserverLabel(name: string) {
  return name.replace(/\s*\((?:observador|observer)\)\s*$/i, "").trim();
}

function normalizeRepresentation(raw: PublicRepresentation, committee: Committee): Representation | null {
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const flagUrl = typeof raw.flagUrl === "string" ? raw.flagUrl : undefined;
  const countryCode = countryCodeFromFlag(flagUrl);
  const status: RepresentationStatus = raw.status === "occupied" ? "occupied" : "available";
  const observer = /\((?:observador|observer)\)\s*$/i.test(raw.name);

  if (committee.representationType === "juez") {
    const [judgeName, ...countryParts] = raw.name.split(/\s+—\s+/);
    const rawCountry = countryParts.join(" — ").trim();
    const adHoc = /\(judge ad hoc\)\s*$/i.test(rawCountry);
    const countryFallback = rawCountry.replace(/\s*\(judge ad hoc\)\s*$/i, "").trim();
    const countryEs = localizedCountry(countryCode, countryFallback, "es");
    const countryEn = localizedCountry(countryCode, countryFallback, "en");
    const secondaryNameByLanguage = {
      es: `${countryEs}${adHoc ? " (juez ad hoc)" : ""}`,
      en: `${countryEn}${adHoc ? " (judge ad hoc)" : ""}`,
    };
    return {
      id: raw.id,
      name: raw.name,
      nameByLanguage: { es: judgeName, en: judgeName },
      secondaryNameByLanguage,
      flagUrl,
      countryCode,
      observer: false,
      kind: "judge",
      status,
      searchTerms: [raw.name, judgeName, rawCountry, countryEs, countryEn],
    };
  }

  const rawCountry = stripObserverLabel(raw.name);
  const countryEs = localizedCountry(countryCode, rawCountry, "es");
  const countryEn = localizedCountry(countryCode, rawCountry, "en");
  const nameByLanguage = {
    es: `${countryEs}${observer ? " (Observador)" : ""}`,
    en: `${countryEn}${observer ? " (Observer)" : ""}`,
  };
  return {
    id: raw.id,
    name: raw.name,
    nameByLanguage,
    flagUrl,
    countryCode,
    observer,
    kind: observer ? "observer" : "delegation",
    status,
    searchTerms: [raw.name, countryEs, countryEn],
  };
}

export function representationPrimaryName(representation: Representation, language: Language) {
  return representation.nameByLanguage?.[language] ?? representation.name;
}

export function representationSecondaryName(representation: Representation, language: Language) {
  return representation.secondaryNameByLanguage?.[language] ?? "";
}

export function representationFullName(representation: Representation, language: Language) {
  const primary = representationPrimaryName(representation, language);
  const secondary = representationSecondaryName(representation, language);
  return secondary ? `${primary} — ${secondary}` : primary;
}

export function representationMatches(representation: Representation, query: string, language: Language) {
  const normalizedQuery = query.trim().toLocaleLowerCase(language);
  if (!normalizedQuery) return true;
  return [representationFullName(representation, language), ...(representation.searchTerms ?? [])]
    .some((term) => term.toLocaleLowerCase(language).includes(normalizedQuery));
}

export function topicDisplayTitle(topic: CommitteeTopic, language: Language) {
  return topic.titleByLanguage[language] || topic.title;
}

export function blankCommitteeDetail(): CommitteeDetail {
  return { topics: [], representations: [], initiallyAssignedRepresentationIds: [], source: "blank" };
}

export async function getCommitteeDetail(
  committee: Committee,
  fetcher: typeof fetch = fetch,
): Promise<CommitteeDetail> {
  try {
    const response = await fetcher(`${catalogBaseUrl()}/debates/${encodeURIComponent(committee.id)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`);
    const payload = await response.json() as PublicDebateResponse;
    if (payload.ok !== true || payload.available !== true || !payload.debate) throw new Error("Committee unavailable");

    const representations = (payload.debate.representations ?? [])
      .map((item) => normalizeRepresentation(item, committee))
      .filter((item): item is Representation => item !== null);
    const topics = (payload.debate.topics ?? []).flatMap((topic, index) => {
      if (typeof topic.title !== "string") return [];
      return [{
        id: `${committee.id}:topic:${index + 1}`,
        title: topic.title,
        titleByLanguage: topicTranslation(committee.slug, index, topic.title),
      }];
    });

    return {
      topics,
      representations,
      initiallyAssignedRepresentationIds: representations.filter((item) => item.status === "occupied").map((item) => item.id),
      source: "live",
    };
  } catch {
    return { topics: [], representations: [], initiallyAssignedRepresentationIds: [], source: "unavailable" };
  }
}
