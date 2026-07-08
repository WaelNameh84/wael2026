export { useTranslation } from "react-i18next";

import { ReactNode } from "react";

export function I18nProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
