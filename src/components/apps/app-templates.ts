// src/components/apps/app-templates.ts

export interface AppTemplate {
  id: string;
  name: string;
  category: string;
  website: string;
  logoPath: string; // path relative to the public folder
  tags?: Record<string, string>;
}

// Category type
export type AppCategory = "collaboration" | "design" | "ai";

// Category display names
export const CATEGORY_LABELS: Record<AppCategory, string> = {
  collaboration: "Collaboration",
  design: "Design",
  ai: "AI",
};

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: "slack",
    name: "Slack",
    category: "collaboration",
    website: "https://slack.com",
    logoPath: "/app-logos/slack.svg",
    tags: {
      en: "Collaboration, Communication, Messaging",
    },
  },
  {
    id: "claude",
    name: "Claude",
    category: "ai",
    website: "https://claude.ai",
    logoPath: "/app-logos/claude.svg",
    tags: {
      en: "AI, Generative AI, Chatbot",
    },
  },
  {
    id: "openai",
    name: "ChatGPT",
    category: "ai",
    website: "https://chat.openai.com",
    logoPath: "/app-logos/openai.svg",
    tags: {
      en: "AI, Generative AI, Chatbot, OpenAI",
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    category: "ai",
    website: "https://cursor.com",
    logoPath: "/app-logos/cursor.svg",
    tags: {
      en: "Development, IDE, AI, Coding",
    },
  },
];
