## assets/icon.png
- Date: 2026-10-30
- Tool and model: Codex CLI 0.164.0 built-in image generation (model id not reported by the tool)
- Seed: not supported
- Reference images: none
- Prompt: (verbatim, fenced)
```text
Use your image generation capability to create ONE image. Do not modify any other files.

REPO ICON for Pick Your AI, a public open-source contributor leaderboard repository.

Create one square 1024 x 1024 px image (aspect ratio 1:1) of a single repository glyph.
Use a simple geometric silhouette with a thin crisp flat outline with NO glow, NO blur and NO soft edges. One accent spark.
Keep the background a single flat, plain, empty white (#FFFFFF) with no gradient, texture, floor or border, and keep the glyph inside the central 688 x 688 px square with generous empty margin on all sides.
Size class SQUARE: a squarish glyph about 600 to 660 px on each side.

GLYPH: Ranked podium. A three-step podium drawn as three adjoining rectangular columns of rising height, the tallest in the centre, the second tallest on the left and the shortest on the right. A thin outlined ring hovers just above the centre column, joined to the tops of the two side columns by two fine arcs, so the shape reads as a leaderboard where contributions connect. Plain geometric outline only, no fill, no inner marks.
SPARK PLACEMENT: A single small four-point spark centred inside the ring above the tallest column.
PALETTE: outline exactly #0F766E (RGB 15,118,110, a deep teal; not green, not cyan, not blue). No glow of any kind: hard, crisp, anti-aliased vector-style edges only; one spark in exactly #FBBF24 (RGB 251,191,36, warm amber).
The spark is the only filled shape and the only element in #FBBF24; keep the glyph outline in #0F766E. Use a uniform line weight of about 14 px.

NEGATIVES: no text, letters, numbers, words, logos or brand marks; no human figures; no third-party IP; no trophy, crown, medal or star shapes; no shadows, 3D, gradients on the background, textures, borders, frames, tiles or rounded-square plates; no extra decorative elements; nothing inside the outer 10% margin.
Colour fidelity matters: sample-check that the outline pixels average to #0F766E.
```
- Candidates: 2 of 3 attempts; selected: 2 (reason: attempt 1 had a soft glow that exceeded the 300 KB icon budget; attempt 2 is flat and passes every automated check)
- Post-processing: showcase.py 1.0.0 content icon normalize --ground transparent; output sha256 a6b9e3b330b26a1b74e26da2115a47ae28e00c527efad382d9c0065f74559414; 125151 bytes
