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

A **scene** (Setup screen) is one JSON object holding seed patterns, settings and line-up: write one by hand, copy the running settings into one, save it as a file (and in the browser, under *My scenes*), or open one. The notes list every field. Built-in *Styles* scenes (Pulse study, Additive, Long loops, Shaker, Tintinnabuli, Kotekan) are written in the manner of Reich, Glass, Eno, Adams, Pärt and Balinese gamelan, and three electronic scenes in the spirit of Kiasmos (*Nordic*), Rival Consoles (*Analog*) and Kraftwerk (*Robotik*), all with original material. The electronica layer (held chord loops, ducking pads, an arpeggio that opens over a section, broken kicks, tape saturation) is described in the notes.

## How it works

- **Patterns.** A seeded generator breeds new patterns from earlier ones (mutation, crossover, occasional new material) and picks each from 18 candidates for chord fit, complexity near a target, and kinship with its parent and with the section's theme. Pattern lengths follow In C's spread (median 6 eighths, up to 64); the pulse is a sixteenth note, so short cells can move in sixteenths while every pattern lasts whole eighths.
- **Sections.** Each section has an arc: a soloist opens on plain patterns over the tonic, the first player back brings in the theme, the ensemble grows as complexity, pitch range and the pitch set grow, a new tone arrives about halfway and tips the key a fifth, the dominant is held through the build, and a gathering calls everybody in for a climax before all but one drop out.
- **Players.** Players repeat a pattern as long as they like, never go back, and stay within a span of patterns of each other (Terry's slider); each has its own pace. Simulated visitors switch players on and off on leases; you can switch any player on or off yourself.
- **Track form.** From 50% Techno, the techno layer follows a plan of sections, as a produced track does: intro, groove, peak, breakdown, build, drop, outro, each some bars long with its own drums, bass, pad, arpeggio and orchestra filter. When a plan ends, the next track starts with a new groove. Four forms are built in (classic, long, rolling, double); a scene can bring its own as `kit.form`, e.g. `[["intro",16],["groove",32],["breakdown",16],["build",8],["drop",32],["outro",16]]`. Gatherings steer the plan: the call jumps to a breakdown, held until the climax; the climax becomes the build, as long as the crescendo; the dropout is the drop. A position bar under the stream shows the plan, the section and what comes next.
- **Tacet.** With a preset's fixed line-up, players now sit stretches out (tacet) and come back with the music's overall dynamics: the share of players sounding follows the track section (few in intro, breakdown and outro, all at peak and drop), John's intensity, or the section's arc, one change every couple of bars; the low instruments and drums go first in breakdowns and builds, and each role keeps a player where it can. Without a fixed line-up, visitors already come and go, so only the track's quiet sections thin the ensemble. A gathering calls everybody back.
- **Notation.** The Notation button on Pattern stream replaces the roll with the same window of patterns on a staff (played, in play, coming), with a dot for each player: numbered like In C's score, with key signatures, accidentals, ties and beams. Notes that share an onset are written as a chord. Off by default.
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
js/track.js         track form: sections, plans, position bar data
js/electro.js       electronic voices
js/electrobalance.js measured level trims (electronic)
js/electronica.js   chord loops, pad, arpeggio, broken kicks, tape
js/presets.js       scenes, modes and the Focus ramp
js/ensemble.js      players, gatherings, sections, visitors
js/scenes.js        scenes: format, save/open, built-in styles
js/notation.js      staff notation of the patterns in play (the Notation button)
js/glyphs.js        engraving glyphs from Bravura
js/ui.js            controls and drawing
samples/            instrument samples (mono MP3) and manifest.json
```

## Credits and licenses

The code is under the MIT License (see `LICENSE`). The samples keep their own licenses:

- [VSCO 2 Community Edition](https://vis.versilstudios.net/vsco-community.html) by Versilian Studios, Sam Gossner and Simon Dalzell: CC0.
- [Versilian Community Sample Library](https://github.com/sgossner/VCSL) (VCSL) by Versilian Studios: CC0. Grand piano (Steinway B), harpsichord, vibraphone, tubular bells, kalimba, mbira, balafon, đàn tranh, alto recorder, harmonica, congas and bongos, darbuka and frame drums, agogô, cowbell, claves, woodblock and triangle.

Also from VCSL: psaltery, Renaissance organ, folk harp, soprano and bass recorders, hand chimes, rope-tension snare, tambourine, sleigh bells and finger cymbals.

The vintage synthesizers (Moog, M1, MS-20, Juno, Polysix, Prophet), the gamelan pair and the medieval lute, hurdy-gurdy, shawm, crumhorn and bagpipe are synthesized in the browser; the names describe what they imitate.
- Saxophone and guitar from the [Tone.js instrument samples](https://github.com/nbrosowsky/tonejs-instruments) by Nicholas Brosowsky ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)), originally from Karoryfer Samples and the University of Iowa Electronic Music Studios.
- Engraving glyphs from [Bravura](https://github.com/steinbergmedia/bravura) by Steinberg Media Technologies GmbH, [SIL Open Font License 1.1](https://openfontlicense.org), drawn as SVG paths (license text in `licenses/Bravura-OFL.txt`).

In C is Terry Riley's. The default seed patterns are original placeholders; to start from In C itself, paste its 53 patterns from your copy of the score into the Seed patterns field.
