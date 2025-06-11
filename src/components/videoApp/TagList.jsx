import { useState } from "react";

function TagList({ tags }) {
  const [showAll, setShowAll] = useState(false);

  const displayedTags = showAll ? tags : tags?.slice(0, 3);

  return (
    <>
      {tags && tags.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          <div className="flex flex-wrap gap-2">
            {displayedTags.map((tag, tIdx) => (
              <span
                key={tag.name + tIdx}
                className="px-2 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: tag.color, color: "#fff" }}
              >
                {tag.name}
              </span>
            ))}
          </div>
          {tags.length > 3 && (
            <button
              className="text-blue-600 text-xs underline mt-1 w-fit"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? "Show less" : `Show more (${tags.length - 3} more)`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
export default TagList;