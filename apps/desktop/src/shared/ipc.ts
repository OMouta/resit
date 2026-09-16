export const HEALTH_CHECK_CHANNEL = "resit:health-check";

export interface HealthCheckResult {
  status: "ok";
}

export interface DesktopApi {
  healthCheck(): Promise<HealthCheckResult>;
}
