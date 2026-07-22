export function checkedCommitteeApiTokens(values: readonly string[]) {
  if (values.length !== 3 || values.some((value) => value.length < 24)) {
    throw new Error("COMMITTEE_API_TOKENS must contain three long tokens in member order");
  }
  if (new Set(values).size !== 3) throw new Error("Committee API tokens must be distinct");
  return values as readonly [string, string, string];
}
