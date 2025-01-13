export const fetchViewMode = async () => {
  const response = await fetch("/api/view", {
    method: "GET",
    credentials: "same-origin", // Include cookies for same-origin requests
  });
  const { viewMode } = await response.json();
  return viewMode;
};

export const saveViewMode = async (viewMode: "modern" | "classic") => {
  await fetch("/api/view", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin", // Include cookies for same-origin requests
    body: JSON.stringify({ viewMode }),
  });
};
