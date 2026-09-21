import type { MetadataRoute } from "next";

import { dashboardManifest } from "@/lib/dashboard-manifest";

export default function manifest(): MetadataRoute.Manifest {
  return dashboardManifest();
}
