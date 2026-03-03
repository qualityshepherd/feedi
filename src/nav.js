// pure nav state — driven entirely by config, no runtime detection
export const buildNav = (config) => ({
  showFeeds: !!config.separateFeeds
})
