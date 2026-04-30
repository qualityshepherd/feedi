// Seed the discover directory with curated playlists.
// Paste this entire file into the browser console while on /admin (you must be signed in).
// Already-existing entries are skipped (409 = ok).

;(async () => {
  const token = localStorage.getItem('feedi_token')
  if (!token) { console.error('not signed in — open /admin and log in first'); return }

  const post = (body) => fetch('/api/discover/admin/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  }).then(r => r.json())

  const playlists = [
    {
      title: 'Quiet Corners',
      description: 'Personal sites, slow essays, thinking out loud. No engagement bait. Just humans writing for humans.',
      tags: ['essays', 'indieweb', 'culture', 'longreads', 'writing', 'philosophy', 'science'],
      featured: true,
      sources: [
        'https://daringfireball.net/feeds/main',
        'https://inessential.com/xml/rss.xml',
        'https://www.manton.org/feed.xml',
        'https://feeds.kottke.org/main',
        'https://www.robinsloan.com/feed.xml',
        'https://jvns.ca/atom.xml',
        'https://maggieappleton.com/rss.xml',
        'https://mcfunley.com/feed.xml',
        'https://interconnected.org/home/feed',
        'https://meaningness.com/feed',
        'https://waitbutwhy.com/feed',
        'https://www.astralcodexten.com/feed'
      ]
    },
    {
      title: 'Indie Tech',
      description: 'Builders, open web, anti-hype. Tech writing that respects your attention.',
      tags: ['tech', 'indieweb', 'opensource', 'engineering', 'standards'],
      featured: true,
      sources: [
        'https://baldurbjarnason.com/feed.xml',
        'https://lucumr.pocoo.org/feed.atom',
        'https://simonwillison.net/atom/everything/',
        'https://drewdevault.com/blog/index.xml',
        'https://adamwiggins.com/feed.xml',
        'https://natfriedman.com/feed.xml',
        'https://kellanem.com/feed',
        'https://www.mollywhite.net/feed.xml',
        'https://idlewords.com/feed.xml',
        'https://adactio.com/journal/feed',
        'https://cassidoo.co/rss.xml',
        'https://danluu.com/atom.xml'
      ]
    },
    {
      title: 'Design with Teeth',
      description: 'Design criticism, UX ethics, visual culture. No fluff, no fake gradients.',
      tags: ['design', 'ux', 'ethics', 'accessibility', 'frontend'],
      featured: false,
      sources: [
        'https://alistapart.com/main/feed/',
        'https://uxdesign.cc/feed',
        'https://www.jennyodell.com/feed.xml',
        'https://mike.town/feeds/all.atom.xml',
        'https://inclusive-components.design/rss',
        'https://www.designnotes.blog/feed',
        'https://mina.codes/feed.xml',
        'https://sarah.dev/rss.xml',
        'https://articles.uie.com/feed/',
        'https://mule.design/feed',
        'https://www.anildash.com/feed.xml',
        'https://maggieappleton.com/rss.xml'
      ]
    },
    {
      title: 'Weird Web Archive',
      description: 'Experimental, archival, internet archaeology. The web that time forgot (and the new weird).',
      tags: ['archive', 'weird', 'art', 'theory', 'netart'],
      featured: false,
      sources: [
        'https://theprepared.com/feed/',
        'https://rhizome.org/feed/',
        'https://blog.archive.org/feed/',
        'https://glitchcity.info/feed/',
        'https://zachwhalen.net/feed/',
        'https://rachaelbradshaw.com/feed.xml',
        'https://www.e-flux.com/announcements/rss',
        'https://tinysubversions.com/feed.xml',
        'https://allieyoung.org/feed',
        'https://www.benjaminbratton.com/feed',
        'https://legacyrussell.com/feed',
        'https://constantvzw.org/site/-Constant-Dullart-.xml'
      ]
    },
    {
      title: 'Notebooks & Marginalia',
      description: 'Writers thinking in public. Drafts, process, half-baked ideas. The workshop, not the gallery.',
      tags: ['writing', 'culture', 'essays', 'creativity', 'process'],
      featured: false,
      sources: [
        'https://annehelen.substack.com/feed',
        'https://www.themarginalian.org/feed',
        'https://www.ftrain.com/rss.xml',
        'https://kiostark.com/feed/',
        'https://austinkleon.com/feed/',
        'https://tynan.com/feed',
        'https://calnewport.com/feed/',
        'https://seths.blog/feed/',
        'https://jamesclear.com/feed',
        'https://fortelabs.co/feed/',
        'https://maggieappleton.com/rss.xml',
        'https://www.perell.com/feed'
      ]
    },
    {
      title: 'Slow Science',
      description: 'Accessible, thoughtful science writing. No press-release hype, just curiosity done right.',
      tags: ['science', 'longreads', 'philosophy', 'research', 'rationality'],
      featured: true,
      sources: [
        'https://www.quantamagazine.org/feed/',
        'https://nautil.us/feed/',
        'https://aeon.co/feed.rss',
        'https://pudding.cool/feed/',
        'https://www.3quarksdaily.com/3quarksdaily?format=rss',
        'https://www.edge.org/rss',
        'https://www.lesswrong.com/feed.xml',
        'https://slatestarcodex.com/feed/',
        'https://gwern.net/doc/index.xml',
        'https://marginalrevolution.com/marginalrevolution/feed',
        'https://worksinprogress.co/feed/',
        'https://thebrowser.com/feed'
      ]
    },
    {
      title: 'The Obsidian Layer',
      description: 'Hard tech, systems thinking, hardware hacking, and the grain of how things are actually built.',
      tags: ['tech', 'makers', 'systems', 'science', 'engineering', 'hardware'],
      featured: false,
      sources: [
        'https://stratechery.com/feed/',
        'https://solar.lowtechmagazine.com/feed.xml',
        'https://www.bunniestudios.com/blog/?feed=rss2',
        'http://www.righto.com/feeds/posts/default',
        'https://hackaday.com/blog/feed/',
        'https://spectrum.ieee.org/rss/blog/fulltext',
        'https://thenewstack.io/blog/feed/',
        'https://feeds.arstechnica.com/arstechnica/index',
        'https://restofworld.org/feed/',
        'https://www.theregister.com/headlines.rss',
        'https://oxide.computer/blog/feed.xml',
        'https://theprepared.org/blog?format=rss'
      ]
    },
    {
      title: 'Analog Echoes',
      description: 'Typography, physical design, paper, ink, and the aesthetic side of the human experience.',
      tags: ['design', 'images', 'typography', 'culture', 'art'],
      featured: false,
      sources: [
        'https://www.presentandcorrect.com/blog/feed',
        'https://www.thisiscolossal.com/feed/',
        'https://feeds.feedburner.com/Swissmiss',
        'https://www.itsnicethat.com/rss',
        'https://design-milk.com/feed/',
        'https://eyeondesign.aiga.org/feed/',
        'http://feeds.feedburner.com/grainedit',
        'https://www.core77.com/blog/rss',
        'https://www.creativereview.co.uk/feed/',
        'https://www.underconsideration.com/brandnew/index.xml',
        'https://aestheticamagazine.com/feed/',
        'http://feeds.feedburner.com/thefoxisblack'
      ]
    },
    {
      title: 'The Long View',
      description: 'Deep dives, intellectual curiosity, and writing that stays relevant for decades, not minutes.',
      tags: ['longreads', 'science', 'philosophy', 'writing', 'culture'],
      featured: false,
      sources: [
        'https://aeon.co/feed.rss',
        'https://thebrowser.com/feed/',
        'https://pudding.cool/rss.xml',
        'https://www.quantamagazine.org/feed/',
        'https://longreads.com/feed/',
        'https://nautil.us/feed/',
        'https://www.noemamag.com/feed/',
        'https://www.theparisreview.org/feed',
        'https://3quarksdaily.com/feed',
        'https://www.aldaily.com/feed/',
        'https://www.laphamsquarterly.org/rss.xml',
        'https://granta.com/feed/'
      ]
    },
    {
      title: 'Digital Archaeology',
      description: "The weird web, internet history, and archives of things that should have been forgotten but weren't.",
      tags: ['weird-web', 'archive', 'culture', 'history', 'images'],
      featured: false,
      sources: [
        'https://waxy.org/feed/',
        'https://feeds.kottke.org/main',
        'https://publicdomainreview.org/rss.xml',
        'https://blog.archive.org/feed/',
        'https://feeds.feedburner.com/openculture',
        'http://feeds.feedburner.com/WeirdUniverse',
        'https://www.messynessychic.com/feed/',
        'https://hyperallergic.com/feed/',
        'http://feeds.feedburner.com/Bibliodyssey',
        'https://themorningnews.org/feed',
        'http://feeds.feedburner.com/DarkRoastedBlend',
        'http://www.internethistorypodcast.com/feed/'
      ]
    },
    {
      title: 'Solarpunk Futures',
      description: 'Optimistic tech, regenerative systems, and decentralization that actually serves people.',
      tags: ['science', 'politics', 'culture', 'writing', 'optimism'],
      featured: false,
      sources: [
        'https://reasonstobecheerful.world/feed/',
        'https://www.themarginalian.org/feed/',
        'https://emergencemagazine.org/feed/',
        'https://grist.org/feed/',
        'https://civileats.com/feed/',
        'https://orionmagazine.org/feed/',
        'https://logicmag.io/feed.xml',
        'https://www.propublica.org/feeds/propublica/main',
        'https://atmos.earth/feed/',
        'https://www.positive.news/feed/',
        'https://www.yesmagazine.org/feed/',
        'https://www.hcn.org/feed'
      ]
    }
  ]

  let added = 0; let skipped = 0; let failed = 0
  for (const p of playlists) {
    const res = await post(p)
    if (res.ok) { console.log(`✓ ${p.title}`); added++ } else if (res.error === 'already exists') { console.log(`— ${p.title} (already exists)`); skipped++ } else { console.error(`✗ ${p.title}: ${res.error}`); failed++ }
  }
  console.log(`\ndone: ${added} added, ${skipped} skipped, ${failed} failed`)
})()
