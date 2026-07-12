import type { resources } from "@/i18n/config";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: (typeof resources)["ko"];
  }
}
