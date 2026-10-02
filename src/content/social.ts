export const social = [
  { url: "mailto:nifemiojokheta@gmail.com", name: "mail" },
  { url: "https://github.com/ojokheta", name: "github" },
  { url: "https://linkedin.com/in/nifemi-ojokheta-5489b7378/", name: "linkedin" },
  { url: "https://x.com/NOjokheta55289", name: "x" },
] as const satisfies { url: string; name: "mail" | "github" | "instagram" | "linkedin" | "x" }[];
