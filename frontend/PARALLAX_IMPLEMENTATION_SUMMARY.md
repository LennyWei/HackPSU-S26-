# Parallax Background Implementation Summary

## What Was Done

### 1. **Created ParallaxBackground Component**
   - File: `frontend/components/ui/parallax-background.tsx`
   - Tracks mouse position in real-time
   - Applies CSS `transform: translate()` based on mouse movement
   - Includes optional dark overlay for contrast
   - Fully typed with JSDoc documentation

### 2. **Updated Both Pages**

#### Home Page (`app/page.tsx`)
   - ❌ Removed: `CosmicStarfield` component & ref
   - ✅ Added: `ParallaxBackground` with intensity 25
   - ✅ Adjusted: Z-index layering (scanlines/vignette now zIndex: 1)

#### Battle Page (`app/battle/page.tsx`)
   - ❌ Removed: `Starfield` component
   - ✅ Added: `ParallexBackground` with intensity 20
   - ✅ Kept: Scanlines effect for retro aesthetic

### 3. **Documentation Created**
   - `PARALLAX_BACKGROUND_SETUP.md` — Complete setup guide with:
     - File placement instructions
     - Image requirements table
     - Usage examples for both pages
     - Performance tips & customization guide
     - Troubleshooting table

---

## Next Steps You Need To Take

### Step 1: Create the Images Directory

```bash
mkdir -p frontend/public/images
```

### Step 2: Place Your Background PNG

Download or create a pixelated space background PNG and save it as:

```
frontend/public/images/background.png
```

**Image Specs:**
- Size: ~1440×900 (15% larger than typical viewport)
- Format: PNG with transparency or solid background
- Style: Pixelated/retro space aesthetic

### Step 3: Test

Start Docker:
```bash
docker compose up --build
```

Visit `http://localhost:3000` and test:
- ✅ Background image displays
- ✅ Mouse parallax effect works (image shifts as you move mouse)
- ✅ Scanlines overlay visible
- ✅ Battle page background is slightly different intensity

---

## How Parallax Works

```
Mouse Position (X: 75%, Y: 50%)
         ↓
Normalize to -1.0 to +1.0 range (X: +0.5, Y: 0)
         ↓
Multiply by parallaxIntensity (20 or 25)
         ↓
Calculate offset: X: +12.5px, Y: 0px
         ↓
Apply CSS: transform: translate(12.5px, 0px)
         ↓
Background shifts right slightly
```

The effect is subtle but enhances immersion. Faster the mouse movement, faster the parallax response.

---

## Z-Index Hierarchy

```
zIndex: 0  │ Parallax Background (fixed, behind everything)
zIndex: 0  │ └─ Dark overlay (optional contrast)
zIndex: 1  │ Scanlines (fixed, retro CRT effect)
zIndex: 1  │ Vignette (home page only)
zIndex: 2  │ Content (sprites, UI, panels)
zIndex: 100│ Floating damage numbers
```

---

## Customization Options

### Change Parallax Intensity

Home page (subtle):
```typescript
<ParallaxBackground imagePath="/images/background.png" parallaxIntensity={15} />
```

Battle page (dramatic):
```typescript
<ParallaxBackground imagePath="/images/background.png" parallaxIntensity={30} />
```

### Remove Dark Overlay

Edit `parallax-background.tsx` line ~72:
```typescript
{/* <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.15)', ... }} /> */}
```

### Change Background Image

Update the `imagePath` prop:
```typescript
<ParallaxBackground imagePath="/images/my-custom-bg.png" parallaxIntensity={25} />
```

---

## Performance Notes

- **60 FPS parallax** — Uses `willChange: 'transform'` for GPU acceleration
- **Responsive to resize** — Auto-recalculates on window resize
- **Low memory** — No animation libraries; pure CSS transforms
- **Mobile friendly** — Works on touch devices (though parallax effect is mouse-only)

---

## Testing Checklist

- [ ] Directory `frontend/public/images/` created
- [ ] PNG file placed at `frontend/public/images/background.png`
- [ ] Home page loads with parallax background
- [ ] Battle page loads with parallax background
- [ ] Mouse movement triggers parallax effect
- [ ] Scanlines visible over background
- [ ] No black edges during parallax panning
- [ ] Docker build completes without errors
