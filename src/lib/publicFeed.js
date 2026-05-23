/** Returns true when an item should appear on the resident/public feed. */
export function isPublicFeedItem(item) {
  if (!item) return false;
  if (item.isPublicFeed === false || item.is_public_feed === false) return false;
  if (item.archived_at || item.archivedAt || item.archived === true || item.isArchived === true) return false;
  if (item.deleted_at || item.deletedAt || item.deleted === true || item.isDeleted === true) return false;
  if (item.hidden === true || item.visible_to_residents === false) return false;
  return true;
}

export function filterPublicFeedItems(items) {
  return (items || []).filter(isPublicFeedItem);
}
