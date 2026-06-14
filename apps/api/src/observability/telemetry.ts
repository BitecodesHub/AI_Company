/**
 * OpenTelemetry setup — must be imported BEFORE any other module.
 * Call initTelemetry() in main.ts before NestJS bootstraps.
 * (ARCHITECTURE.md §20, P14-02)
 */
export function initTelemetry(): void {
  if (process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
    // Lazy-load to avoid startup cost when OTEL is disabled
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
    const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

    const sdk = new NodeSDK({
      serviceName: 'bitecodes-api',
      traceExporter: new OTLPTraceExporter({
        url: `${process.env['OTEL_EXPORTER_OTLP_ENDPOINT']}/v1/traces`,
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${process.env['OTEL_EXPORTER_OTLP_ENDPOINT']}/v1/metrics`,
        }),
        exportIntervalMillis: 60_000,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
        }),
      ],
    });

    sdk.start();
    console.log('[OTEL] Tracing enabled →', process.env['OTEL_EXPORTER_OTLP_ENDPOINT']);
  }
}
