# Coding Conventions

**Analysis Date:** 2026-03-13

## Naming Patterns

**Files:**
- Single-file monolithic application: `src/App.jsx`
- Utilities and components all coexist in one file
- No component file separation or split structure

**Functions:**
- PascalCase for React components: `HomeScreen()`, `StandingsTable()`, `Btn()`, `Panel()`
- camelCase for utility functions: `computeStats()`, `computeClashAwards()`, `rc()`, `tier()`
- Arrow function syntax preferred throughout
- Helper functions often inlined (e.g., `StatBox` defined inside component body)

**Variables:**
- camelCase for state and regular variables: `players`, `setPlayers`, `currentScreen`, `isAdmin`
- Uppercase/CONST naming for constants: `SEED`, `PTS`, `RANKS`, `REGIONS`, `ACHIEVEMENTS`, `GCSS`
- Single letter state shortcuts in some contexts: `s` for size, `v` for variant, `k` for key

**Types/Objects:**
- Descriptive object structures with optional fields: `{id, name, pts, wins, games, avg, ...}`
- Arrays of objects for data collections: `SEED` (24 players), `ACHIEVEMENTS`, `MILESTONES`
- Flat object lookup dicts: `PTS = {1:8, 2:7, ...}`, `RCOLS = {Iron:"#...", Bronze:"#...", ...}`

## Code Style

**Formatting:**
- No external formatter detected (.prettierrc, .eslintrc not present)
- Inconsistent spacing patterns due to manual formatting
- Mixed quote styles (single and double quotes in string literals)
- Long expressions often continue on single lines

**Linting:**
- No linting configuration detected
- No pre-commit hooks enforced for code quality
- Code quality relies on developer discipline

## Import Organization

**Order (in App.jsx):**
1. React imports: `import { useState, useEffect, useRef } from "react"`
2. Constants and data structures (inline)
3. Helper/utility functions (inline)
4. Component definitions (inline, organized by feature area)
5. Root component export

**Path Aliases:**
- Not used; single-file application eliminates need for complex path resolution

## Error Handling

**Patterns:**
- Defensive checks using optional chaining and fallbacks: `player?.clashHistory||[]`, `(disputes||[]).length`
- Try-catch within achievements check: `getAchievements(p)` wraps achievement checks in try-catch to silently handle errors
- Toast notifications for user-facing errors: `toast("Assign all placements first","error")`
- Guard clauses in handlers: `if(!allPlaced){toast(...);return;}`
- No centralized error boundary or error logging service
- Silent failures in some areas (e.g., achievement check errors logged only via fallback)

## Logging

**Framework:** `console` (implicit, not shown but available)

**Patterns:**
- No explicit logging in codebase; reliance on browser dev tools
- Toast system for user notifications rather than logs: `toast(message, type)` with types: "success", "error", "info"
- Temporary debugging would use direct console output (not present in current code)
- No structured logging or error tracking integration

## Comments

**When to Comment:**
- Section headers using block comments: `// ─── CONSTANTS ────...`, `// ─── ATOMS ────...`
- Descriptive headers before logical sections
- Minimal inline comments; code is self-documenting through naming
- Complex logic (e.g., comeback rate calculation) included in comment header

**JSDoc/TSDoc:**
- Not used; no JSDoc or TypeScript documentation
- Function parameters documented through clear naming only
- No formal type hints or comments for function signatures

## Function Design

**Size:**
- Functions range from single-line (e.g., `rc(r)`) to medium-complexity (100+ lines for screen components)
- Screen components (`HomeScreen`, `AccountScreen`, etc.) are large but cohesive
- Utility functions kept short and focused

**Parameters:**
- Destructured props standard in React components: `function HomeScreen({players, setPlayers, setScreen, toast, ...})`
- Arrow functions with direct prop passing: `onClick={()=>onPlace(p.id,place)}`
- No default parameters; conditional assignment inside functions when needed

**Return Values:**
- JSX for components; conditional rendering with ternary operators and logical AND
- Utility functions return primitives, objects, or arrays
- Components conditionally return `null` when not displayed

## Module Design

**Exports:**
- Single default export: `export default function TFTClash()`
- All components and utilities defined before root component
- No named exports; everything imported implicitly through single file

**Barrel Files:**
- Not applicable; monolithic single-file design
- No index files or re-export patterns

## Object Structuring

**Common Patterns:**

**Player object structure:**
```javascript
{
  id: 1,
  name: "Levitate",
  riotId: "Levitate#EUW",
  rank: "Challenger",
  lp: 3480,
  pts: 1024,
  wins: 16,
  games: 32,
  avg: "2.10",
  bestStreak: 7,
  clashHistory: [{id: "c10", placement: 1, pts: 8, ...}],
  checkedIn: true
}
```

**Component prop object spread:**
```javascript
Object.assign({default: value}, style||{})
```

**State management:**
- React hooks (useState, useEffect, useRef) for all state
- Functional updates: `setPlayers(p=>[...p,newPlayer])` to avoid stale state
- Modal state managed locally per component with independent useState calls

## Inline Styles

**Pattern:**
- All styling done via inline `style` objects passed to JSX
- No CSS classes for layout (except pre-defined global classes from GCSS)
- Utility classes used: `.mono`, `.cond`, `.wrap`, `.page`, `.grid-2`, `.grid-3`, `.grid-4`, `.bottom-nav`, `.top-nav`, `.drawer`, etc.
- Color references pulled from constants: `RCOLS`, `tier().col`, `avgCol()` function

**Color System:**
- Accent gold: `#E8A838`
- Dark panels: `#111827`
- Background: `#08080F`
- Text default: `#C8BFB0`, `#F2EDE4`
- Secondary: teal `#4ECDC4`, purple `#9B72CF`, green `#52C47C`
- Danger/red: `#F87171`, `#EF4444`
- Tint syntax: `color+"40"` for 25% opacity, `color+"80"` for 50%, etc.

## Animation Patterns

**CSS animations defined in GCSS:**
- `@keyframes blink`, `slideup`, `fadeup`, `reveal-up`
- Utility classes: `.au`, `.au1`, `.au2`, `.au3` for staggered animations
- Inline animation strings: `animation:"confetti-fall 3s 2.5s ease-in forwards"`
- Transition properties on hover/state change: `transition:"all .15s"`

## Event Handlers

**Pattern:**
- Inline arrow functions on click handlers: `onClick={()=>setScreen("home")}`
- Conditional execution: `onClick={disabled?undefined:onClick}`
- Keyboard events: `onKeyDown={e=>e.key==="Enter"&&register()}`
- Mouse enter/leave for hover states with direct style mutation

## Props Validation

**Method:**
- No prop validation library used (no PropTypes or TypeScript)
- Destructuring assumes props exist; undefined fallbacks used inline
- Default values set inline: `const variant=v||"primary"`

## Accessibility

**Patterns:**
- Tab order naturally follows DOM order (no explicit tabIndex management visible)
- aria labels not explicitly used (area for improvement)
- Semantic HTML minimal; div-based layout
- Color contrast generally maintained but not explicitly validated

---

*Convention analysis: 2026-03-13*
