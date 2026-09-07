import type { Language } from "../app/lib/i18n";
import type { AttendanceExportRow } from "./attendance-store";

const headers = {
  es: [
    "Comité", "Abreviatura", "Título de sesión", "ID de sesión", "Inicio", "Cierre",
    "Recibido", "Expira", "Participante o juez", "País o representación", "Estado",
    "Código de país", "Tipo", "Observador", "Llamadas acumuladas", "Warnings activos", "Faltas",
  ],
  en: [
    "Committee", "Abbreviation", "Session title", "Session ID", "Started", "Closed",
    "Received", "Expires", "Participant or judge", "Country or representation", "Status",
    "Country code", "Type", "Observer", "Total warnings", "Active warnings", "Faults",
  ],
} as const;

const statusLabels = {
  es: { pending: "Sin registrar", absent: "Ausente", present: "Presente", "present-voting": "Presente y votando", observer: "Observador" },
  en: { pending: "Not recorded", absent: "Absent", present: "Present", "present-voting": "Present and voting", observer: "Observer" },
} as const;

function csvCell(value: string | number | boolean) {
  const normalized = String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function yesNo(value: boolean, language: Language) {
  return language === "es" ? (value ? "Sí" : "No") : (value ? "Yes" : "No");
}

export function buildAdminAttendanceCsv(rows: AttendanceExportRow[], language: Language) {
  const data = rows.map((row) => {
    const primaryName = language === "es" ? row.primaryNameEs : row.primaryNameEn;
    const secondaryName = language === "es" ? row.secondaryNameEs : row.secondaryNameEn;
    return [
      language === "es" ? row.committeeNameEs : row.committeeNameEn,
      language === "es" ? row.committeeAbbreviationEs : row.committeeAbbreviationEn,
      row.title,
      row.id,
      row.startedAt,
      row.closedAt,
      row.receivedAt,
      row.expiresAt,
      primaryName,
      secondaryName,
      statusLabels[language][row.attendanceStatus],
      row.countryCode,
      row.representationKind,
      yesNo(row.observer, language),
      row.warningsTotal,
      row.warningsActive,
      row.faults,
    ];
  });
  return `\uFEFF${[headers[language], ...data].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
