// Relevance sort + random display
function shuffle<T>(arr: T[]): T[] {
  return arr
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

const similarItems = (
  currentItem: any,
  allItems: any,
  id: string,
  randomCount?: number
) => {
  const categories: string[] = currentItem.data.categories || [];
  const tags: string[] = currentItem.data.tags || [];

  // Calculate the relevant scores
  const scored = allItems
    .filter((item: any) => item.id !== id)
    .map((item: any) => {
      const itemCategories: string[] = item.data.categories || [];
      const itemTags: string[] = item.data.tags || [];
      const categoryScore = categories.filter((c) => itemCategories.includes(c)).length;
      const tagScore = tags.filter((t) => itemTags.includes(t)).length;
      return { item, score: categoryScore + tagScore };
    })
    .filter(({ score }: { score: number }) => score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .map(({ item }: { item: any }) => item);

  // Randomly display some content
  if (randomCount && scored.length > randomCount) {
    return shuffle(scored).slice(0, randomCount);
  }
  return scored;
};

export default similarItems;
