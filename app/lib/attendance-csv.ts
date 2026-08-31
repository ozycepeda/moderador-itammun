import type { Committee } from "./committees";
import type { Language } from "./i18n";
import type { AttendanceStatus, SessionState } from "./session-state";
import { getDisciplinaryCounts } from "./session-state";

const headers = {
  es: ["Comité", "Abreviatura", "Título de sesión", "ID de sesión", "Inicio", "Exportado", "País o representación", "Estado de asistencia", "Cupo inicial", "Observador", "Llamadas acumuladas", "Warnings activos", "Faltas"],
  en: ["Committee", "Abbreviation", "Session title", "Session ID", "Started", "Exported", "Country or representation", "Attendance status", "Initial seat", "Observer", "Total warnings", "Active warnings", "Faults"],
} as const;

const statusLabels: Record<Language, Record<AttendanceStatus, string>> = {
  es: { pending: "Sin registrar", absent: "Ausente", present: "Presente", "present-voting": "Presente y votando", observer: "Observador" },
  en: { pending: "Not recorded", absent: "Absent", present: "Present", "present-voting": "Present and voting", observer: "Observer" },
};

function csvCell(value: string | number | boolean) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function yesNo(value: boolean, language: Language) {
  return language === "es" ? (value ? "Sí" : "No") : (value ? "Yes" : "No");
}

export function buildAttendanceCsv({ committee, state, language, exportedAt = new Date().toISOString() }: {
  committee: Committee;
  state: SessionState;
  language: Language;
  exportedAt?: string;
}) {
  const assigned = new Set(state.assignedParticipantIds);
  const rows = state.participants.map((participant) => {
    const discipline = getDisciplinaryCounts(state.warnings[participant.id] ?? 0);
    const status = state.attendance[participant.id] ?? "pending";
    return [
      committee.name,
      committee.abbreviation,
      state.session.title,
      state.session.id,
      state.session.startedAt,
      exportedAt,
      participant.name,
      statusLabels[language][status],
      yesNo(assigned.has(participant.id), language),
      yesNo(participant.observer || status === "observer", language),
      discipline.totalWarnings,
      discipline.activeWarnings,
      discipline.faults,
    ];
  });

  return `\uFEFF${[headers[language], ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function attendanceCsvFilename(committeeSlug: string, sessionTitle: string, date = new Date()) {
  const safeTitle = sessionTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sesion";
  return `itammun-asistencia-${committeeSlug}-${safeTitle}-${date.toISOString().slice(0, 10)}.csv`;
}
