/**
 * SplashScreen — router: picks style based on settings
 */
import { useSettings } from "@/hooks/use-settings";
import SplashScreen1 from "./SplashScreen1";
import SplashScreen2 from "./SplashScreen2";
import SplashScreen3 from "./SplashScreen3";
import SplashScreen4 from "./SplashScreen4";
import SplashScreen5 from "./SplashScreen5";
import SplashScreen6 from "./SplashScreen6";
import SplashScreen7 from "./SplashScreen7";
import SplashScreen8 from "./SplashScreen8";
import SplashScreen9 from "./SplashScreen9";

export default function SplashScreen() {
  const { splashStyle } = useSettings();
  if (splashStyle === "style2") return <SplashScreen2 />;
  if (splashStyle === "style3") return <SplashScreen3 />;
  if (splashStyle === "style4") return <SplashScreen4 />;
  if (splashStyle === "style5") return <SplashScreen5 />;
  if (splashStyle === "style6") return <SplashScreen6 />;
  if (splashStyle === "style7") return <SplashScreen7 />;
  if (splashStyle === "style8") return <SplashScreen8 />;
  if (splashStyle === "style9") return <SplashScreen9 />;
  return <SplashScreen1 />;
}
