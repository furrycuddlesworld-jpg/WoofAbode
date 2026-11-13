# Replace browser tab icon with the WoofAbode logo

## What changes
- The small icon in the browser tab (currently the Lovable heart) becomes your uploaded WoofAbode logo.
- The logo is shrunk to a square tab-sized icon, with padding so it isn't stretched.
- The old Lovable icon file is removed so it never shows up again.

## Technical details
- `magick /mnt/user-uploads/Woof_Abode_Logo.png -resize 64x64 -background none -gravity center -extent 64x64 public/favicon.png`
- Also create a 180x180 `public/apple-touch-icon.png` for phone home screens.
- In `src/routes/__root.tsx`, replace the `/favicon.ico` icon link with `{ rel: "icon", type: "image/png", href: "/favicon.png" }` plus an `apple-touch-icon` link.
- Delete `public/favicon.ico`.
