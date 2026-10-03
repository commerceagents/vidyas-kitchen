/**
 * Sends request traces to Dynatrace when the three OTEL variables are set.
 * With them unset, this file does nothing and the live site behaves as before.
 *
 * In Vercel → Settings → Environment Variables (Production):
 *   OTEL_EXPORTER_OTLP_ENDPOINT = https://{environment-id}.live.dynatrace.com/api/v2/otlp
 *   OTEL_EXPORTER_OTLP_HEADERS  = Authorization=Api-Token {classic access token}
 *   OTEL_EXPORTER_OTLP_PROTOCOL = http/protobuf
 *
 * The token needs the scope openTelemetryTrace.ingest.
 * Create it in Dynatrace → Access tokens. Then redeploy.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) return;

  try {
    const { registerOTel } = await import("@vercel/otel");
    registerOTel({ serviceName: "vidyas-kitchen" });
  } catch (error) {
    console.error("[otel] Dynatrace tracing did not start", error);
  }
}
