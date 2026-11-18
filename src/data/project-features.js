// Panamá does not currently operate fuel tracking. Re-enable only when Operations adopts it.
export function fuelTrackingEnabled(project) {
  return project !== 'tmf-panama';
}
