# Parallax Background Setup & Documentation

## Overview

The `ParallaxBackground` component replaces the Starfield with a PNG-based parallax effect. The background image shifts subtly as the user moves their mouse, creating depth without heaviness.

## File Placement

Place your PNG background image here:

```
frontend/
  public/
    images/
      background.png         ← Your pixelated space background goes here
```

**Note**: The `public/` folder is served statically by Next.js. Files here are accessible at their path, e.g., `/images/background.png`.

## Image Requirements

| Property | Requirement | Example |
|----------|-------------|---------|
| **Format** | PNG, WebP (transparent or solid) | `background.png` |
| **Size** | 15–20% larger than typical viewport | 1440×900 for 1280×800 app |
| **Aspect Ratio** | Should match your app's default aspect ratio | 16:9 recommended |
| **Resolution** | Pixel art / low-res OK; 96–192 DPI | Pixelated style works great |

**Why larger?**  
The parallax transform shifts the image by ±X pixels. If the image is exactly viewport-sized, you'll see black edges during parallax movement. Going ~15% oversized prevents this.

## Usage

### Home Page (`app/page.tsx`)

```typescript
import ParallaxBackground from '@/components/ui/parallax-background'

export default function Home() {
  return (
    <>
      {/* Add this as first child of root div */}
      <ParallaxBackground 
        imagePath="/images/background.png"
        parallaxIntensity={25}
      />
      
      {/* Rest of your existing content */}
      ...
    </>
  )
}
```

### Battle Page (`app/battle/page.tsx`)

```typescript
import ParallaxBackground from '@/components/ui/parallax-background'

export default function BattlePage() {
  return (
    <>
      <ParallaxBackground 
        imagePath="/images/background.png"
        parallaxIntensity={20}
      />
      
      {/* Rest of your battle UI */}
      ...
    </>
  )
}
```

## Component Props

### `imagePath` (required)

- **Type**: `string`
- **Example**: `"/images/space-bg.png"`
- **Description**: Path to background image relative to `public/` folder

### `parallaxIntensity` (optional)

- **Type**: `number`
- **Default**: `20`
- **Range**: `5–50`
- **Description**: Strength of parallax effect
  - **5–10** = Subtle, barely noticeable
  - **15–25** = Balanced, smooth
  - **30–50** = Dramatic, very responsive

## How It Works

### Mouse Tracking

```
1. User moves mouse → mousemove event fires
2. Mouse X/Y normalized to -1.0 to +1.0 (left/right, top/bottom)
3. Multiply by parallaxIntensity → offset in pixels
4. Apply CSS transform: translate(offsetX, offsetY)
```

Example:  
- Mouse at 75% right → normalized to +0.5
- Intensity 20 → offset = +10px
- Image shifts 10px right, creating depth

### Z-Index Layering

```
zIndex: 0  ← ParallaxBackground (stays behind everything)
zIndex: 1  ← Dark overlay (optional contrast boost)
zIndex: 2  ← Starfield / UI / sprites (original content)
```

The `.fixed` positioning ensures background stays stationary relative to viewport while content scrolls over it.

## Scanlines (Kept)

Scanlines are rendered in the page itself (not in this component). They overlay on top via `zIndex: 1` in the `<style>` block:

```typescript
<div style={{
  position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
  backgroundImage: 'repeating-linear-gradient(0deg, ...)',
}} />
```

This preserves the retro CRT aesthetic while using a PNG background.

## Performance Tips

- **Use `willChange: 'transform'`** → Browser optimizes the parallax transform (already in code)
- **Transition: 0.05s linear** → Smooth but responsive; feel free to adjust
- **PNG optimization** → Use a tool like [TinyPNG](https://tinypng.com) to compress
- **Image size** → Keep under 500KB; larger files slow load

## Customization Examples

### Subtle parallax (home page)

```typescript
<ParallaxBackground imagePath="/images/background.png" parallaxIntensity={15} />
```

### Dramatic parallax (battle page)

```typescript
<ParallaxBackground imagePath="/images/background.png" parallaxIntensity={35} />
```

### Remove dark overlay

Edit `parallax-background.tsx` and comment out or delete the overlay div:

```typescript
{/* <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.15)', ... }} /> */}
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Image doesn't show | Wrong path or file missing | Check `public/images/` folder; verify path is exact |
| Black edges on parallax | Image too small | Increase image dimensions by ~15% |
| Parallax too fast/slow | Intensity value wrong | Adjust `parallaxIntensity` prop (lower = slower) |
| Jittery movement | Transition time too high | Keep `transition: '0.05s linear'` |

## Migration Checklist

- [ ] Create `public/images/` folder
- [ ] Place your `background.png` there
- [ ] Import `ParallaxBackground` in `app/page.tsx`
- [ ] Replace `<CosmicStarfield>` with `<ParallaxBackground imagePath="/images/background.png" />`
- [ ] Do the same for `app/battle/page.tsx`
- [ ] Test in browser; adjust `parallaxIntensity` to taste
- [ ] Remove `<CosmicStarfield>` import if no longer used elsewhere
