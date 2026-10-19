# apartment-planner

A 3D planner for furnishing one real apartment, built with React, three.js and Spring Boot.

The flat is modelled from its dimensioned construction drawing, so walls, doors, windows and
fixed fittings sit where they really are (see `frontend/src/lib/dimensions.ts`). Furniture
comes from a catalogue built from IKEA's product search, with real sizes and, where IKEA
publishes them, real 3D models.

## What it does

- **Five views:** orbit around the flat, a top-down floor plan, the view from the window,
  a first-person walk, and a free camera.
- **Place and edit furniture:** drag, rotate and resize items, with a warning when two
  pieces overlap or leave too little room between them.
- **Light:** set the sun's position to see how the rooms are lit.
- **Saved designs:** anyone can open and walk through a saved design. Only a signed-in user
  can create, save, rename or delete one.
- **Shopping list:** everything in a design with its size and colour, downloadable as a CSV file.
- **Phone layout:** its own touch interface, with a walk pad for moving around.

## Layout

| Folder | What is in it |
|---|---|
| `frontend/` | The 3D app (React, three.js through react-three-fiber, Vite) |
| `frontend/scripts/` | Builds the product catalogue from IKEA's search API |
| `src/` | The Spring Boot server: saved designs and the page itself |
| `auth-core/`, `version-core/` | Two small shared libraries: the login check and `/version` |
| `scripts/` | Tools for the media folder (snapshots, recolouring a 3D model) |

The product catalogue (`products.json`), product images and 3D models are not in this repo.
The page loads them from `/media/`, a folder the web server serves straight off disk.

## Login

The app never shows a login form. A separate login service sets a signed cookie, which the
server checks with `SSO_SIGNING_KEY`. Without that key nobody counts as signed in, and the
planner is read-only. The flat's address, if set (`PLACE_UNIT`, `PLACE_STREET`,
`PLACE_POSTCODE`, `PLACE_CITY`), is only sent to a signed-in visitor.

## Building

Needs Java 25 and Node 24.

```
./gradlew clean build --parallel
java -jar build/libs/apartment-planner-1.0.0.jar
```

Saved designs are kept in an H2 database under `data/`.
