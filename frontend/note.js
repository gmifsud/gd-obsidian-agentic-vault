// Note parsing for the Control Panel.

import matter from 'gray-matter';

/**
 * Split a note into frontmatter and body.
 *
 * A note whose frontmatter is not valid YAML is still returned, with empty
 * frontmatter, its full text as the body, and the parser's reason in
 * `frontmatterError`. One bad note must not fail a request that reads many.
 */
export function parseNote(rawContent) {
  try {
    // Passing options bypasses gray-matter's content cache. The cache stores a
    // note before parsing it, so a note that fails once would be returned on
    // the next call as if it had no frontmatter and no error.
    const { data, content } = matter(rawContent, {});
    return { data, content, frontmatterError: null };
  } catch (error) {
    return { data: {}, content: rawContent, frontmatterError: error.reason || error.message };
  }
}
