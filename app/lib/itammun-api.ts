export type Representation = {
  id: string;
  name: string;
  flagUrl?: string;
  observer: boolean;
};

export type CommitteeDetail = {
  topics: string[];
  representations: Representation[];
};

// Adaptador local de catálogo. En producción podrá sustituirse por una llamada
// de sólo lectura al catálogo existente sin cambiar las pantallas de setup.
export { getTestCommitteeDetail as getCommitteeDetail } from "./test-catalog";
