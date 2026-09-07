import type { Language } from "./i18n";

export type LocalizedText = Record<Language, string>;

export const officialTopicTranslations: Record<string, LocalizedText[]> = {
  "onu-mujeres": [
    {
      es: "Tópico A: Reducción de la brecha de género en la prestación de asistencia humanitaria a mujeres y niñas desplazadas por conflictos armados en la República de Sudán",
      en: "Topic A: Reducing the gender gap in humanitarian assistance for women and girls displaced by armed conflict in the Republic of Sudan",
    },
    {
      es: "Tópico B: El impacto de la IA y la educación en el respeto a la diversidad de género y la comunidad LGBTIQ+ en la región Asia-Pacífico",
      en: "Topic B: The impact of AI and education on respect for gender diversity and the LGBTIQ+ community in the Asia-Pacific region",
    },
  ],
  acnur: [
    {
      es: "Tópico A: Protección internacional de solicitantes de asilo frente a deportaciones y traslados a terceros países en el corredor migratorio entre Venezuela, Haití, El Salvador y Estados Unidos",
      en: "Topic A: International protection of asylum seekers from deportation and transfer to third countries along the migration corridor between Venezuela, Haiti, El Salvador, and the United States",
    },
    {
      es: "Tópico B: Protección regional para refugiados derivados del conflicto entre Rusia y Ucrania",
      en: "Topic B: Regional protection for refugees displaced by the conflict between Russia and Ukraine",
    },
  ],
  unicef: [
    {
      es: "Tópico A: Protección de niñas, niños y adolescentes frente a la explotación y el abuso sexual en línea en América Latina: cooperación internacional y responsabilidad de las plataformas digitales",
      en: "Topic A: Protecting children and adolescents from online sexual exploitation and abuse in Latin America: international cooperation and accountability of digital platforms",
    },
    {
      es: "Tópico B: Acceso equitativo a servicios básicos para la primera infancia en Gaza frente al conflicto armado",
      en: "Topic B: Equitable access to essential early-childhood services in Gaza amid armed conflict",
    },
  ],
  cij: [
    {
      es: "Caso: Bosnia y Herzegovina contra la República Federal de Yugoslavia",
      en: "Case: Bosnia and Herzegovina v. The Federal Republic of Yugoslavia",
    },
  ],
  onudi: [
    {
      es: "Tópico A: Los efectos de la inteligencia artificial en el mercado laboral y en la desigualdad económica y social de los países en desarrollo",
      en: "Topic A: The Effects of Artificial Intelligence on the Labor Market and on Economic and Social Inequality in Developing Countries",
    },
    {
      es: "Tópico B: Industrialización eficiente y equitativa en los países menos desarrollados para alcanzar la seguridad alimentaria",
      en: "Topic B: Efficient and Equitable Industrialization in Least Developed Countries to Achieve Food Security",
    },
  ],
  cepa: [
    {
      es: "Tópico A: Estrategias para la reconstrucción económica y el desarrollo del comercio frente a la inestabilidad causada por los conflictos del Movimiento 23 en la República Democrática del Congo",
      en: "Topic A: Strategies for economic reconstruction and trade development amid instability caused by the March 23 Movement conflict in the Democratic Republic of the Congo",
    },
    {
      es: "Tópico B: Mecanismos para desarrollar y consolidar el financiamiento de una muralla verde en el Sahara y el Sahel frente al acaparamiento de tierras y el surgimiento de créditos de carbono",
      en: "Topic B: Mechanisms to develop and consolidate financing for a Great Green Wall in the Sahara and Sahel amid land grabbing and the emergence of carbon credits",
    },
  ],
  "banco-mundial": [
    {
      es: "Tópico A: Fortalecimiento fiscal e institucional en América Latina: abordar la corrupción para reducir la pobreza y mejorar el desarrollo",
      en: "Topic A: Fiscal and institutional strengthening in Latin America: addressing corruption to reduce poverty and improve development",
    },
    {
      es: "Tópico B: Resiliencia económica en América Latina: inclusión financiera y educación digital",
      en: "Topic B: Economic resilience in Latin America: financial inclusion and digital education",
    },
  ],
  "consejo-de-seguridad": [
    {
      es: "Tópico A: La expansión de los grupos yihadistas en África y sus implicaciones para la paz y la seguridad internacionales: el caso de la Alianza de Estados del Sahel",
      en: "Topic A: The expansion of jihadist groups in Africa and its implications for international peace and security: the case of the Alliance of Sahel States",
    },
    {
      es: "Tópico B: Amenazas a la paz en la República Democrática del Congo y la región de los Grandes Lagos: la insurgencia del Movimiento 23 de Marzo y su financiamiento mediante el contrabando de coltán",
      en: "Topic B: Threats to peace in the Democratic Republic of the Congo and the Great Lakes region: the March 23 Movement insurgency and its financing through coltan smuggling",
    },
  ],
  interpol: [
    {
      es: "Tópico A: Estrategias para prevenir y combatir las redes de tráfico ilícito de migrantes en la ruta de Centro y Sudamérica hacia Norteamérica",
      en: "Topic A: Strategies to prevent and combat migrant-smuggling networks along routes from Central and South America to North America",
    },
    {
      es: "Tópico B: El papel de Meta, TikTok y Google en el reclutamiento infantil por el crimen organizado transnacional: vacíos de responsabilidad penal de las redes sociales como plataformas de captación en América Latina",
      en: "Topic B: The role of Meta, TikTok, and Google in child recruitment by transnational organized crime: gaps in criminal accountability for social networks used as recruitment platforms in Latin America",
    },
  ],
  otan: [
    {
      es: "Tópico A: Determinación de parámetros normativos y operativos para regular la presencia militar en la región del Ártico",
      en: "Topic A: Determination of Normative and Operational Parameters for Regulating the Military Presence in the Arctic Region",
    },
    {
      es: "Tópico B: Evaluación de las implicaciones y definición de respuestas ante la intensificación de la cooperación militar y los ejercicios conjuntos entre China y la Federación Rusa en regiones de interés estratégico",
      en: "Topic B: Assessing the implications and defining responses to the intensification of military cooperation and the conduct of joint exercises between China and the Russian Federation in regions of strategic interest",
    },
  ],
};

export function topicTranslation(slug: string, position: number, fallback: string): LocalizedText {
  return officialTopicTranslations[slug]?.[position] ?? { es: fallback, en: fallback };
}
