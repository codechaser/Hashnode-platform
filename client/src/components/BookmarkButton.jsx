function BookmarkButton({ bookmarked, loading, onClick, compact = false }) {
  return (
    <button
      className={`bookmark-button ${bookmarked ? "bookmarked" : ""} ${compact ? "bookmark-button-compact" : ""}`}
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-pressed={bookmarked}
    >
      <span aria-hidden="true">{bookmarked ? "★" : "☆"}</span>
      {loading ? "Saving..." : bookmarked ? "Saved" : "Save"}
    </button>
  );
}

export default BookmarkButton;
