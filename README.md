# IDPress 1.0
Made public after being updated to 'Service Press', now free to use at https://press.shadowstar.io/ for your service, real or play.
Thank you to all those out there who do serve our countries and communities.

Local desk for Eclipse RP name tapes, pressed badges, and forum signatures. The plate is a stack of shapes, uploaded art, and text. A template keeps the design. Someone else loads it and only changes the words.

No badge artwork ships with the app. Upload the seal. Shapes are the only pieces the tool inserts.

Work stays in the browser. Saves live in local storage. Hand someone a file when the design should travel.

Sibling of [Merit Press](https://github.com/ShadowstarIO/MeritPress). Ribbons stay there. Business marks stay out of both.

## Run

```bash
npm install
npm run dev
```

The desk is at http://127.0.0.1:8080.

## Share

- **Template** (`.idpress.json`) — layout without requiring the images to be embedded the same way a full save is. Also kept in the local template list.
- **Save file** (`.idpress`) — the plate plus uploaded images.
- **PNG / SVG** — empty space stays clear unless Plate fill is on.
- **Link** — the plate in the URL hash, when it has no images.

Load accepts a template or a save. Script and SVG payloads are dropped. Images are kept only as raster data.

**Lock layers for recipients** locks the exported copy. A recipient can still unlock a layer. The words stay editable either way.

## Kits

Signature, title card, and name tape place bars, a seal ring, and empty text slots. Blank clears the plate.

## Address

The public desk is [press.shadowstar.io/id](https://press.shadowstar.io/id). Merit Press is the other door.

Cloudflare Worker build command: `npm run build:cf`

Deploy command: `npx wrangler deploy`
