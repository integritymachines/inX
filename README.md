# In X

An endless, interactive ensemble after Terry Riley's *In C* (1964), and minimalism at large. Up to 24 players work through an evolving stream of short patterns under In C's rules, with optional techniques after Reich (phasing), Glass (additive process), Adams (intensity waves) and Young (just intonation and drone), a slider that moves the whole thing from orchestra to techno, and three listening modes for work: Productive, Creative and Focus.

Everything runs in the browser: plain HTML and JavaScript, Web Audio, no build step, no dependencies.

## Run it

The page loads its instrument samples with `fetch`, so it needs to be served over HTTP rather than opened as a file:

```sh
python3 -m http.server 8765
# then open http://localhost:8765/
```

Press **Start**. The page has three screens, one below the other: the dashboard you play from, **Setup** (which instruments are on stage, and the seed patterns), and **Notes**, which explain every control. The preset menu lists general scenes, then Berlin clubs (Berghain, Panorama Bar, Wilde Renate, Tresor, KitKat, Kater Blau, Club der Visionäre, Sisyphos), then the modes; *Middle* and *Random* are neutral and random starting points.

## How it works

- **Patterns.** A seeded generator breeds new patterns from earlier ones (mutation, crossover, occasional new material) and picks each from 18 candidates for chord fit, complexity near a target, and kinship with its parent and with the section's theme. Pattern lengths follow In C's spread (median 6 eighths, up to 64); the pulse is a sixteenth note, so short cells can move in sixteenths while every pattern lasts whole eighths.
- **Sections.** Each section has an arc: a soloist opens on plain patterns over the tonic, the first player back brings in the theme, the ensemble grows as complexity, pitch range and the pitch set grow, a new tone arrives about halfway and tips the key a fifth, the dominant is held through the build, and a gathering calls everybody in for a climax before all but one drop out.
- **Players.** Players repeat a pattern as long as they like, never go back, and stay within a span of patterns of each other (Terry's slider); each has its own pace. Simulated visitors switch players on and off on leases; you can switch any player on or off yourself.
- **Techno.** One slider brings in a synthesized rhythm section voice by voice, locks the foundation to strict 4/4, and turns gatherings into breakdown, build and drop.
- **Modes.** *Productive*: a fixed ensemble of eight at 115 BPM in strict 4/4, little surprise, rare and gentle gatherings, flattened dynamics. *Creative*: slow, orchestral, all composers, a wide span, frequent full climaxes, more new material and occasional key leaps. *Focus*: a cold-start ramp that starts driving at 128 BPM with an early full climax and glides into Productive over ten minutes.

## Files

```
index.html          dashboard, styles and notes
js/util.js          helpers, seed patterns
js/styles.js        In C rules and composer techniques
js/score.js         pattern generator: arc, theme, lengths, harmony
js/sound.js         instruments, roles, audio graph
js/time.js          scheduler, Reich phasing
js/glass.js         Glass additive process
js/form.js          Adams intensity waves
js/tuning.js        Young just intonation and drone
js/balance.js       measured level trims (acoustic)
js/sampler.js       sample loading and playback
js/dynamics.js      loudness control, orchestration by role
js/techno.js        rhythm section, grid, groove evolution
js/electro.js       electronic voices
js/electrobalance.js measured level trims (electronic)
js/presets.js       scenes, modes and the Focus ramp
js/ensemble.js      players, gatherings, sections, visitors
js/ui.js            controls and drawing
samples/            instrument samples (mono MP3) and manifest.json
```

## Credits and licenses

The code is under the MIT License (see `LICENSE`). The samples keep their own licenses:

- [VSCO 2 Community Edition](https://vis.versilstudios.net/vsco-community.html) by Versilian Studios, Sam Gossner and Simon Dalzell: CC0.
- [Versilian Community Sample Library](https://github.com/sgossner/VCSL) (VCSL) by Versilian Studios: CC0. Grand piano (Steinway B), congas and bongos, darbuka and frame drums, agogô, cowbell, claves, woodblock and triangle.
- Saxophone and guitar from the [Tone.js instrument samples](https://github.com/nbrosowsky/tonejs-instruments) by Nicholas Brosowsky ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)), originally from Karoryfer Samples and the University of Iowa Electronic Music Studios.

In C is Terry Riley's. The default seed patterns are original placeholders; to start from In C itself, paste its 53 patterns from your copy of the score into the Seed patterns field.
