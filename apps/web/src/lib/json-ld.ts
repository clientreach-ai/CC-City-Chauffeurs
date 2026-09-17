/**
 * Structured data, serialised so it cannot escape its own script tag.
 *
 * `JSON.stringify` escapes nothing an HTML parser cares about. A CMS field
 * holding `</script>` would therefore close the block and anything after it
 * would be parsed as markup — the editor of a service page could put script
 * on every page that renders it. The characters below are escaped with their
 * `\uXXXX` forms, which JSON parses back to exactly the same string, so the
 * structured data a search engine reads is unchanged.
 */
export function jsonLd(schema: unknown) {
  return JSON.stringify(schema)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    // U+2028 and U+2029 are valid in JSON but not in a JavaScript string.
    .replace(/ /g, "\\u2028")
    .replace(/ /g, "\\u2029");
}
