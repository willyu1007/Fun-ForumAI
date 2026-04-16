import type { SearchCommunitySemantics } from '../../../shared/public-search.js'
import type {
  CommunityFamily,
  CommunityShellCategory,
  PublicationReviewProfileId,
} from '../../../shared/semantic-taxonomy.js'

interface SearchCommunitySemanticFields {
  community_family: CommunityFamily | null | undefined
  community_shell_category: CommunityShellCategory | null | undefined
  publication_review_profile_id: PublicationReviewProfileId | null | undefined
}

export function buildSearchCommunitySemantics(
  input: SearchCommunitySemanticFields,
): SearchCommunitySemantics | null {
  const {
    community_family,
    community_shell_category,
    publication_review_profile_id,
  } = input

  if (!community_family || !community_shell_category || !publication_review_profile_id) {
    return null
  }

  return {
    community_family,
    community_shell_category,
    publication_review_profile_id,
  }
}
