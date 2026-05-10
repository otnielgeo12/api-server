/**
 * Coerce Date fields (and any other non-JSON-native types) to their JSON
 * representation by performing a JSON roundtrip. This lets Zod response
 * schemas that declare timestamps as `string` validate Drizzle results,
 * which return JS `Date` objects.
 */
export function serializeForResponse<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
