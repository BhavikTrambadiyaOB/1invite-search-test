/**
 * The one search followed through the whole page: "pink dinosaur birthday" and template #71319.
 * Captured on 3 Nov 2026 with the meaning match off (so relevance used the 45 / 25 / 30 mix); rank rechecked on
 * 17 Nov, after main colors started to count.
 */
export const EXAMPLE = {
  query: 'pink dinosaur birthday',
  total: 2988,
  bothDetails: 16,
  rank: 1,
  template: {
    id: 71319,
    name: 'Dinosaur and Bow-Themed Third Birthday Party Invitation',
    previewUrl:
      'https://d3km2tj3qc9xg5.cloudfront.net/mapi-1invites-com/original/dinosaur-and-bow-themed-third-birthday-party-invitation-template-szewms23592438.jpg',
    occasion: 'Kids Birthday',
    confidence: 0.99,
    alsoFits: 'Birthday',
    milestone: 3,
    gender: 'girl',
    themes: ['Dinosaurs'],
    elements: ['dinosaur', 'bow', 'cake', 'gift', 'flower', 'party hat'],
    colors: ['pastel', 'pink', 'purple', 'blue', 'green'],
    quality: 0.87,
    freshness: 0.786,
    relevance: 0.953,
    score: 0.92,
  },
  /** #1 before main colors counted; pink is only its third color tag (blue, green, pink…), so it is now #13. */
  rival: { name: 'One-a-Saurus Dinosaur Birthday', rank: 13, score: 0.922, quality: 0.88, freshness: 0.783 },
  tags: [
    ['Girl', 7],
    ['Pastel', 7],
    ['Whimsical & Cute', 9],
    ['Dinosaurs', 13],
    ['Floral & Botanical', 5],
    ['Purple', 5],
    ['Sun', 5],
  ] as [string, number][],
}
